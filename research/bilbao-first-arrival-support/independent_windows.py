"""Independently recheck original source cells and every retained window decision."""
import argparse
from collections import Counter
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import re
from xml.etree import ElementTree as ET
import zipfile

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def source_rows(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as wb:
        root = ET.fromstring(wb.read('xl/worksheets/sheet1.xml'))
        strings = []
        if 'xl/sharedStrings.xml' in wb.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(wb.read('xl/sharedStrings.xml'))]
    rows = []
    for row in root.iter(NS+'row'):
        fields = {}
        for cell in row:
            column = re.sub('[0-9]', '', cell.get('r'))
            v = cell.findtext(NS+'v')
            if cell.get('t') == 's':
                v = strings[int(v)]
            elif cell.get('t') == 'inlineStr':
                v = ''.join(n.text or '' for n in cell.iter(NS+'t'))
            fields[column] = v
        rows.append(fields)
    headers, *values = rows
    return [{name: row.get(col) for col,name in headers.items()} for row in values]


def recount(window_file, tables, aggregate, regenerated=False):
    contents = window_file.read_bytes()
    if not regenerated and hashlib.sha256(contents).hexdigest() != '5bea65485f8c22e00c5674e52b51700d9468f9ae40b98e76eba2aced1002d783':
        raise ValueError('Original window registry differs')
    windows = json.loads(contents if regenerated else gzip.decompress(contents))
    result = json.loads(aggregate.read_text())
    with zipfile.ZipFile(tables) as z:
        raw = z.read(next(n for n in z.namelist() if Path(n).name == 'Results_characterisation.xlsx'))
    if hashlib.sha256(raw).hexdigest() != '84975ab26fc024bb9f6e9ab092041227eb3c54d1c975689f468cc7650b1d7432':
        raise ValueError('Original author workbook differs')
    rows = source_rows(raw)
    by_name = {r['Name']:r for r in rows}
    assert len(rows) == len(by_name) == 390 and by_name.keys() == windows.keys()
    stations = [8,10,12,14,16,16.3,18,20]
    counts = Counter()
    critical = []
    for name, run in windows.items():
        h, period, _ = map(float,re.fullmatch(r'h(\d+)T([.\d]+)H(\d+)(?:P\d+)?',name).groups())
        if period > 5:
            period /= 100
        for x in stations:
            w = run['stations'][str(x)]
            for method, stop in [('source',w['source_stop_s']),
                                 ('first_crest_return',min(w['source_stop_s'],w['earliest_threshold_return_s']))]:
                cycles = (stop-w['source_start_s'])/period
                item = w[method]
                assert abs(cycles-item['cycles']) < 1e-12
                good = cycles >= 1.8 and item.get('rank') == 7
                assert good == item['qualified']
                counts[method,x] += good
            if (h,period,x) == (500,2,16):
                row = by_name[name]
                for k in ('H_exp_GEN_G5','H_exp_GEN_5T_G5'):
                    try:
                        assert not math.isfinite(float(row[k]))
                    except (ValueError,TypeError):
                        pass
                critical.append(name)
    assert len(critical) == 10 and set(critical) == set(result['ten_critical_recordings'])
    for method, vals in result['supported_recordings_by_station'].items():
        assert vals == [counts[method,x] for x in stations]
    return {'source_ids':390, 'window_decisions':6240, 'windows':3120,
            'missing_full_and_five_period_cells':20,'ten_recordings':sorted(critical),
            'validation_responses_opened':0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('windows','tables','aggregate'):
        parser.add_argument(key,type=Path)
    parser.add_argument('--regenerated',action='store_true',help='Read a fresh uncompressed registry. Original mode checks the immutable compressed artifact SHA.')
    a=parser.parse_args()
    print(json.dumps(recount(a.windows,a.tables,a.aggregate,a.regenerated),sort_keys=True))
