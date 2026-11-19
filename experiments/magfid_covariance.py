#!/usr/bin/env python3
"""Source-bound multi-gyroscope covariance falsification on MAGF-ID recordings.

Train and evaluate are separate processes. Test requires an explicit frozen-model
receipt, and every CSV is SHA-verified before parsing. No interpolation is used.
The contrast experiment cannot authenticate absolute sensor calibration.
"""
import argparse
import csv
import hashlib
import io
import itertools
import json
from pathlib import Path
import sys
import time

import numpy as np

SENSORS = [9, 10, 11, 15]
PAIRS = list(itertools.combinations(range(4), 2))
INCIDENCE = np.array([[float(i in pair) for i in range(4)] for pair in PAIRS])
COLLOCATION = np.linalg.pinv(INCIDENCE)
TIME_COLUMN = 'SampleTimeFine [micro_sec]'
GYRO_COLUMNS = ['Gyr_X [dps]', 'Gyr_Y [dps]', 'Gyr_Z [dps]']
SEED = 1850743665


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_sha():
    return sha(Path(__file__).read_bytes())


def json_ready(obj):
    if isinstance(obj, np.ndarray):
        return json_ready(obj.tolist())
    if isinstance(obj, np.generic):
        return json_ready(obj.item())
    if isinstance(obj, dict):
        return {str(k): json_ready(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_ready(v) for v in obj]
    if isinstance(obj, float) and not np.isfinite(obj):
        raise ValueError('nonfinite number in scientific receipt')
    return obj


def write_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(json_ready(obj), sort_keys=True, indent=2) + '\n').encode()
    if path.exists():
        raise ValueError(f'refusing to overwrite study output: {path}')
    path.write_bytes(data)
    return sha(data)


def metadata(root):
    root = Path(root)
    split_bytes = (root / 'physical-covariance-split.json').read_bytes()
    protocol_bytes = (root / 'physical-covariance-protocol.json').read_bytes()
    split = json.loads(split_bytes)
    if split['protocol_sha256'] != sha(protocol_bytes):
        raise ValueError('split and protocol hashes disagree')
    if split['numeric_rows_opened'] is not False:
        raise ValueError('input partition was not frozen before measurements')
    return split, {'split_sha256': sha(split_bytes), 'protocol_sha256': sha(protocol_bytes)}


def read_record(root, split, record):
    streams = []
    for sensor in SENSORS:
        member = record['members'][str(sensor)]
        receipt = split['member_hashes'][member]
        raw = (Path(root) / 'raw' / receipt['local_name']).read_bytes()
        if len(raw) != receipt['bytes'] or sha(raw) != receipt['sha256']:
            raise ValueError('raw source hash mismatch: ' + member)
        header = next(csv.reader(io.StringIO(raw.split(b'\n', 1)[0].decode('utf-8-sig'))))
        columns = [header.index(name) for name in [TIME_COLUMN, *GYRO_COLUMNS]]
        numeric = np.loadtxt(io.BytesIO(raw), delimiter=',', skiprows=1, usecols=columns, ndmin=2)
        if not np.all(np.isfinite(numeric)) or not np.all(numeric[:, 0] == np.rint(numeric[:, 0])):
            raise ValueError('nonfinite measurement or noninteger source timestamp: ' + member)
        times = numeric[:, 0].astype(np.int64)
        # The source counter is microseconds, possibly wrapping at uint32.
        wraps = np.r_[0, np.cumsum(np.diff(times) < -(2 ** 31))]
        times = times + wraps * (2 ** 32)
        if not np.all(np.diff(times) > 0):
            raise ValueError('nonmonotone source-native clock: ' + member)
        values = numeric[:, 1:]
        if not np.all(np.isfinite(values)):
            raise ValueError('nonfinite source gyroscope value: ' + member)
        streams.append((times, values))
    return streams


