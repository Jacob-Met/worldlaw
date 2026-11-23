"""Whole-grid recount with scalar math.fsum and raw column indexing."""
from collections import defaultdict
import hashlib
import io
import json
from math import fsum, sqrt, isclose
from pathlib import Path
import sys
from urllib.request import urlopen
import zipfile
import numpy as np

def sha(data):
    return hashlib.sha256(data).hexdigest()

def close(a,b):
    assert isclose(a,b,abs_tol=1e-14,rel_tol=1e-12),(a,b)

def main(root, archive_sha, registry_sha, scores_sha):
    forecast=(root/'forecast-lock.npz').read_bytes()
    registry=(root/'forecast-registry.json').read_bytes()
    output=(root/'score-original.json').read_bytes()
    assert (sha(forecast),sha(registry),sha(output))==(archive_sha,registry_sha,scores_sha)
    reg=json.loads(registry);report=json.loads(output)
    assert reg['archive_sha256']==archive_sha and report['archive_sha']==archive_sha and report['registry_sha']==registry_sha
    with urlopen('https://www.oceanenergysystems.org/documents/55575-datafile.zip/',timeout=45) as r:
        data=r.read(17549046)
    assert sha(data)=='04c4d78d6987e4eec6c31d692d3c5cf5adea2580ffcfe50fbbd44e6589c7623f'
    truth=[]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for rep in range(1,5):
            records=[]
            with z.open(f'Datafile/Experimental results/05D_Measured{rep}_Raw.txt') as f:
                next(f)
                for line in f:
                    tokens=line.split()
                    if not tokens: continue
                    t=float(tokens[0])
                    if t<0: continue
                    assert t==len(records)/500
                    records.append([float(v) for v in tokens[2:5]])
            assert len(records)==3025
            truth.append(records)
    truth=np.asarray(truth,dtype='<f8')
    assert sha(truth.tobytes())==report['truth_sha256']
    vals={}
    with zipfile.ZipFile(io.BytesIO(forecast)) as z:
        assert len(z.namelist())==len(reg['members']) and set(z.namelist())=={n+'.npy' for n in reg['members']}
        for key,(shape,digest) in reg['members'].items():
            blob=z.read(key+'.npy')
            assert sha(blob)==digest
            a=np.load(io.BytesIO(blob),allow_pickle=False)
            assert list(a.shape)==shape and np.isfinite(a).all()
            vals[key]=a
    totals={}; count=0; binding={}
    for name,a in vals.items():
        if name.endswith('_clock'):continue
        row=report['rows'][name]
        grid=vals['solver_'+name.split('_')[1]+'_clock'] if name.startswith('solver_') else np.arange(3025)/500
        indexes=[int(round(500*t)) for t in grid]
        assert all(i/500==t for i,t in zip(indexes,grid))
        by_g=[[] for _ in range(3)];by_rep=[]
        early=[];late=[]; max_abs=-1;raw_worst=None
        for rep in range(4):
            by_rg=[[] for _ in range(3)]
            for j,index in enumerate(indexes):
                for g in range(3):
                    p=float(a[rep,j,g] if a.ndim==3 else a[j,g]); y=float(truth[rep,index,g])
                    err=p-y; sq=err*err
                    by_g[g].append(sq);by_rg[g].append(sq)
                    (early if grid[j]<=4.56 else late).append(sq)
                    if abs(err)>max_abs:
                        max_abs=abs(err);raw_worst=[rep+1,grid[j],g+1,p,y,err]
            per=[sqrt(fsum(q)/len(q)) for q in by_rg]
            for val,ref in zip(per,row['per_repeat_gauge_m'][rep]):close(val,ref)
            by_rep.append(sqrt(fsum(fsum(q) for q in by_rg)/(3*len(indexes))))
        gauge=[sqrt(fsum(q)/len(q)) for q in by_g]
        overall=sqrt(fsum(fsum(q) for q in by_g)/(12*len(grid)))
        for got,ref in zip(by_rep,row['per_repeat_m']):close(got,ref)
        for got,ref in zip(gauge,row['per_gauge_m']):close(got,ref)
        close(overall,row['rms_m'])
        w=row['worst']
        for got,ref in zip(raw_worst,[w['rep'],w['t'],w['gauge'],w['pred_m'],w['actual_m'],w['error_m']]):close(got,ref)
        for part,values in [('early',early),('later',late)]:
            if values: close(sqrt(fsum(values)/len(values)),row['split_rms_m'][part])
            else: assert row['split_rms_m'][part] is None
        totals[name]=(overall,gauge,by_rep)
        count+=12*len(indexes)
        binding[name]=[len(grid),raw_worst[0],raw_worst[1],raw_worst[2]]
    c=totals['motion_cap_tied'];gate={}
    for name in ('constant_area','opposite_cubic','free_pair','free_asymmetric','dev_convex','other_repeat_cap'):
        key='motion_'+name;d=totals[key]
        gate[key]=[bool(c[0]<d[0]),sum(x<y for x,y in zip(c[1],d[1])),sum(x<y for x,y in zip(c[2],d[2]))]
    good=all(a and b>=2 and c>=3 for a,b,c in gate.values())
    assert gate==report['primary_gate'] and good==report['primary_passed']
    print(json.dumps(dict(archive=archive_sha,registry=registry_sha,score=scores_sha,roles=len(totals),
                          residuals=count,raw_worst_by_role=binding,gate=gate,passed=good),sort_keys=True))
if __name__=='__main__':
    main(Path(sys.argv[1]),*sys.argv[2:])
