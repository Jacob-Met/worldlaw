"""Recompute official error summaries and collect the worst raw cycle per native role."""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import zipfile
import numpy as np


def summary(pred, truth):
    errors = [abs(float(p)-float(y))/float(y)*100 for p,y in zip(pred,truth)]
    n=len(errors)
    order=sorted(errors)
    rank=.95*(n-1)
    lo=int(rank)
    hi=min(lo+1,n-1)
    p95=order[lo]+(rank-lo)*(order[hi]-order[lo])
    return dict(mean=math.fsum(errors)/n,rms=math.sqrt(math.fsum(v*v for v in errors)/n),
                p95=p95,max=order[-1],worst_index=errors.index(order[-1]))


def sha(path):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for part in iter(lambda:f.read(1<<22),b''):
            digest.update(part)
    return digest.hexdigest()


def main(root, roster, lock):
    spec=json.loads(roster.read_text())
    journal=json.loads(lock.read_text())
    previous=json.loads((root/'score.json').read_text())
    dict_rows={}
    all_worsts=[]
    max_difference=0.
    total=0
    with zipfile.ZipFile(root/'final-competition-share.zip') as z:
        for spec_row in spec['truth']:
            material=spec_row['letter']
            forecasts=root/f'forecast-{material}.npz'
            assert sha(forecasts)==journal[material]['npz']
            assert sha(root/f'forecast-{material}.json')==journal[material]['json']
            truth_file=root/'historic-git-blobs'/spec_row['sha']
            raw=truth_file.read_bytes()
            assert hashlib.sha1(b'blob '+str(len(raw)).encode()+bytes([0])+raw).hexdigest()==spec_row['sha']
            ys=[float(e[0]) for e in csv.reader(io.StringIO(raw.decode('utf-8-sig'))) if e]
            def scalar(name):
                with z.open(f'Testing/Material {material}/{name}.csv') as f:
                    return np.loadtxt(f,delimiter=',')
            fs,ts=scalar('Frequency'),scalar('Temperature')
            pack=np.load(forecasts,allow_pickle=False)
            needed={}
            for role,published in previous['candidates'][material].items():
                pred=pack[role].reshape(-1)
                assert len(pred)==len(ys)
                result=summary(pred,ys)
                assert result['worst_index']==published['worst_index']
                for metric in ('mean','rms','p95','max'):
                    delta=abs(result[metric]-published[metric])
                    assert delta <= 1.e-9 * max(1,abs(published[metric])), (material,role,metric,delta)
                    max_difference=max(max_difference,delta)
                    total+=1
                i=result['worst_index']
                needed.setdefault(i,[]).append((role,result['max'],float(pred[i])))
                dict_rows.setdefault(role,[]).append([material,result['p95']])
            with z.open(f'Testing/Material {material}/B_Field.csv') as stream:
                reader=csv.reader(io.TextIOWrapper(stream,encoding='utf-8'))
                for i,row in enumerate(reader):
                    if i not in needed:
                        continue
                    b=np.asarray(row,dtype=np.float64)
                    assert len(b)==1024
                    for role,error,prediction in needed[i]:
                        all_worsts.append(dict(material=material,role=role,index=i,percent_error=error,
                             truth_Wm3=ys[i],prediction_Wm3=prediction,signed_error_Wm3=prediction-ys[i],
                             f_Hz=float(fs[i]),temp_C=float(ts[i]),B_min_T=float(min(b)),B_max_T=float(max(b)),
                             B_first_three_T=b[:3].tolist(),shift=int(pack['origin_r'][i]),
                             voltage_anchor=int(pack['origin_voltage'][i]),field_anchor=int(pack['origin_field'][i])))
    means={role:math.fsum(x[1] for x in m)/len(m) for role,m in dict_rows.items()}
    c='winner_voltage'
    def diff(ref):
        return [a[1]-b[1] for a,b in zip(dict_rows[c],dict_rows[ref])]
    ds={role:diff(role) for role in ('winner_rotated','winner_field','winner_original')}
    robustness=all(sum(v<0 for v in ds[role])>=4 and means[c]<means[role] for role in ('winner_rotated','winner_field'))
    ordinary=means[c]<=means['winner_original'] and max(ds['winner_original'])<=.5
    out=dict(registry=177296,matched_stats=total,matched_worsts=len(all_worsts),max_abs_recount_difference_pp=max_difference,
             aggregate_mean_P95_pct=means,material_P95_pct=dict_rows,per_material_difference_pp=ds,
             robustness_gate=robustness,ordinary_source_gate=ordinary,full_gate=robustness and ordinary,
             raw_worst=all_worsts)
    path=root/'recount.json'
    with path.open('x') as f:
        json.dump(out,f,indent=2,allow_nan=False)
    print('RECOUNT',sha(path),'MATCHED',total,len(all_worsts),max_difference,'GATES',robustness,ordinary)
    print('MEANS',means,'DIFFS',ds,'WORST_CANDIDATE',max((row for row in all_worsts if row['role']==c),key=lambda row:row['percent_error']))


if __name__=='__main__':
    main(*(Path(p) for p in sys.argv[1:]))