def native_grid(streams, period_us):
    """Join exact native integer clock cells; never interpolate missing samples."""
    starts = np.array([t[0] for t, _ in streams], dtype=np.int64)
    adjusted = []
    for times, values in streams:
        shift = int(round((starts[0] - times[0]) / (2 ** 32))) * (2 ** 32)
        adjusted.append((times + shift, values))
    origin = max(int(t[0]) for t, _ in adjusted)
    end = min(int(t[-1]) for t, _ in adjusted)
    count = (end - origin) // period_us + 1
    if count < 1 or count > 1000000:
        raise ValueError('no bounded common native time interval')
    grid = np.full((count, 4, 3), np.nan)
    missing = []
    for i, (times, values) in enumerate(adjusted):
        delta = times - origin
        if np.any(delta % period_us):
            raise ValueError('sensor clocks do not occupy the same native grid')
        index = delta // period_us
        keep = (index >= 0) & (index < count)
        if len(np.unique(index[keep])) != int(keep.sum()):
            raise ValueError('duplicated source-native timestamp')
        grid[index[keep], i] = values[keep]
        missing.append(count - int(keep.sum()))
    return grid, {'native_period_us': period_us, 'common_samples': count,
                  'duration_seconds': (count - 1) * period_us / 1e6,
                  'missing_samples_by_sensor': missing, 'interpolated_samples': 0}


def shift_sensor(values, shift):
    result = np.full_like(values, np.nan)
    if shift == 0:
        return values.copy()
    if shift > 0:
        result[:-shift] = values[shift:]
    else:
        result[-shift:] = values[:shift]
    return result


def clock_diagnostic(grid, dt):
    start, end = int(round(10 / dt)), int(round(25 / dt))
    bound = int(round(1 / dt))
    reference = grid[start:end, 0]
    reference = reference - np.nanmean(reference, axis=0)
    offsets, strengths = [0], [1.0]
    for sensor in range(1, 4):
        candidates = []
        for offset in range(-bound, bound + 1):
            candidate = grid[start + offset:end + offset, sensor]
            candidate = candidate - np.nanmean(candidate, axis=0)
            good = np.isfinite(reference).all(axis=1) & np.isfinite(candidate).all(axis=1)
            a, b = reference[good], candidate[good]
            denom = np.sqrt(np.sum(a * a) * np.sum(b * b))
            score = float(np.sum(a * b) / denom) if denom > 0 else -1.0
            candidates.append((score, -abs(offset), -offset, offset))
        best = max(candidates)
        offsets.append(best[-1]); strengths.append(best[0])
    return offsets, strengths


def transformed(grid, calibration, representation):
    centered = grid - np.array(calibration['bias_dps'])
    if representation == 'native_axes':
        return centered
    result = np.empty_like(centered)
    for sensor in range(4):
        shifted = shift_sensor(centered[:, sensor], calibration['training_integer_offsets'][sensor])
        result[:, sensor] = shifted @ np.array(calibration['rotations'][sensor]) * calibration['scales'][sensor]
    return result


def moments(grid, dt, lags):
    """Second moments about the frozen calibration center, not block demeaning."""
    block_size = int(round(20 / dt))
    first = int(np.ceil(40 / dt))
    stop = len(grid) - int(np.ceil(20 / dt))
    pair_blocks, self_blocks, means, counts = [], [], [], []
    for start in range(first, stop - block_size + 1, block_size):
        values = grid[start:start + block_size, :, 2]
        contrasts = np.stack([values[:, i] - values[:, j] for i, j in PAIRS], axis=1)
        pair_moments, single_moments, pair_counts = [], [], []
        for lag in lags:
            if lag:
                a, b = contrasts[:-lag], contrasts[lag:]
                x, y = values[:-lag], values[lag:]
            else:
                a = b = contrasts; x = y = values
            valid = np.isfinite(a) & np.isfinite(b)
            if np.any(valid.sum(axis=0) < 0.95 * len(a)):
                raise ValueError('more than five percent missing products within a native block')
            pair_moments.append(np.nanmean(a * b, axis=0))
            single_moments.append(np.nanmean(x * y, axis=0))
            pair_counts.append(valid.sum(axis=0))
        pair_blocks.append(np.array(pair_moments).T)
        self_blocks.append(np.array(single_moments).T)
        means.append(np.nanmean(contrasts, axis=0))
        counts.append(np.array(pair_counts).T)
    if len(pair_blocks) < 3:
        raise ValueError('fewer than three complete post-prefix 20-second blocks')
    return {'pair': np.array(pair_blocks), 'single': np.array(self_blocks),
            'mean': np.array(means), 'counts': np.array(counts)}


