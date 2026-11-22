"""Score frozen forecasts and entrants against the same organizer cycle losses."""
import csv
import hashlib
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
import numpy as np


def get(record, revision, store):
    path = store / record['sha']
    if not path.exists():
        url = 'https://raw.githubusercontent.com/minjiechen/magnetchallenge-1/' + revision + '/' + urllib.parse.quote(record['path'])
        with urllib.request.urlopen(url, timeout=90) as response:
            raw = response.read()
        assert len(raw) == record['size'] and git_blob(raw) == record['sha']
        path.write_bytes(raw)
    raw = path.read_bytes()
    assert len(raw) == record['size'] and git_blob(raw) == record['sha']
    return raw


def git_blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + bytes([0]) + raw).hexdigest()


def vector(raw, path, rows):
    if path.endswith('.xlsx'):
        with zipfile.ZipFile(io.BytesIO(raw)) as book:
            sheets = [n for n in book.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', n)]
            if len(sheets) != 1:
                raise ValueError(('unexpected spreadsheet sheets', sheets))
            cells = ET.fromstring(book.read(sheets[0])).findall('.//{*}row')
            records = []
            for row in cells:
                values = []
                for cell in row.findall('{*}c'):
                    node = cell.find('{*}v')
                    if node is not None:
                        values.append(node.text if cell.get('t') not in ('s','str') else 'header')
                if values:
                    records.append(values)
    else:
        records = [r for r in csv.reader(io.StringIO(raw.decode('utf-8-sig'))) if any(x.strip() for x in r)]
    if len(records) == rows + 1:
        try:
            [float(x) for x in records[0]]
        except ValueError:
            records = records[1:]
    if len(records) != rows:
        raise ValueError(('length', len(records), rows))
    cols = {len(r) for r in records}
    if cols == {2}:
        index = np.asarray([float(r[0]) for r in records])
        if not (np.array_equal(index, np.arange(rows)) or np.array_equal(index, np.arange(1,rows+1))):
            raise ValueError('ambiguous two-column file')
    elif cols != {1}:
        raise ValueError(('ambiguous columns', cols))
    vals = np.asarray([float(r[-1]) for r in records])
    assert vals.shape == (rows,) and np.isfinite(vals).all()
    return vals


def score(pred, truth):
    pct = 100 * np.abs((pred - truth) / truth)
    pos = int(np.argmax(pct))
    return {'mean':float(pct.mean()), 'rms':float(np.sqrt(np.mean(pct**2))),
            'p95':float(np.percentile(pct,95)), 'max':float(pct[pos]),
            'worst_index':pos, 'worst_truth_Wm3':float(truth[pos]),
            'worst_pred_Wm3':float(pred[pos]), 'rows':len(pct)}


def main(root, source, locked):
    reg = json.loads(source.read_text())
    expected = json.loads(locked.read_text())
    assert set(expected) == set('ABCDE')
    for letter in expected:
        for ext in ('json','npz'):
            data = (root / f'forecast-{letter}.{ext}').read_bytes()
            assert hashlib.sha256(data).hexdigest() == expected[letter][ext]
    archive = root / 'historic-git-blobs'
    archive.mkdir(exist_ok=True)
    candidates, historic, validity, parity, collisions = {}, {}, {}, {}, {}
    for letter, rows in zip('ABCDE',[7651,3172,5357,7299,3738]):
        r = next(r for r in reg['truth'] if r['letter']==letter)
        truth = vector(get(r,reg['revision'],archive),r['path'],rows)
        assert np.min(truth)>0
        pack = np.load(root / f'forecast-{letter}.npz',allow_pickle=False)
        candidates[letter] = {name:score(pack[name].reshape(-1).astype(np.float64),truth) for name in pack if name.startswith(('winner_','sydney_','maintained_'))}
        assert len(candidates[letter]) == 8
        groups={}
        for i,row in enumerate(pack['descriptor']):
            groups.setdefault(row.tobytes(),[]).append(i)
        repeats = [ids for ids in groups.values() if len(ids)>1]
        collisions[letter] = {'exact_repeated_groups':len(repeats), 'repeated_rows':sum(map(len,repeats)), 'max_pair_bound_percent':0.}
        for ids in repeats:
            y = truth[ids]
            bound = 100*(y.max()-y.min())/(y.max()+y.min())
            if bound > collisions[letter]['max_pair_bound_percent']:
                collisions[letter].update(max_pair_bound_percent=float(bound),rows=[ids[int(y.argmin())],ids[int(y.argmax())]],truth_Wm3=[float(y.min()),float(y.max())])
        for team, sources in reg['teams'].items():
            rec = next(r for r in sources if r['letter']==letter)
            raw = get(rec,reg['revision'],archive)
            try:
                pred = vector(raw,rec['path'],rows)
            except (ValueError,AssertionError) as exc:
                validity.setdefault(team,{})[letter] = str(exc)
                continue
            historic.setdefault(team,{})[letter] = score(pred,truth)
            if team in ('Paderborn','Sydney'):
                role = 'winner_original' if team=='Paderborn' else 'sydney_original'
                own = pack[role].reshape(-1).astype(np.float64)
                parity.setdefault(team,{})[letter] = {'maximum_relative_forecast_delta':float(np.max(np.abs(own-pred)/np.maximum(np.abs(pred),1e-30))),
                     'p95_delta_pp':float(candidates[letter][role]['p95']-historic[team][letter]['p95'])}
    out = dict(candidates=candidates,historic=historic,errors=validity,archive_comparison=parity,collisions=collisions)
    path = root/'score.json'
    with path.open('x') as fp:
        json.dump(out,fp,indent=2,allow_nan=False)
    print('SCORE_SHA',hashlib.sha256(path.read_bytes()).hexdigest())
    print('MEAN_P95', {r:np.mean([v[r]['p95'] for v in candidates.values()]) for r in candidates['A']})
    print('HISTORICAL',sorted((np.mean([a['p95'] for a in d.values()]),t) for t,d in historic.items() if len(d)==5))
    print('INVALID',validity,'PARITY',parity,'COLLISIONS',collisions)


if __name__ == '__main__':
    main(*(Path(x) for x in sys.argv[1:]))
