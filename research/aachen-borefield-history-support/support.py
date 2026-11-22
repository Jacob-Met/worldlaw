"""Count archive-supported heat and boundary inputs without interpreting temperature magnitudes."""
import calendar
from collections import Counter
from datetime import datetime, timedelta
import shutil
import subprocess
from zipfile import ZipFile

UNKNOWN, NEGATIVE, ZERO, LOW, ACTIVE, NO_INLET, NO_OUTLET = (1, 2, 4, 8, 16, 32, 64)


def classify_flow(samples, flow):
    if samples == 10 and flow == ZERO:
        return 'all_zero'
    if samples < 10 or flow & UNKNOWN:
        return 'raw_unobserved'
    if flow & NEGATIVE:
        return 'contains_negative'
    if flow & LOW:
        return 'contains_low_nonzero'
    if flow == ACTIVE:
        return 'all_active'
    return 'mixed_zero_active'


def possible_heat(samples, raw_flow, prepared):
    if samples == 10 and raw_flow == ZERO:
        return True
    return (samples == 10 and bool(raw_flow & ACTIVE)
            and not raw_flow & (UNKNOWN | NEGATIVE | LOW)
            and prepared & 31 == ACTIVE
            and not prepared & (NO_INLET | NO_OUTLET))


def check_rules():
    assert possible_heat(10, ACTIVE, ACTIVE)
    assert possible_heat(10, ZERO, UNKNOWN | NO_INLET | NO_OUTLET)
    assert possible_heat(10, ZERO | ACTIVE, ACTIVE)
    for flow in (UNKNOWN, LOW, NEGATIVE, ACTIVE | LOW, ACTIVE | UNKNOWN):
        assert not possible_heat(10, flow, ACTIVE)
    for mask in (UNKNOWN, ACTIVE | NO_INLET, ACTIVE | NO_OUTLET):
        assert not possible_heat(10, ACTIVE, mask)
    assert not possible_heat(9, ZERO, UNKNOWN | NO_INLET | NO_OUTLET)
    assert not possible_heat(9, ACTIVE, ACTIVE)


def extract(archive, member, kind, exe, work):
    """The scanner returns a count and category byte per well per observed clock bin."""
    path = work / (kind + '.bins')
    with path.open('wb') as output, archive.open(member) as csv:
        process = subprocess.Popen([str(exe), kind], stdin=subprocess.PIPE, stdout=output)
        with process.stdin as pipe:
            shutil.copyfileobj(csv, pipe, 1024*1024)
        if process.wait():
            raise ValueError(f'Invalid source row in {member}')
    result = {}
    with path.open('rb') as lines:
        for line in lines:
            stamp, count, flags = line.rstrip(b'\n').split(b',', 2)
            assert len(flags) == 40 and stamp not in result
            result[stamp] = (int(count), [value-33 for value in flags])
    return result


def census(raw_path, prepared_path, work, cpp):
    check_rules()
    exe = work / 'support'
    subprocess.run(['g++', '-std=c++17', '-O2', str(cpp), '-o', str(exe)], check=True)
    names = lambda archive: sorted(n for n in archive.namelist() if n.endswith('.csv'))
    report = {}
    with ZipFile(raw_path) as raw, ZipFile(prepared_path) as prepared:
        raw_names, prep_names = names(raw), names(prepared)
        assert len(raw_names) == len(prep_names) == 72
        for r, p in zip(raw_names, prep_names, strict=True):
            month = r[-11:-4]
            assert month == p[-11:-4] and month not in report
            a = extract(raw, r, 'raw', exe, work)
            b = extract(prepared, p, 'prepared', exe, work)
            start = datetime.strptime(month, '%Y_%m')
            bin_count = calendar.monthrange(start.year, start.month)[1]*288
            counts = [Counter() for _ in range(40)]
            joint = Counter()
            for offset in range(bin_count):
                key = (start + timedelta(minutes=5*offset)).strftime('%Y-%m-%d %H:%M').encode()
                nr, raw_flags = a.get(key, (0, [UNKNOWN]*40))
                np, prep_flags = b.get(key, (0, [UNKNOWN]*40))
                assert nr <= 10 and np <= 1
                possible = unknown_boundaries = 0
                for c, rv, pv in zip(counts, raw_flags, prep_flags, strict=True):
                    flow, pflow = rv & 31, pv & 31
                    label = classify_flow(nr, flow)
                    c[label] += 1
                    if nr == 10 and flow & ACTIVE and not flow & (UNKNOWN | NEGATIVE):
                        if pv & NO_INLET:
                            c['raw_active_prepared_inlet_missing'] += 1
                        if pv & NO_OUTLET:
                            c['raw_active_prepared_outlet_missing'] += 1
                    eligible = possible_heat(nr, flow, pv)
                    possible += eligible
                    c['optimistic_heat_bin'] += eligible
                    if label != 'all_zero' and (np == 0 or pflow != ACTIVE or pv & NO_INLET):
                        unknown_boundaries += 1
                joint['bins'] += 1
                joint['all40_optimistic_heat'] += possible == 40
                joint['all40_optimistic_forcing'] += unknown_boundaries == 0
                joint['wells_known_'+str(possible)] += 1
            assert len(a) <= bin_count and len(b) <= bin_count
            assert all(key.startswith(start.strftime('%Y-%m-').encode()) for key in a | b)
            report[month] = {'counts': counts, 'joint': joint, 'recorded_bins': [len(a), len(b)]}
    return report


def prior_year_failures(report, first, stop):
    """For each daily issue, find a failed *whole month* inside its preceding 365 days."""
    source_months = []
    for month, result in sorted(report.items()):
        begin = datetime.strptime(month, '%Y_%m')
        end = begin + timedelta(days=calendar.monthrange(begin.year, begin.month)[1])
        if result['joint']['all40_optimistic_heat'] < result['joint']['bins']:
            source_months.append((month, begin, end))
    certificates = {}
    current = first
    while current < stop:
        start = current - timedelta(days=365)
        witnesses = [m for m, lo, hi in source_months if start <= lo and hi <= current]
        if witnesses:
            certificates[current.date().isoformat()] = witnesses[-1]
        current += timedelta(days=1)
    return certificates