def fit_curve(curve, lag_seconds, family):
    """Analytic coefficient fits on a frozen tau grid, with explicit boundaries."""
    lag_seconds = np.array(lag_seconds)
    delta = (lag_seconds == 0).astype(float)
    if family == 'iid':
        coefficient = max(float(curve[0]), 0.0)
        return coefficient * delta, {'white_variance_dps2': coefficient, 'colored_variance_dps2': 0., 'tau_seconds': 0., 'grid_candidates': 1}
    tau_grid = np.geomspace(lag_seconds[1] / 2, 10., 257)
    best = None
    for tau in tau_grid:
        basis = np.exp(-lag_seconds / tau)
        candidates = [(0., max(float(curve @ basis / (basis @ basis)), 0.))]
        if family == 'white_ou':
            b = max(float(curve[1:] @ basis[1:] / (basis[1:] @ basis[1:])), 0.)
            a = float(curve[0] - b)
            if a >= 0:
                candidates.append((a, b))
            candidates.append((max(float(curve[0]), 0.), 0.))
        for white, colored in candidates:
            prediction = white * delta + colored * basis
            error = float(np.mean((curve - prediction) ** 2))
            if best is None or error < best[0]:
                best = (error, prediction, white, colored, float(tau))
    return best[1], {'white_variance_dps2': best[2], 'colored_variance_dps2': best[3],
                     'tau_seconds': best[4], 'grid_candidates': 257}


def fit_models(pair_covariance, single_covariance, lag_seconds):
    conditional = COLLOCATION @ pair_covariance
    models = {}
    for name, family, curves in [('iid', 'iid', conditional), ('ou', 'ou', conditional),
                                  ('white_ou', 'white_ou', conditional), ('naive_motion_ou', 'ou', single_covariance)]:
        fitted = [fit_curve(curve, lag_seconds, family) for curve in curves]
        sensor_prediction = np.array([row[0] for row in fitted])
        models[name] = {'parameters': [row[1] for row in fitted],
                        'pair_prediction_dps2': INCIDENCE @ sensor_prediction}
    return conditional, models


def collocation_report(pair_covariance):
    estimates = COLLOCATION @ pair_covariance
    triplets = []
    for sensor in range(4):
        values = []
        for j, k in itertools.combinations([x for x in range(4) if x != sensor], 2):
            ij = PAIRS.index(tuple(sorted((sensor, j))))
            ik = PAIRS.index(tuple(sorted((sensor, k))))
            jk = PAIRS.index(tuple(sorted((j, k))))
            values.append((pair_covariance[ij] + pair_covariance[ik] - pair_covariance[jk]) / 2)
        triplets.append(values)
    return {'conditional_sensor_covariance_dps2': estimates,
            'triplet_sensor_covariance_dps2': triplets,
            'negative_lag_zero_sensor_ids': [SENSORS[i] for i in range(4) if estimates[i, 0] < 0],
            'six_pair_reconstruction_residual_dps2': pair_covariance - INCIDENCE @ estimates}


