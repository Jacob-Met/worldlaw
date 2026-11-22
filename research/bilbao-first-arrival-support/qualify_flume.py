"""Recount command support in the Bilbao calibration workbook and all raw time windows."""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import zipfile

from raw_window_audit import STATIONS, audit, named_condition
from xlsx_tables import columns

CHAR_SHA = '84975ab26fc024bb9f6e9ab092041227eb3c54d1c975689f468cc7650b1d7432'
DATA_SHA = '816cf4f7190c6f3ca9ce0aee51900fa003bcc625547135e3decf3dbcdb6b000e'
GAUGES = (1, 2, 3, 4, 5, 7, 8)
PANEL = Path(__file__).with_name('validation-preset-roster.json')


def read_heights(workbook):
    with zipfile.ZipFile(workbook) as table:
        names = [n for n in table.namelist() if Path(n).name == 'Results_characterisation.xlsx']
        if len(names) != 1:
            raise ValueError('Expected one original calibration workbook')
        raw = table.read(names[0])
    if hashlib.sha256(raw).hexdigest() != CHAR_SHA:
        raise ValueError('Original calibration workbook differs')
    labels = [f'H_exp_GEN_5T_G{i}' for i in GAUGES]
    records = columns(raw, ['Name', *labels])
    if len(records) != 390 or len({row['Name'] for row in records}) != 390:
        raise ValueError('Original file roster differs')
    support = collections.defaultdict(set)
    missing = [0] * len(labels)
    for row in records:
        h, t, dose = named_condition(row['Name'])
        for i, (gauge, label) in enumerate(zip(GAUGES, labels)):
            try:
                value = float(row[label])
            except (KeyError, TypeError, ValueError):
                value = math.nan
            if math.isfinite(value) and value > 0:
                support[h, t, STATIONS[gauge - 1]].add(dose)
            else:
                missing[i] += 1
    return records, support, missing


def unsupported_cases(support, panel):
    missing = []
    for row in panel['preset_values']:
        h, t, x = (float(row[name]) for name in ('h (m)', 'T (s)', 'x (m)'))
        u, corrected = (float(row[name]) / 100 for name in ('H (cm)', 'Hawasys (cm)'))
        depths = (.3, .4) if h == .35 else (h,)
        if any(not brackets(support.get((d, t, x), set()), u, corrected) for d in depths):
            missing.append([h, t, x, u, corrected])
    return missing


def brackets(doses, lower, upper):
    return len(doses) >= 2 and min(doses) <= lower and max(doses) >= upper


def recount(data, workbook, audit_output=None):
    with data.open('rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != DATA_SHA:
            raise ValueError('Original training archive differs')
    rows, official, missing = read_heights(workbook)
    windows = audit(data)
    if audit_output:
        with audit_output.open('x') as output:
            json.dump(windows, output, sort_keys=True, allow_nan=False)
    if set(windows) != {r['Name'] for r in rows}:
        raise ValueError('Author/raw training identifiers differ')
    roster = PANEL.read_bytes()
    if hashlib.sha256(roster).hexdigest() != '0d616da095048037ef22fc0a47209aad060d865a3f2dc9065c90ec8231718522':
        raise ValueError('Command roster SHA differs')
    panel = json.loads(roster)
    if len(panel['preset_values']) != 20:
        raise ValueError('Command roster differs')
    count = collections.Counter()
    methods = ('source', 'first_crest_return')
    supports = {method: collections.defaultdict(set) for method in methods}
    witnesses = {}
    rates = []
    for name, recording in windows.items():
        h, t, dose = named_condition(name)
        if recording.get('clock_refusal'):
            raise ValueError('Unresolved raw microsecond clock in ' + name)
        rates.append(recording['rate_hz'])
        for x in STATIONS:
            wave = recording['stations'][str(x)]
            for method in methods:
                if wave.get(method, {}).get('qualified'):
                    count[method, x] += 1
                    supports[method][h, t, x].add(dose)
            if (h, t, x) == (.5, 2, 16):
                witnesses[name] = wave
    from statistics import median
    return {
        'calibration_recordings':len(rows), 'stations_m': STATIONS,
        'conditions':len({named_condition(r['Name']) for r in rows}),
        'wraps':sum(row['ticks_reversals'] for row in windows.values()),
        'rate_hz_min_median_max':[min(rates),median(rates),max(rates)],
        'missing_author_heights_regular_stations': missing,
        'unsupported_author_presets':unsupported_cases(official, panel),
        'supported_recordings_by_station':{
            m:[count[m, x] for x in STATIONS] for m in methods},
        'unsupported_raw_presets':{m:unsupported_cases(s, panel) for m,s in supports.items()},
        'ten_critical_recordings':witnesses,
        'opened_validation_responses':0,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('training', type=Path, help='Official Data.zip')
    parser.add_argument('results', type=Path, help='Official Results.zip or an archive containing its original characterisation workbook')
    parser.add_argument('--all-windows', type=Path, help='Write all 3,120 window receipts at a new path')
    args = parser.parse_args()
    print(json.dumps(recount(args.training, args.results, args.all_windows), sort_keys=True, allow_nan=False, indent=2))
