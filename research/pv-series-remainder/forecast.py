"""Construct frozen aggregate-remainder forecasts without reading final voltages."""
import argparse
import hashlib
import io
import json
import re
import time
import zipfile
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from pvlib.singlediode import bishop88
from string_model import acquisition_features, estimator, fit_components, primary_and_controls

ARCHIVE_SHA = 'e08ab75a76e5234fce9d55220cbb75531bdcd70aa3ce9749cd190648b2bfb9fb'
ARMS = ('component_profile', 'bishop_sum', 'pooled_profile', 'direct_tree',
        'pooled_residual_tree', 'bishop_residual_tree', 'component_residual_tree')
DEVELOPMENT = {8, 12, 16, 20}
FINAL = {4}


def load_selected(z, name, variables):
    result = loadmat(io.BytesIO(z.read(name)), variable_names=list(variables))
    if {k for k in result if not k.startswith('_')} != set(variables):
        raise ValueError(f'variable contract mismatch: {name}')
    return {k: np.asarray(result[k], float).ravel() for k in variables}


def forecast(blob, output, stage):
    if hashlib.sha256(blob).hexdigest() != ARCHIVE_SHA:
        raise ValueError('dataset checksum mismatch')
    start = time.perf_counter()
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        train_panels = {}
        for name in sorted(z.namelist()):
            m = re.search(r'/Processed Data/Test 1/MP(\d+)_Irr[123]\.mat$', name)
            if not m:
                continue
            d = load_selected(z, name, ('I', 'V', 'Irr', 'T'))
            if not np.isfinite(np.concatenate(list(d.values()))).all():
                raise ValueError(f'nonfinite historical curve: {name}')
            train_panels.setdefault(int(m[1]), []).append((d['I'], d['V'], d['Irr'].item(), d['T'].item()))
        if set(train_panels) != set(range(1, 21)) - FINAL or any(len(v) != 3 for v in train_panels.values()):
            raise ValueError('component roster mismatch')
        models = fit_components(train_panels)
        runs = []
        training_rows = []
        out_ids = DEVELOPMENT if stage == 'development' else FINAL
        for name in sorted(z.namelist()):
            m = re.search(r'/Raw Data/Test 3/MP(\d+)_(NS|S1|S2)\.mat$', name)
            if not m:
                continue
            panel, condition = int(m[1]), m[2]
            if stage == 'development' and panel in FINAL:
                continue
            training = panel not in out_ids
            vars_in = ('I', 'Irr', 'T', 'V', 'Va') if training else ('I', 'Irr', 'T')
            d = load_selected(z, name, vars_in)
            I = d['I']
            valid = np.isfinite(I)
            if not training and not np.all(valid):
                raise ValueError(f'nonfinite compulsory forecast input: {name}')
            work_current = np.where(valid, I, 0.)
            g, temp = d['Irr'].item(), d['T'].item()
            direct, bishop, pooled = primary_and_controls(models, panel, work_current, g, temp, bishop88)
            features = acquisition_features(work_current, g, temp, condition)
            if training:
                y = d['Va'] - d['V']
                valid &= np.isfinite(y)
                training_rows.append((name, len(I), int(valid.sum())))
                runs.append((True, name, features[valid], y[valid], direct[valid], bishop[valid], pooled[valid]))
            else:
                runs.append((False, name, features, None, direct, bishop, pooled))

    training = [r for r in runs if r[0]]
    tests = [r for r in runs if not r[0]]
    expected = (40, 12) if stage == 'development' else (52, 3)
    if (len(training), len(tests)) != expected:
        raise ValueError(f'split count mismatch: {len(training)},{len(tests)}')
    X = np.concatenate([r[2] for r in training])
    Y, direct, bishop, pooled = [np.concatenate([r[j] for r in training]) for j in (3, 4, 5, 6)]
    # Equal total weight per training run, including nine 1001st nonfinite current entries.
    weights = np.concatenate([np.full(len(r[2]), len(X) / (len(training) * len(r[2]))) for r in training])
    trained = [estimator().fit(X, target, sample_weight=weights)
               for target in [Y, Y - pooled, Y - bishop, Y - direct]]
    preds = {}
    metadata = {}
    for _, name, x, _, direct, bishop, pooled in tests:
        pred = [direct, bishop, pooled, trained[0].predict(x), pooled + trained[1].predict(x),
                bishop + trained[2].predict(x), direct + trained[3].predict(x)]
        key = Path(name).stem
        preds[key] = np.stack(pred)
        if not np.isfinite(preds[key]).all():
            raise ValueError(f'nonfinite forecast: {key}')
        metadata[key] = {arm: hashlib.sha256(p.astype('<f8').tobytes()).hexdigest()
                         for arm, p in zip(ARMS, pred)}
    output.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(output/'forecasts.npz', **preds)
    manifest = {'stage': stage, 'archive_sha256': ARCHIVE_SHA, 'arms': list(ARMS),
                'prediction_hashes': metadata, 'training_rows': training_rows,
                'fit_seconds': time.perf_counter() - start,
                'bishop_fits': {j: {'parameters': f[1].tolist(), 'nfev': f[2], 'status': f[3]}
                                for j, f in models.items()}}
    (output/'manifest.json').write_text(json.dumps(manifest, sort_keys=True, indent=2))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('zip', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('stage', choices=('development', 'final'))
    args = parser.parse_args()
    forecast(args.zip.read_bytes(), args.output, args.stage)