def train(root, output):
    split, hashes = metadata(root)
    streams = [read_record(root, split, r) for r in split['train']]
    period_us = int(np.median([np.median(np.diff(t)) for record in streams for t, _ in record]))
    dt = period_us / 1e6
    grids_and_info = [native_grid(record, period_us) for record in streams]
    grids = [entry[0] for entry in grids_and_info]
    biases = [np.nanmean(grid[int(2 / dt):int(12 / dt)], axis=0) for grid in grids]
    bias = np.mean(biases, axis=0)
    diagnostics = [clock_diagnostic(grid - bias, dt) for grid in grids]
    offsets = np.rint(np.median([d[0] for d in diagnostics], axis=0)).astype(int)
    rotations, scales = [np.eye(3)], [1.]
    corrected = [[shift_sensor(grid[:, sensor] - bias[sensor], offsets[sensor])[int(10 / dt):int(25 / dt)] for grid in grids] for sensor in range(4)]
    reference = np.concatenate(corrected[0])
    for sensor in range(1, 4):
        candidate = np.concatenate(corrected[sensor])
        good = np.isfinite(candidate).all(axis=1) & np.isfinite(reference).all(axis=1)
        x, y = candidate[good], reference[good]
        u, singular_values, vh = np.linalg.svd(x.T @ y)
        rotation = u @ np.diag([1., 1., np.linalg.det(u @ vh)]) @ vh
        scale = float(np.sum((x @ rotation) * y) / np.sum(x * x))
        rotations.append(rotation); scales.append(scale)
    calibration = {'native_period_us': period_us, 'bias_dps': bias,
                   'training_integer_offsets': offsets, 'rotations': rotations, 'scales': scales,
                   'training_clock_diagnostics': [{'recording': r['name'], 'best_integer_offsets': d[0], 'normalized_shake_correlations': d[1]} for r, d in zip(split['train'], diagnostics)],
                   'calibration_is_physical_truth': False}
    lags = sorted(set(list(range(25)) + [int(round(seconds / dt)) for seconds in [.5, 1., 2.]]))
    report = {'schema': 'worldlaw.magfid-covariance-model.v1', **hashes,
              'estimator_source_sha256': source_sha(), 'training_recordings': [r['name'] for r in split['train']],
              'calibration': calibration, 'lags_native_samples': lags, 'lag_seconds': np.array(lags) * dt,
              'unit': 'degrees/second', 'covariance_unit': '(degrees/second)^2',
              'moment_center': 'fixed training-only initial stationary-prefix bias; no per-block demeaning',
              'representations': {}, 'absolute_sensor_calibration': False,
              'planner_input_eligible': False,
              'budget_comparison': 'OU and naive-motion OU use the identical four-series 257-candidate fitter and predictions, after shared moment extraction. IID and white-plus-OU are additional complexity controls; no equal-FLOP claim is made for those two.'}
    for representation in ['native_axes', 'training_rigid_alignment']:
        data = [moments(transformed(grid, calibration, representation), dt, lags) for grid in grids]
        pair_cov = np.mean([record['pair'].mean(axis=0) for record in data], axis=0)
        single_cov = np.mean([record['single'].mean(axis=0) for record in data], axis=0)
        conditional, models = fit_models(pair_cov, single_cov, np.array(lags) * dt)
        report['representations'][representation] = {'models': models,
            'mean_training_pair_covariance_dps2': pair_cov, **collocation_report(pair_cov),
            'training_records': [{'name': r['name'], **info, 'blocks': len(data[i]['pair']),
                                  'mean_contrast_dps': data[i]['mean'].mean(axis=0)}
                                 for i, (r, (_, info)) in enumerate(zip(split['train'], grids_and_info))]}
    digest = write_json(output, report)
    print(json.dumps({'model_sha256': digest, 'train_recordings': len(grids), 'period_us': period_us,
                      'training_integer_offsets': offsets.tolist(), 'held_out_measurements_opened': False}))


def bootstrap_records(data, draws, seed):
    """Resample recordings, then contiguous 20-second blocks within each draw."""
    rng = np.random.default_rng(seed)
    sample = np.empty((draws, len(data), *data[0]['pair'].shape[1:]))
    for draw in range(draws):
        selected = rng.integers(0, len(data), len(data))
        for position, record_id in enumerate(selected):
            blocks = data[record_id]['pair']
            index = rng.integers(0, len(blocks), len(blocks))
            sample[draw, position] = blocks[index].mean(axis=0)
    return sample


