"""Forecast and score the registered transfer. Input ZIP contains public member bytes."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np

from model import ANGLES, ARMS, SCHEMES, STATIC_ALIASES, forecast, projections, supported


def digest(data):
    return hashlib.sha256(data).hexdigest()


def coeff(angle):
    return str(int(angle))


def write(path, obj):
    path.write_text(json.dumps(obj, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n')


def member(z, basename):
    names = [name for name in z.namelist() if name.split('/')[-1] == basename]
    if len(names) != 1:
        raise ValueError(f'Expected one source member for {basename}: {names}')
    return z.read(names[0])


def read_source(z, shape, trip, p):
    code = 'NACA0012' + ('T' if trip == 'tripped' else '') + ('R' if shape == 'rounded' else 'F')
    data = member(z, f'{code}p{p}.txt')
    y = np.loadtxt(io.BytesIO(data))
    columns = (0, 1, 2, 3) if shape == 'rounded' else (0, 2, 4, 7)
    expected = (21, 4 if shape == 'rounded' else 8)
    if y.shape != expected:
        raise ValueError(f'Expected {expected}, got {y.shape} for {code}p{p}')
    return y[:, columns], digest(data)


def bands(z):
    f = np.loadtxt(io.BytesIO(member(z, 'OnethirdOctaveband_freq.txt'))).reshape(-1)
    if len(f) != 21 or np.any(np.diff(f) <= 0) or not np.isfinite(f).all():
        raise ValueError('Invalid released band grid')
    main = supported(f)
    if main.sum() != 11:
        raise ValueError('Registered support has 11 bands')
    return f, {'primary': main, 'all21': np.ones(len(f), dtype=bool)}


def predict(z, target):
    if target not in (6, 9):
        raise ValueError('Unregistered target')
    f, domains = bands(z)
    hist, source = {}, {}
    for trip in SCHEMES:
        for shape in ('rounded', 'flat'):
            for p in range(1, target + (shape == 'flat')):
                y, sha = read_source(z, shape, trip, p)
                source[f'{shape}/{trip}/{p}'] = sha
                for j, angle in enumerate(ANGLES):
                    hist[shape, trip, angle, p] = y[:, j]
    audits = {}
    for name, keep in domains.items():
        sub = {k: v[keep] for k, v in hist.items()}
        nonfinite = {str(k): int((~np.isfinite(v)).sum()) for k, v in sub.items() if not np.all(np.isfinite(v))}
        if nonfinite:
            audits[name] = {'source_refusal': nonfinite}
            continue
        rows = forecast(sub, f[keep], target)
        audits[name] = {'frequencies': f[keep].tolist(), 'centered_predictions': {
            f'{trip}/{coeff(a)}': mat.tolist() for (trip, a), mat in rows.items()}}
    return {'target_index': target, 'arms': ARMS, 'forecast_input_sha256': source, 'domains': audits}


def summarize(rows, metric, arms, nonzero=True):
    cells = [r for r in rows if (r['angle'] != 0 or not nonzero)]
    return {a: {'mean': float(np.mean([r[metric][a] for r in cells])),
                'worst': float(max(r[metric][a] for r in cells))} for a in arms}


def assess(z, prediction):
    p = prediction['target_index']
    if p not in (6, 9) or tuple(prediction['arms']) != ARMS:
        raise ValueError('Prediction roster mismatch')
    f, domains = bands(z)
    result = {}
    for name, keep in domains.items():
        item = prediction['domains'][name]
        if 'source_refusal' in item:
            result[name] = item
            continue
        grid = f[keep]
        np.testing.assert_array_equal(grid, item['frequencies'])
        _, center, _, Q = projections(np.log10(grid))
        rows, failures = [], []
        for trip in SCHEMES:
            raw, target_sha = read_source(z, 'rounded', trip, p)
            donor, _ = read_source(z, 'rounded', trip, p-1)
            left, _ = read_source(z, 'flat', trip, p-1)
            right, _ = read_source(z, 'flat', trip, p)
            for j, a in enumerate(ANGLES):
                y = raw[keep, j]
                if not np.isfinite(y).all():
                    failures.append([trip, a, np.flatnonzero(~np.isfinite(y)).tolist()])
                    continue
                key = f'{trip}/{coeff(a)}'
                forecasts = np.asarray(item['centered_predictions'][key], dtype=float)
                if forecasts.shape != (len(ARMS), len(grid)) or not np.isfinite(forecasts).all():
                    raise ValueError('Incomplete predictions')
                err = center(forecasts) - center(y)
                qerr = Q(forecasts) - Q(y)
                def rms_by_arm(e):
                    return dict(zip(ARMS, np.sqrt(np.mean(e*e, axis=1)).tolist()))
                rows.append({'trip': trip, 'angle': a, 'target_sha256': target_sha,
                    'raw_target': y.tolist(), 'raw_donor': donor[keep,j].tolist(),
                    'raw_flat_donor': left[keep,j].tolist(), 'raw_flat_target': right[keep,j].tolist(),
                    'recorded_le_minus300': int(np.sum(y <= -300)), 'center_rms': rms_by_arm(err),
                    'q_rms': rms_by_arm(qerr), 'center_signed_error': err.tolist(), 'q_signed_error': qerr.tolist()})
        rr = {'rows': rows, 'missing_nonfinite': failures, 'frequencies': grid.tolist()}
        if not failures:
            cs = summarize(rows, 'center_rms', ARMS)
            qs = summarize(rows, 'q_rms', ARMS)
            distinct = [a for a in ARMS if a not in STATIC_ALIASES]
            rr.update({'center_six': cs, 'q_six': qs, 'center_eight': summarize(rows, 'center_rms', ARMS, False),
                       'q_eight': summarize(rows, 'q_rms', ARMS, False),
                       'center_gates': {m: all(cs['flat_tilt_bpm'][m] < cs[a][m] for a in ARMS[:-1]) for m in ('mean','worst')},
                       'q_gates': {m: all(qs['rounded_carry'][m] < qs[a][m] for a in distinct) for m in ('mean','worst')}})
        result[name] = rr
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('predict','score'))
    parser.add_argument('archive', type=Path)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    args.directory.mkdir(exist_ok=True, parents=True)
    with zipfile.ZipFile(args.archive) as source:
        if args.phase == 'predict':
            for p in (6, 9):
                write(args.directory / f'forecast-{p}.json', predict(source, p))
        else:
            receipts = json.loads((args.directory/'forecast-lock.json').read_text())
            for p in (6,9):
                blob = (args.directory/f'forecast-{p}.json').read_bytes()
                if digest(blob) != receipts[str(p)]:
                    raise ValueError('Forecast checksum differs from external lock')
                write(args.directory/f'score-{p}.json', assess(source,json.loads(blob)))
