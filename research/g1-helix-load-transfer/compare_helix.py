"""Replay the frozen cross-amplitude experiment from the organizer ZIP."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import h5py
import numpy as np

from gates import score
from harmonic import read_inputs, read_loads
from range_source import RangeReader
from response import response_fits


ROOT = Path(__file__).resolve().parent
PUBLIC_ZIP = 'https://zenodo.org/records/18723855/files/SteadyWindDir.zip?download=1'


def load_case(archive, case, expected, read_y=False, freq=None):
    name = f'DATA_test_{case}.nc'
    with archive.open(name) as member:
        data = io.BytesIO()
        while block := member.read(4 * 1024**2):
            data.write(block)
    sha = hashlib.sha256(data.getbuffer()).hexdigest()
    if sha != expected[str(case)]:
        raise ValueError(f'Organizer member differs for case {case}')
    data.seek(0)
    with h5py.File(data, 'r') as f:
        t = np.asarray(f['Time'])
        if t.shape != (150000,) or not np.allclose(t, np.arange(150000) * .0004, rtol=0, atol=1e-9):
            raise ValueError(f'Unexpected clock for {case}')
        group = f['WTsData/WT1']
        if freq is not None:
            return read_loads(group, t, freq)
        row = read_inputs(group, t, case)
        if read_y:
            row.update(read_loads(group, t, row['frequency_hz']))
        return row


def replay(archive, record):
    cohort = record['cohort']
    expected = record['member_sha256']
    combined, fits, held_inputs = {}, {}, {}
    for yaw in ('aligned', 'yaw_minus20'):
        design = cohort[yaw]
        train = [load_case(archive, i, expected, True) for i in design['train1'] + design['train3']]
        held = [load_case(archive, i, expected) for i in design['held2'] + design['held4']]
        predictions, fits[yaw] = response_fits(train, held)
        held_inputs.update({r['case']:r for r in held})
        for model, values in predictions.items():
            combined.setdefault(model, {}).update(values)
    if len(held_inputs) != 8 or any(len(v) != 8 for v in combined.values()):
        raise ValueError('Forecasts incomplete')
    outcomes = {str(i):load_case(archive, i, expected, freq=r['frequency_hz']) for i, r in held_inputs.items()}
    for name, rows in combined.items():
        for case, point in rows.items():
            np.testing.assert_allclose(point, record['forecasts'][name][case], rtol=5e-6, atol=5e-8)
    for case, obs in outcomes.items():
        np.testing.assert_allclose(obs['y'], record['matched_y'][case], rtol=5e-6, atol=5e-8)
    for yaw, fitted in fits.items():
        for model, params in fitted.items():
            if params['rank'] != record['fitted_operators'][yaw][model]['rank']:
                raise ValueError(f'Rank differs for {yaw}/{model}')
            np.testing.assert_allclose(params['condition'], record['fitted_operators'][yaw][model]['condition'], rtol=5e-6)
    result = score(combined, outcomes, cohort)
    if result['gates'] != record['score']['gates']:
        raise ValueError('Gate mismatch')
    for model, rows in result['rows'].items():
        for i, values in rows.items():
            for metric in ('absolute_nm', 'relative', 'component_nm', 'within_run_block_deviation_nm'):
                np.testing.assert_allclose(values[metric], record['score']['rows'][model][i][metric], rtol=5e-6, atol=5e-8)
    return {'joint':result['joint'], 'summary':result['table'], 'gates':result['gates'],
            'condition':{y:{k:v['condition'] for k,v in fits[y].items()} for y in fits}}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--zip', type=Path, help='Use a local unchanged SteadyWindDir.zip. Otherwise use bounded HTTP byte ranges.')
    args = p.parse_args()
    record = json.loads((ROOT/'comparison.json').read_text())
    source = args.zip if args.zip else RangeReader(PUBLIC_ZIP)
    with zipfile.ZipFile(source) as archive:
        result = replay(archive, record)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
