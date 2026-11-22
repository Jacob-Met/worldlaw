"""Recount raw-array voltage differences and prediction archives without SciPy."""
import ast
import hashlib
import io
import json
import math
import struct
import zipfile
import zlib
from pathlib import Path


def element(raw, i, end):
    kind, length = struct.unpack_from(end + 'II', raw, i)
    if kind > 65535:
        kind, length = struct.unpack_from(end + 'HH', raw, i)
        if length > 4:
            raise ValueError('bad inline MAT5 length')
        return kind, raw[i+4:i+4+length], i+8
    return kind, raw[i+8:i+8+length], i+8+((length+7)//8)*8


def observed_member(raw, want):
    end = {b'IM':'<',b'MI':'>'}[raw[126:128]]
    pos = 128
    values = {}
    fmt = {1:'b',2:'B',3:'h',4:'H',5:'i',6:'I',7:'f',9:'d',12:'q',13:'Q'}
    while pos < len(raw):
        kind, contents, next_pos = element(raw, pos, end)
        if kind == 15:
            next_pos = pos + 8 + len(contents)
            kind, contents, _ = element(zlib.decompress(contents),0,end)
        if kind != 14:
            raise ValueError('wrong MAT5 root tag')
        _, _, idx = element(contents,0,end)
        _, ds, idx = element(contents,idx,end)
        _, name, idx = element(contents,idx,end)
        name = name.decode('ascii')
        if name in want:
            kind, cells, _ = element(contents,idx,end)
            dims = struct.unpack(end + 'i'*(len(ds)//4), ds)
            values[name] = [float(val[0]) for val in struct.iter_unpack(end + fmt[kind],cells)]
            assert len(values[name]) == math.prod(dims)
        pos = next_pos
    if set(values) != set(want):
        raise ValueError('missing target channel')
    return values


def npy_rows(b):
    if b[:6] != b'\x93NUMPY':
        raise ValueError('wrong NPY magic')
    ver = b[6]
    n = 2 if ver == 1 else 4
    k = int.from_bytes(b[8:8+n], 'little')
    head = ast.literal_eval(b[8+n:8+n+k].decode().strip())
    assert head['descr']=='<f8' and not head['fortran_order']
    rows, cols = head['shape']
    vals = [v[0] for v in struct.iter_unpack('<d', b[8+n+k:])]
    if len(vals) != rows*cols:
        raise ValueError('wrong NPY count')
    return [vals[i*cols:(i+1)*cols] for i in range(rows)]


def recount(raw_source, raw_pred, original):
    measures = []
    max_metric_difference = 0.
    raw_witnesses = []
    with zipfile.ZipFile(io.BytesIO(raw_source)) as dataset, zipfile.ZipFile(io.BytesIO(raw_pred)) as packet:
        mat_by_id = {Path(n).stem:n for n in dataset.namelist() if '/Raw Data/Test 3/' in n}
        manifest = json.loads(packet.read('manifest.json'))
        arms = manifest['arms']
        with zipfile.ZipFile(io.BytesIO(packet.read('forecasts.npz'))) as forecasts:
            for key in sorted(manifest['prediction_hashes']):
                d = observed_member(dataset.read(mat_by_id[key]),('I','V','Va','Irr','T'))
                truth = [a-b for a,b in zip(d['Va'],d['V'])]
                assert all(map(math.isfinite,truth))
                n = len(truth)
                for arm, pred in zip(arms,npy_rows(forecasts.read(key+'.npy'))):
                    assert len(pred)==n
                    assert hashlib.sha256(struct.pack('<'+'d'*n,*pred)).hexdigest()==manifest['prediction_hashes'][key][arm]
                    err = [hat - target for hat,target in zip(pred,truth)]
                    ix = max(range(n),key=lambda j:abs(err[j]))
                    rmse = math.sqrt(math.fsum(x*x for x in err)/n)
                    mae = math.fsum(abs(x) for x in err)/n
                    reported = original['per_run'][key][arm]
                    assert reported['n']==n
                    diffs = [abs(a-b) for a,b in zip((rmse,mae,abs(err[ix])),(reported['rmse_V'],reported['mae_V'],reported['max_abs_V']))]
                    max_metric_difference=max(max_metric_difference,*diffs)
                    witness = original['raw_worst'][key][arm]
                    assert ix==witness['index'] and err[ix]==witness['signed_error_V']
                    assert (d['I'][ix],d['V'][ix],d['Va'][ix],truth[ix],pred[ix])==(witness['I_A'],witness['selected_V'],witness['Va_V'],witness['remainder_V'],witness['forecast_V'])
                    measures.append((key,arm,n,rmse))
                    raw_witnesses.append((key,arm,ix))
        summary = {}
        for arm in arms:
            values = [v for _,a,_,v in measures if a==arm]
            summary[arm] = (math.fsum(values)/len(values), max(values))
        candidate='component_residual_tree'
        gates=[all(summary[candidate][j] < summary[a][j] for a in arms if a!=candidate) for j in (0,1)]
        assert gates == [original['gates']['mean_run_RMSE_V'],original['gates']['worst_run_RMSE_V']]
        assert all(gates) == original['joint'] and max_metric_difference<2e-11
        return {'stage':manifest['stage'],'unique_curve_arms':len(measures),'individual_errors':sum(n for _,_,n,_ in measures),'raw_worst_verified':len(raw_witnesses),'max_metric_difference_V':max_metric_difference,'mean_worst_gates':gates,'joint':all(gates)}
