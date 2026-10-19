"""Rebuild the angular-only bundle from unchanged, SHA-checked author CSVs."""
import csv
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REVISION = 'cbf82673641ecd65e902ad5c38a048387649a2a0'
SHA256 = [
    '3d407510fd2c0fcbca7f7b3a223f34f0788821f3a21b6b94ccd24a087b6a19be',
    '7004af991027cf58c2eb59b924e344a203277fb47c453ecbd026e06e8cf71824',
    'f034b8900c7b78f0dbe46805c2d5faa41bb1e238558302156d4965cfc1b4603c',
]
runs = []
for repetition, digest in enumerate(SHA256, start=1):
    filename = f'len1_cond1_{repetition}.csv'
    path = HERE / 'raw' / filename
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, filename
    with path.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream))
    time_column = 'Time (s) Run #1'
    position_column = 'Angle (rad) Run #1'
    rate_column = 'Angular Velocity (rad/s) Run #1'
    chosen = [(i, row) for i, row in enumerate(rows) if 5 <= float(row[time_column]) <= 25]
    assert len(chosen) == 2001 and chosen[0][0] == 500 and chosen[-1][0] == 2500
    samples = [{'time': float(row[time_column]), 'position': float(row[position_column])} for _, row in chosen]
    initial_rate = float(chosen[0][1][rate_column])  # Reject absent/blank data; never substitute zero.
    runs.append({
        'id': f'pasco-len1-cond1-{repetition}',
        'label': f'Measured PASCO pendulum · air · recording {repetition}',
        'kind': 'measured', 'dynamics': 'unforced_scalar_rotation', 'inertia': None,
        'initialRate': initial_rate, 'samples': samples,
        'source': {
            'label': 'Xu et al., Damped Pendulum Dataset, original PASCO CSV',
            'recordingId': f'EnzeXu/Damped_Pendulum_Dataset/{REVISION}/raw_data/{filename}',
            'repository': 'https://github.com/EnzeXu/Damped_Pendulum_Dataset',
            'revision': REVISION,
            'url': f'https://raw.githubusercontent.com/EnzeXu/Damped_Pendulum_Dataset/{REVISION}/raw_data/{filename}',
            'license': 'Apache-2.0', 'licenseFile': 'physical-pasco-92be/LICENSE',
            'localRawFile': f'physical-pasco-92be/raw/{filename}', 'sha256': digest,
            'apparatus': 'same PASCO PS-3220 pendulum apparatus; author length group 1, air condition 1',
            'authorLengthM': 0.236, 'authorRepetition': repetition,
            'columns': {'time': time_column, 'position': position_column, 'initialRate': rate_column},
            'selection': {'firstRawRowZeroBased': 500, 'lastRawRowZeroBasedInclusive': 2500,
                          'timeStartS': 5, 'timeEndSInclusive': 25, 'rawSampleCount': len(rows),
                          'reason': 'Fixed common 20 s window; start 5 s follows author processing start; window declared before fitting.'},
            'transform': {'time': 'original source seconds preserved', 'position': 'original source radians preserved; no recentering or unwrap',
                          'resampling': 'none', 'smoothing': 'none', 'initialRate': 'sensor CSV angular velocity at first selected row; not inferred from later challenge positions'},
            'uncertainty': {'position': 'CSV resolution 0.001 rad; sensor calibration and error distribution not established here',
                            'angularOrigin': 'original sensor angle zero preserved; equilibrium-zero calibration across recordings not independently established here',
                            'initialRate': 'published sensor rate, uncertainty and internal estimation method not established here',
                            'inertia': 'not supplied by inspected primary dataset; absolute torque remains unknown',
                            'forcing': 'unforced scalar rotation is an explicit interpretation of the damped-pendulum setup; no actuator channel verifies zero external forcing'},
            'evidenceRole': 'training' if repetition <= 2 else 'challenge',
            'roleAssignment': 'original independent recording numbers 1 and 2 fit; 3 challenge; same mechanism, not unseen apparatus',
        },
    })
bundle = {'schema': 'worldlaw.angular-bundle/v1',
          'label': 'Measured PASCO pendulum: two training recordings and one held-out recording; torque scale unknown',
          'units': {'time': 's', 'position': 'rad', 'initialRate': 'rad/s'},
          'trainingRuns': runs[:2], 'challengeRuns': runs[2:]}
destination = HERE.parent / 'physical-pasco-92be.json'
destination.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + '\n')
print(f'{destination.name}: {sum(len(run["samples"]) for run in runs)} samples; initial sensor rates {[run["initialRate"] for run in runs]} rad/s')