def evaluate_moments(data, models, train_variance, seed, draws):
    per_record = np.array([record['pair'].mean(axis=0) for record in data])
    mean_cov = per_record.mean(axis=0)
    boot_records = bootstrap_records(data, draws, seed)
    boot = boot_records.mean(axis=1)
    stderr = boot.std(axis=0, ddof=1)
    safe_stderr = np.maximum(stderr, np.maximum(np.abs(mean_cov), 1.) * 1e-14)
    maximum = np.max(np.abs((boot - mean_cov) / safe_stderr), axis=(1, 2))
    multiplier = float(np.quantile(maximum, .95))
    halfwidth = multiplier * safe_stderr
    all_scores, bootstrap_scores = {}, {}
    normalizable = bool(np.all(per_record[:, :, 0] > 0) and np.all(boot_records[:, :, :, 0] > 0))
    for name, model in models.items():
        prediction = np.array(model['pair_prediction_dps2'])
        if normalizable:
            denom = per_record[:, :, :1] ** 2
            error_by_record = np.mean((per_record - prediction) ** 2 / denom, axis=(1, 2))
            boot_denom = boot_records[:, :, :, :1] ** 2
            boot_score = np.mean((boot_records - prediction) ** 2 / boot_denom, axis=(1, 2, 3))
            bootstrap_scores[name] = boot_score
            score, interval = float(error_by_record.mean()), np.quantile(boot_score, [.025, .975])
        else:
            error_by_record, score, interval = None, None, None
        ratios = [float(p / actual) if actual > 0 else None for p, actual in zip(prediction[:, 0], mean_cov[:, 0])]
        residual = mean_cov - prediction
        positive = bool(np.all(np.asarray(train_variance) > 0))
        variance_gate = all(ratio is not None and abs(ratio - 1.) <= .25 for ratio in ratios)
        band_gate = bool(np.all(np.abs(residual) <= halfwidth))
        all_scores[name] = {'normalized_covariance_mse': score,
            'normalization_status': 'defined' if normalizable else 'undefined_zero_contrast_variance',
            'recording_scores': error_by_record, 'bootstrap_95_percent_interval': interval,
            'lag_zero_prediction_to_observation_ratio': ratios,
            'positive_training_variance_gate': positive, 'lag_zero_ratio_gate': variance_gate,
            'simultaneous_residual_band_gate': band_gate,
            'conditional_contrast_fit': normalizable and positive and variance_gate and band_gate,
            'absolute_sensor_calibration': False, 'planner_input_eligible': False}
    for name in all_scores:
        all_scores[name]['paired_error_difference_from_ou_95_interval'] = np.quantile(bootstrap_scores[name] - bootstrap_scores['ou'], [.025, .975]) if normalizable else None
    sensor_boot = np.einsum('ij,bjk->bik', COLLOCATION, boot)
    return {'mean_pair_covariance_dps2': mean_cov, 'per_record_pair_covariance_dps2': per_record,
            'mean_pair_difference_dps': np.mean([r['mean'].mean(axis=0) for r in data], axis=0),
            'simultaneous_95_percent_covariance_halfwidth': halfwidth,
            'bootstrap_simultaneous_multiplier': multiplier,
            'conditional_sensor_covariance_95_percent_interval': np.quantile(sensor_boot, [.025, .975], axis=0),
            'model_scores': all_scores, **collocation_report(mean_cov)}


def perturb(grid, kind, dt, common_sigma, seed):
    result = grid.copy()
    if kind == 'desync_0.1_seconds':
        result[:, 3] = shift_sensor(result[:, 3], int(round(.1 / dt)))
    elif kind == 'axis_swap':
        result[:, 3, 2] = result[:, 3, 0]
    elif kind == 'duplicated_sensor':
        result[:, 3] = result[:, 2]
    elif kind == 'shared_colored_error':
        rng = np.random.default_rng(seed)
        rho = np.exp(-dt / .8)
        innovation = rng.normal(0, common_sigma * np.sqrt(1 - rho * rho), len(result))
        error = np.empty(len(result)); error[0] = rng.normal(0, common_sigma)
        for i in range(1, len(error)):
            error[i] = rho * error[i - 1] + innovation[i]
        result[:, :, 2] += error[:, None]
    return result


