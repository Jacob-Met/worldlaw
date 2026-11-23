"""Read the original NPY arrays independently with Python's standard library."""
import ast
import array
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import sys
import zipfile

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def unpack_npy(data):
    f=io.BytesIO(data);assert f.read(8)==b'\x93NUMPY\x01\x00'
    h=ast.literal_eval(f.read(struct.unpack('<H',f.read(2))[0]).decode('ascii'));assert not h['fortran_order'] and len(h['shape'])==1
    ar=array.array({'<f4':'f','<f8':'d'}[h['descr']]);ar.frombytes(f.read())
    if sys.byteorder!='little':ar.byteswap()
    assert len(ar)==h['shape'][0]
    return ar
def archive(p):
    with zipfile.ZipFile(p) as z:
        assert len(z.namelist())==len(set(z.namelist())) and all('/' not in x and x.endswith('.npy') for x in z.namelist())
        return {x[:-4]:unpack_npy(z.read(x)) for x in z.namelist()}

def verify(root):
    lock=json.loads((root/'forecast-lock.json').read_bytes());score=json.loads((root/'score.json').read_bytes())
    assert sha(root/'forecast-lock.json')==score['source_lock'] and sha(root/'scored-targets.npz')==score['truth_sha256']
    truths=archive(root/'scored-targets.npz');ids=list(range(51,57));roles=['mechanics_filter','source_geometry','mechanics_gain','direct_fir','long_fir','signed_half_period','zero']
    assert lock['held_ids']==ids and lock['roles']==roles and set(truths)==set(map(str,ids))
    checks=0;maxdiff=0.;worst={};rows={};total=0
    for i in ids:
        n=f'stroke-{i:02d}.npz';info=lock['files'][n];p=root/n;assert p.stat().st_size==info['bytes'] and sha(p)==info['sha256']
        preds=archive(p);assert set(preds)==set(roles);y=truths[str(i)];size=len(y);total+=size*len(roles);assert size==info['rows_5k']
        onset=info['onset_5k'];rows[str(i)]={}
        for role,a in preds.items():
            assert len(a)==size
            errs=[x-t for x,t in zip(a,y)];idx=max(range(size),key=lambda j:abs(errs[j]))
            if role not in worst or abs(errs[idx])>worst[role][0]:worst[role]=(abs(errs[idx]),i,idx,y[idx],a[idx])
            for g,ix in [('whole',slice(None)),('onset100ms',slice(onset,onset+500)),('pre_motion',slice(0,onset))]:
                e=errs[ix];m=len(e);rms=math.sqrt(math.fsum(v*v for v in e)/m);mae=math.fsum(map(abs,e))/m;high=max(map(abs,e))
                rr=score['rows'][str(i)][g][role];assert m==rr['samples']
                for k,val in [('rmse_N',rms),('mae_N',mae),('max_abs_N',high)]:
                    delta=abs(val-rr[k]);assert delta<1e-11;maxdiff=max(maxdiff,delta);checks+=1
                rows[str(i)].setdefault(g,{})[role]=rms
    for r,(err,i,j,y,pred) in worst.items():
        w=score['worst'][r];assert i==w['id'] and j==w['idx_5k'] and abs(w['abs_N']-err)<1e-11
        core=next(q for q in w['neighbor_samples'] if q['idx']==j);assert core['filtered_truth']==y and core['forecasts'][r]==pred
    summary={g:{r:math.fsum(rows[str(i)][g][r] for i in ids)/len(ids) for r in roles} for g in ('whole','onset100ms','pre_motion')}
    for g in summary:
        for r,v in summary[g].items():
            delta=abs(v-score['summary'][g][r]);assert delta<1e-11;maxdiff=max(maxdiff,delta);checks+=1
    c='mechanics_filter';compare=['source_geometry','direct_fir','long_fir','signed_half_period'];whole=summary['whole']
    wins={r:sum(rows[str(i)]['whole'][c]<rows[str(i)]['whole'][r] for i in ids) for r in compare}
    best=min(('direct_fir','long_fir'),key=lambda r:sum(lock['development']['/'.join(map(str,lock['selected'][r]))]))
    ons=sum(rows[str(i)]['onset100ms'][c]<rows[str(i)]['onset100ms'][best] for i in ids)
    passed=all(whole[c]<whole[r] for r in compare) and min(wins.values())>=4 and ons>=4
    assert wins==score['whole_wins'] and ons==score['onset_wins'] and passed==score['gate']['pass'] and best==score['selected_FIR_control']
    return dict(role_strokes=len(ids)*len(roles),finite_sample_residuals=total,scalar_checks=checks,worst_verified=len(worst),max_metric_delta=maxdiff,gate=passed,onset_wins=ons,whole_wins=wins,summary=summary,comparison='Independent reductions, original locked forecasts and observed filtered target arrays; no independent raw-sensor calibration.')
if __name__=='__main__':print(json.dumps(verify(Path(sys.argv[1] if len(sys.argv)>1 else '.')),sort_keys=True))
