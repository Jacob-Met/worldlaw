"""Independent scalar receiver for the .npy bytes, archived calendar labels and empirical model tests."""
import csv
import ast
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import sys
import zipfile
from source import read

def unpack_npy(b):
    f=io.BytesIO(b)
    assert f.read(6)==b'\x93NUMPY' and f.read(2)==b'\x01\x00'
    size=struct.unpack('<H',f.read(2))[0]
    h=ast.literal_eval(f.read(size).decode('ascii'))
    assert not h['fortran_order']
    shape=h['shape'];count=math.prod(shape)
    fmt={'<f8':'<d','|S10':'10s'}[h['descr']]
    vals=[x[0] for x in struct.iter_unpack(fmt,f.read())]
    assert count==len(vals)
    return [tuple(vals[i:i+3]) for i in range(0,len(vals),3)] if len(shape)==2 and shape[1]==3 else vals

def main(archive,dev_path,score_path,source_mode='published'):
    raw=Path(archive).read_bytes();digest=hashlib.sha256(raw).hexdigest()
    dev=json.loads(Path(dev_path).read_bytes());ref=json.loads(Path(score_path).read_bytes())
    assert digest==dev['forecast_sha256']==ref['forecast_sha256']
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert len(z.namelist())==len(set(z.namelist()))
        d={str(Path(x).stem):unpack_npy(z.read(x)) for x in z.namelist()}
    # The trusted pinned workbook intake is shared; reductions, archive parser and gate arithmetic are independent.
    if source_mode=='publisher':
        obs={t.strftime('%Y%m%d%H'):v.get('I') for t,v in read(2025,targets_only=True)}
    elif source_mode=='published':
        raw_targets=Path(__file__).with_name('measured-outer-pergola.csv').read_bytes()
        assert hashlib.sha256(raw_targets).hexdigest()=='5002dc73bf7f06d4b39a48394f98ed71badf69bfc6802274fd4bfd6fc303fcc0'
        obs={r['timestamp']:float(r['outer_pergola_W_m2']) if r['outer_pergola_W_m2'] else None for r in csv.DictReader(io.StringIO(raw_targets.decode()))}
        assert len(obs)==8760
    else:raise ValueError('source mode')
    ids=[s.decode() for s in d['timestamp']];roles=dev['roles']
    assert len(ids)==len(set(ids))==len(d['H_S_N'])
    exact=[i for i,s in enumerate(ids) if obs[s] is not None and math.isfinite(obs[s])]
    inf=[i for i in exact if d['H_S_N'][i][0]>=20]
    sets={'all':exact,'informative':inf,'south_or_equal':[i for i in inf if d['H_S_N'][i][1]>=d['H_S_N'][i][2]],'north':[i for i in inf if d['H_S_N'][i][1]<d['H_S_N'][i][2]]}
    for m in range(1,13):sets[f'month_{m:02d}']=[i for i in inf if int(ids[i][4:6])==m]
    largest=0.;count=0;values={};worst={}
    for group,ix in sets.items():
        if not ix:continue
        values[group]={}
        for role in roles:
            es=[d[role][i]-obs[ids[i]] for i in ix];nn=len(es)
            mae=math.fsum(map(abs,es))/nn;rmse=math.sqrt(math.fsum(x*x for x in es)/nn);bias=math.fsum(es)/nn
            rr=ref['metrics'][group][role];assert rr['n']==nn
            for k,v in [('mae',mae),('rmse',rmse),('bias',bias)]:
                delta=abs(rr[k]-v);assert delta<2e-10;largest=max(largest,delta);count+=1
            values[group][role]=(mae,rmse)
            if group=='informative':
                order=sorted(range(nn),key=lambda j:-abs(es[j]))[:10]
                times=[dt.datetime.strptime(ids[ix[j]],'%Y%m%d%H').isoformat() for j in order]
                assert times==[e['time'] for e in ref['worst10'][role]]
                worst[role]=times[0]
    # Rebuild the two innermost interval endpoints from each measured input across the complete archive.
    c,s=0.5,math.sqrt(.75);rebuild_max=0
    for i,(h,sa,no) in enumerate(d['H_S_N']):
        f=min(sa,no);b_hi=h;b_lo=max(0,h-2*f);q=s*max(0,no-sa)
        v=c*h+s*sa-(s+c-1)*f
        checks={'lower':v-min(c*b_hi,q),'upper':v-min(c*b_lo,q),'physical_lower':max(0,c*h-s*no),'physical_upper':c*h+s*sa,'hemispheres':v-min(c*(h-min(h,2*f,max(0,2*f-.2*h))),q)}
        for k,x in checks.items():rebuild_max=max(rebuild_max,abs(d[k][i]-x));count+=1
    assert rebuild_max<3e-10
    for group,ix in sets.items():
        if not ix:continue
        for low,high in [('lower','upper'),('physical_lower','physical_upper')]:
            lo=[max(0,d[low][i]-obs[ids[i]]) for i in ix];hi=[max(0,obs[ids[i]]-d[high][i]) for i in ix]
            rr=ref['interval'][group][low]
            assert (len(ix),sum(v>1e-8 for v in lo),sum(v>1e-8 for v in hi))==(rr['n'],rr['below'],rr['above'])
            for a,b in [(max(lo),rr['max_below']),(max(hi),rr['max_above']),(math.fsum(lo+hi)/len(ix),rr['mean_excess'])]:
                assert abs(a-b)<2e-10;largest=max(largest,abs(a-b));count+=1
    chosen=min(('ordinary_linear','empirical_ridge','empirical_boost','perez_dirint','perez_calibrated'),key=dev['development']['2024'].get)
    v=values['informative']; cand='hemispheres_residual';wins=sum(values[k][cand][0]<values[k][chosen][0] for k in values if k.startswith('month_'))
    ok=all(v[cand][0]<v[k][0] for k in ('ordinary_linear','empirical_ridge','empirical_boost','perez_calibrated')) and v[cand][1]<v[chosen][1] and wins>=8
    assert chosen==ref['dev_selected'] and wins==ref['gate']['monthly_wins'] and ok==ref['gate']['pass']
    print(json.dumps(dict(forecast_sha256=digest,source=source_mode,scalar_checks=count,rows=len(ids),informative=len(inf),finite_residuals=len(exact)*len(roles),metric_max_delta=largest,physical_max_delta=rebuild_max,worst=worst,gate=ok,monthly_wins=wins),sort_keys=True))
if __name__=='__main__':main(*sys.argv[1:])