def evaluate(root, model_path, partition, output, freeze_path, draws):
    split, hashes = metadata(root)
    model_bytes = Path(model_path).read_bytes()
    model = json.loads(model_bytes)
    if any(model[key] != value for key, value in hashes.items()):
        raise ValueError('model does not belong to the frozen source split')
    if model['estimator_source_sha256'] != source_sha():
        raise ValueError('estimator changed since model training')
    if partition == 'test':
        freeze = json.loads(Path(freeze_path).read_text())
        if freeze['model_sha256'] != sha(model_bytes) or freeze['estimator_source_sha256'] != source_sha():
            raise ValueError('test requires the exact prospectively frozen model and estimator')
    calibration = model['calibration']
    period_us = calibration['native_period_us']; dt = period_us / 1e6
    records = split[partition]
    grids_and_info = [native_grid(read_record(root, split, record), period_us) for record in records]
    receipt = {'schema': 'worldlaw.magfid-covariance-evaluation.v1', **hashes,
        'partition': partition, 'recordings': [r['name'] for r in records],
        'model_sha256': sha(model_bytes), 'estimator_source_sha256': source_sha(),
        'bootstrap_draws': draws, 'unit': 'degrees/second', 'representations': {},
        'absolute_sensor_calibration': False, 'planner_input_eligible': False,
        'native_clock_receipts': [info for _, info in grids_and_info]}
    for representation, fit in model['representations'].items():
        grid_values = [transformed(grid, calibration, representation) for grid, _ in grids_and_info]
        train_variance = np.array(fit['conditional_sensor_covariance_dps2'])[:, 0]
        common_sigma = 3 * np.sqrt(max(float(np.median(np.maximum(train_variance, 0))), 1e-12))
        variants = {}
        for kind in ['unmodified', 'desync_0.1_seconds', 'axis_swap', 'duplicated_sensor', 'shared_colored_error']:
            changed = [perturb(grid, kind, dt, common_sigma, SEED + i) for i, grid in enumerate(grid_values)]
            data = [moments(grid, dt, model['lags_native_samples']) for grid in changed]
            summary = evaluate_moments(data, fit['models'], train_variance, SEED + (17 if partition == 'test' else 0), draws)
            summary['recording_block_counts'] = [len(d['pair']) for d in data]
            summary['duplicate_channel_detected'] = bool(any(np.array_equal(grid[:, 2], grid[:, 3], equal_nan=True) for grid in changed))
            if summary['duplicate_channel_detected']:
                for score in summary['model_scores'].values():
                    score['conditional_contrast_fit'] = False
            if kind == 'shared_colored_error':
                original = np.array(variants['unmodified']['mean_pair_covariance_dps2'])
                summary['injected_common_sigma_dps'] = common_sigma
                summary['injected_common_tau_seconds'] = .8
                summary['largest_contrast_covariance_change_dps2'] = float(np.max(np.abs(original - summary['mean_pair_covariance_dps2'])))
            variants[kind] = summary
        receipt['representations'][representation] = variants
    digest = write_json(output, receipt)
    print(json.dumps({'evaluation_sha256': digest, 'partition': partition,
        'model_scores': {r: {k: v['normalized_covariance_mse'] for k, v in variants['unmodified']['model_scores'].items()} for r, variants in receipt['representations'].items()},
        'absolute_sensor_calibration': False}))


def freeze(model_path, validation_path, output):
    model_bytes = Path(model_path).read_bytes(); model = json.loads(model_bytes)
    validation_bytes = Path(validation_path).read_bytes(); validation = json.loads(validation_bytes)
    if validation['partition'] != 'validation' or validation['model_sha256'] != sha(model_bytes):
        raise ValueError('model and validation receipt do not match')
    if model['estimator_source_sha256'] != source_sha():
        raise ValueError('estimator changed before final freeze')
    receipt = {'model_sha256': sha(model_bytes), 'validation_sha256': sha(validation_bytes),
               'estimator_source_sha256': source_sha(), 'frozen_at_unix_seconds': time.time(),
               'test_measurements_opened': False, 'models_selected_after_test': False}
    print(json.dumps({'freeze_sha256': write_json(output, receipt)}))


