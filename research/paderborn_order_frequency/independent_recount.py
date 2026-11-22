"""Recount frozen forecasts from the original arrays using extended-precision arithmetic."""
import argparse
import collections
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
from independent_controls import training_reference, control_surfaces


def file_sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def expected_mask():
    # Integer arithmetic in units of 1/128 Hz at the fixed upper rotation speed.
    twice_center = np.arange(257)[:, None] * 125 * 128
    cyclic = np.arange(1281)[None, :] * 30
    return (cyclic > 0) & (twice_center >= cyclic) & (twice_center + cyclic <= 32000 * 128)


def convert(arr):
    value = np.asarray(arr)
    if value.shape != (257, 1281) or not np.isfinite(value).all():
        raise ValueError('Nonfinite or incomplete surface')
    return value.astype(np.longdouble)


def quantify(root, expected):
    proto_path = Path(__file__).with_name('protocol.json')
    if file_sha(proto_path) != '86a79d999e515483f67aa28cc5f277d2d6c009f6039a87ec9cf6dfddfa2fefd8':
        raise ValueError('Independent receiver requires the reviewed immutable protocol')
    proto = json.loads(proto_path.read_text())
    forecast = root / 'forecasts.zip'
    if file_sha(forecast) != expected:
        raise ValueError('Original forecast byte mismatch')
    measured = json.loads((root / 'scores.json').read_text())
    if measured['forecast_sha'] != expected:
        raise ValueError('Score source mismatch')
    mask = expected_mask()
    assert mask.sum() == measured['cells_per_bearing'] == 324478
    totals = collections.defaultdict(list)
    wins = collections.Counter()
    max_worst = ('', -1.)
    duplicate_groups = {}
    checked = 0
    control_cells = 0
    peak_control_disagreement = 0.
    residual_digests = {}
    def agree(x, y):
        np.testing.assert_allclose(float(x), y, rtol=3e-12, atol=1e-30)
    with zipfile.ZipFile(forecast) as z:
        lock = json.loads(z.read('lock.json'))
        expected_names = {'lock.json'} | {f'{b}/{r}.npy' for b in proto['held'] for r in proto['roles']}
        if set(z.namelist()) != expected_names or len(z.namelist()) != len(expected_names):
            raise ValueError('Forecast member census differs from the frozen design')
        assert lock['protocol_sha256'] == file_sha(proto_path) and lock['held_low_files_read'] == 0
        assert set(lock['training_arrays']) == set(proto['development'] + proto['healthy'])
        assert set(lock['held']) == set(lock['source_hashes']) == set(proto['held'])
        assert all(set(x)==set(proto['roles']) for x in lock['held'].values())
        references = training_reference(root, proto, lock)
        for ident in proto['held']:
            info, truth = {}, {}
            for stage, condition in [('high_only', 'N15_M07_F10'), ('held_low', 'N09_M07_F10')]:
                f = root / stage / f'{ident}.npz'
                expected_sha = measured['worsts'][ident]['high_sha' if stage == 'high_only' else 'low_sha']
                assert expected_sha == file_sha(f)
                if stage == 'high_only':
                    assert expected_sha == lock['source_hashes'][ident]
                with np.load(f, allow_pickle=False) as src:
                    truth[stage] = convert(src[condition + '_surface'])
                    info[stage] = json.loads(src['receipt'].item())['conditions'][condition]
                assert sorted(r['rep'] for r in info[stage]) == list(range(1, 21))
                groups = collections.defaultdict(list)
                for rec in info[stage]:
                    groups[rec['vibration_sha256']].append(rec['rep'])
                duplicate_groups[ident + '/' + stage] = [ids for ids in groups.values() if len(ids) > 1]
            for stage, name in [('high_only', 'rpm_hi'), ('held_low', 'rpm_low')]:
                agree(np.mean([np.longdouble(i['rpm_hz'])*60 for i in info[stage]]),measured['metadata'][ident][name])
            lo = truth['held_low'][mask]
            hi = truth['high_only'][mask]
            denom = np.dot(hi, hi) / len(hi)
            agree(denom, measured['metadata'][ident]['source_mean_squared_amplitude'])
            agree(lo.mean(), measured['metadata'][ident]['target_mean'])
            row = {}
            # Match the binary64 acquisition summary used for the fixed high-speed coordinate.
            # A differently rounded speed could cross an exact fallback boundary.
            shaft = float(np.mean([record['rpm_hz'] for record in info['high_only']]))
            controls = control_surfaces(truth['high_only'], np.longdouble(shaft), references)
            if set(controls) != set(proto['roles']) - {'trained_frequency_ridge','trained_cell_mixed_center','trained_cell_sideband_gain'}:
                raise ValueError('Unexpected simple-control census')
            residual_digests[ident] = {}
            for role in proto['roles']:
                raw = z.read(ident + '/' + role + '.npy')
                assert hashlib.sha256(raw).hexdigest() == lock['held'][ident][role]
                pred = convert(np.load(io.BytesIO(raw), allow_pickle=False))
                if role in controls:
                    original = pred
                    reconstructed = controls[role]
                    # Derivation uses alternate arithmetic; scale cancellation by the common amplitude.
                    scale = max(float(np.max(np.abs(original))),float(np.max(np.abs(truth['high_only']))),
                                float(np.max(np.abs(references['healthy_hi']))),float(np.max(np.abs(references['healthy_lo']))),
                                float(np.max(np.abs(references['damage_lo']))),np.finfo(float).tiny)
                    difference = float(np.max(np.abs(original-reconstructed))) / scale
                    if difference > 1e-10:
                        raise ValueError(f'Independent control differs for {ident}/{role}: {difference}')
                    peak_control_disagreement = max(peak_control_disagreement, difference)
                    control_cells += original.size
                error = pred[mask] - lo
                residual_digests[ident][role] = hashlib.sha256(np.asarray(error,dtype='<f8').tobytes()).hexdigest()
                mse = np.dot(error, error) / len(error)
                row[role] = mse / denom
                agree(np.sqrt(mse), measured['metadata'][ident]['raw_surface_rmse'][role])
                agree(row[role], measured['per_bearing'][ident][role])
                totals[role].append(row[role])
                raw_location = tuple(measured['worsts'][ident]['cell'])
                agree(pred[raw_location], measured['worsts'][ident]['all_predictions'][role])
                if role == proto['candidate']:
                    flat = int(np.flatnonzero(mask.ravel())[np.argmax(np.abs(error))])
                    coord = np.unravel_index(flat, mask.shape)
                    assert list(coord) == measured['worsts'][ident]['cell']
                    raw_worst = measured['worsts'][ident]
                    agree(truth['held_low'][coord], raw_worst['target'])
                    agree(truth['high_only'][coord], raw_worst['source'])
                    assert raw_worst['carrier_Hz'] == int(coord[0]) * 125
                    assert raw_worst['order'] == int(coord[1]) / 64
                    value = float(np.abs(error).max() / np.sqrt(denom))
                    agree(value, measured['worsts'][ident]['normalized_absolute_error'])
                    if value > max_worst[1]:
                        max_worst = (ident, value)
                checked += 1
            for role, value in row.items():
                if role != proto['candidate']:
                    wins[role] += int(row[proto['candidate']] < value)
    assert checked == 238 and control_cells == 14*14*257*1281
    assert max_worst[0] == measured['worst_id'] and dict(wins) == measured['wins']
    mean = {r: np.mean(v) for r, v in totals.items()}
    for role, value in mean.items():
        agree(value, measured['means'][role])
    gate = all(mean[proto['candidate']] < mean[r] and wins[r] >= 8 for r in wins)
    assert bool(gate) == measured['gate']
    return {'whole_forecast_sha256': expected, 'whole_score_sha256': file_sha(root / 'scores.json'),
            'verified_predictions': checked, 'physical_units': len(proto['held']),
            'positive_cells_per_unit': int(mask.sum()), 'worst_bearing': max_worst[0],
            'worst_normalized_absolute_error': max_worst[1], 'gate': bool(gate),
            'duplicate_vibration_groups': duplicate_groups, 'positive_cell_residuals_verified': int(mask.sum()) * checked,
            'individual_float64_residual_vector_sha256': residual_digests,
            'reconstructed_algebraic_forecast_cells':control_cells,
            'max_reconstructed_control_scaled_difference':peak_control_disagreement}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path)
    parser.add_argument('forecast_sha')
    args = parser.parse_args()
    print(json.dumps(quantify(args.root, args.forecast_sha), indent=2, sort_keys=True))