def selftest():
    # Exact independent component covariance, including unequal sensor memories.
    lag_seconds = np.array([0., .1, .2, .5])
    truth = np.array([variance * np.exp(-lag_seconds / tau) for variance, tau in [(1., .2), (2., .3), (3., .5), (4., 1.)]])
    observed_pairs = INCIDENCE @ truth
    np.testing.assert_allclose(COLLOCATION @ observed_pairs, truth, rtol=1e-12, atol=1e-12)
    # Shared physical error is exactly in the contrast operator's nullspace.
    values = np.arange(48, dtype=float).reshape(12, 4)
    common = np.sin(np.arange(12)) * 13
    for i, j in PAIRS:
        np.testing.assert_allclose((values + common[:, None])[:, i] - (values + common[:, None])[:, j], values[:, i] - values[:, j], atol=1e-12)
    # Clock gaps preserve their original cells and are not silently interpolated.
    streams = [(np.arange(10, dtype=np.int64) * 8333, np.ones((10, 3)) * i) for i in range(4)]
    streams[2] = (np.delete(streams[2][0], 4), np.delete(streams[2][1], 4, axis=0))
    grid, info = native_grid(streams, 8333)
    assert np.isnan(grid[4, 2]).all() and info['missing_samples_by_sensor'][2] == 1
    # An exact white-plus-colored covariance is recovered on the fixed grid.
    seconds = np.r_[np.arange(25) * .01, .5, 1., 2.]
    tau = np.geomspace(.005, 10., 257)[160]
    expected = 2 * np.exp(-seconds / tau); expected[0] += 3
    fitted, parameters = fit_curve(expected, seconds, 'white_ou')
    np.testing.assert_allclose(fitted, expected, atol=1e-12)
    assert abs(parameters['white_variance_dps2'] - 3) < 1e-12
    # A duplicated physical channel has zero contrast variance: its normalized
    # score is undefined, not an invented finite number from an epsilon floor.
    blocks = np.ones((3, 6, 4)); blocks[:, -1, :] = 0
    sample = [{'pair': blocks, 'mean': np.zeros((3, 6))} for _ in range(2)]
    outcome = evaluate_moments(sample, {'ou': {'pair_prediction_dps2': np.ones((6, 4))}}, np.ones(4), SEED, 16)
    assert outcome['model_scores']['ou']['normalized_covariance_mse'] is None
    assert outcome['model_scores']['ou']['conditional_contrast_fit'] is False
    print(json.dumps({'scientific_controls': 5, 'passed': True, 'estimator_source_sha256': source_sha()}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('selftest')
    train_parser = sub.add_parser('train'); train_parser.add_argument('--data', required=True); train_parser.add_argument('--output', required=True)
    evaluate_parser = sub.add_parser('evaluate')
    evaluate_parser.add_argument('--data', required=True); evaluate_parser.add_argument('--model', required=True)
    evaluate_parser.add_argument('--partition', choices=['validation', 'test'], required=True)
    evaluate_parser.add_argument('--output', required=True); evaluate_parser.add_argument('--freeze')
    evaluate_parser.add_argument('--draws', type=int, default=2000)
    freeze_parser = sub.add_parser('freeze'); freeze_parser.add_argument('--model', required=True)
    freeze_parser.add_argument('--validation', required=True); freeze_parser.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.command == 'selftest':
        selftest()
    elif args.command == 'train':
        train(args.data, args.output)
    elif args.command == 'freeze':
        freeze(args.model, args.validation, args.output)
    else:
        if args.partition == 'test' and not args.freeze:
            parser.error('test requires --freeze')
        if args.draws != 2000:
            parser.error('the prospectively frozen study requires 2000 bootstrap draws')
        evaluate(args.data, args.model, args.partition, args.output, args.freeze, args.draws)


if __name__ == '__main__':
    main()
