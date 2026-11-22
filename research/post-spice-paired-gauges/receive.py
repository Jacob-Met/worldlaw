"""Independent exact-clock reader, projection verifier and all-method scorer."""
import csv
import hashlib
import io
import json
import math
import sys
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from scipy.optimize import nnls


def rows(meta):
    doi=meta['doi'];raw=urlopen(f'https://doi.pangaea.de/10.1594/PANGAEA.{doi}?format=textfile&charset=UTF-8',timeout=65).read()
    assert hashlib.sha256(raw).hexdigest()==meta['source_sha256']
    head,tail=raw.split(b'*/',1)
    assert tail.startswith((b'\n',b'\r\n'));tail=tail.lstrip(b'\r\n')
    assert head.lstrip(b'\xef\xbb\xbf').startswith(b'/*')
    ref,alter,bare=meta['roles']
    values=[];clocks=[]
    for row in csv.DictReader(io.StringIO(tail.decode()),delimiter='\t'):
        clock=datetime.fromisoformat(row['Date/Time'])
        start=2014+meta['season'];assert clock.minute in (0,30)
        if not(datetime(start,8,1)<=clock<datetime(start+1,8,1)):continue
        flags=[row[f'Missing [#] ({role})'] for role in (ref,bare,alter,'Wind_gh','Tair')]
        if not all(s and float(s)==0 for s in flags):continue
        names=[f'Precip [mm] ({v})' for v in [ref,bare,alter]]+['ff [m/s] (at gauge height)',next(k for k in row if k.startswith('TTT'))]
        names.extend(f'Precip [mm] ({v}_adj_eq{k}_gh)' for v in (bare,alter) for k in [3,4])
        if any(not row[k].strip() for k in names):continue
        nums=[float(row[k]) for k in names]
        if not all(map(math.isfinite,nums)) or nums[3]<0:continue
        clocks.append(clock.isoformat());values.append(nums)
    assert len(clocks)==len(set(clocks))
    return np.array(clocks),np.array(values)


def physical(U,A,w,T,penalty):
    u=min(w,7.2);eu=min(1,.860*math.exp(-.371*u)+.229);ea=min(1,.728*math.exp(-.230*u)+.336)
    pi=min(1,max(0,(2-T)/4));r=math.sqrt(penalty)
    system=[[1,eu],[1,ea],[-r*pi,r*(1-pi)]]
    fit,_=nnls(system,[U,A,0]);return fit.sum()


def audit(support, root):
    lock=json.loads((root/'training-lock.json').read_text());report=json.loads((root/'partial-diagnostic.json').read_text())
    maxval=0.;score_diff=0.;summaries={}
    for site in ('CAR','MAR'):
        source=next(r for r in support if (r['site'],r['season'])==(site,2))
        t,v=rows(source)
        with np.load(root/(site+'-estimates.npz')) as n:
            assert np.array_equal(t,n['end_GMT']) and np.array_equal(v,np.column_stack([n['reference'],n['predictors']]))
            pred=n['estimates']
        y,U,A,w,T,p3,p4,q3,q4=v.T
        for p,k in ((0.,11),(lock['selected'],13)):
            independent=np.array([physical(u,a,s,h,p) for u,a,s,h in zip(U,A,w,T)])
            maxval=max(maxval,float(np.max(abs(independent-pred[:,k]))))
        reference_arms=np.column_stack([U,A,(U+A)*.5,p3,p4,q3,q4,.5*(p3+q3),.5*(p4+q4)])
        assert np.array_equal(reference_arms,pred[:,:9])
        errors={}
        for j,k in enumerate(lock['methods']):
            for mask,where in [('all',np.ones(len(y),bool)),('ref_ge_0.1',y>=.1),('both_zero',(U==0)&(A==0))]:
                d=pred[where,j]-y[where];rmse=math.sqrt(math.fsum(float(o)**2 for o in d)/len(d))
                original=report[site]['methods'][k]['strata'][mask]
                assert original['n']==len(d)
                score_diff=max(score_diff,abs(rmse-original['rmse']))
                if mask=='all':errors[k]=rmse
        best=min(lock['methods'][:-1],key=errors.get)
        summaries[site]={'rows':len(y),'best':best,'ratio':errors['paired_projection']/errors[best],'all_rmse':errors}
        assert summaries[site]['ratio']>.95 and best==report[site]['best_control']
    assert score_diff<1e-12 and maxval<2e-9,(score_diff,maxval)
    return {'independent_clock_and_values':True,'forecast_stream_count':sum(r['rows'] for r in summaries.values())*14,
            'max_paired_projection_vs_scipy_nnls':maxval,'max_rmse_delta':score_diff,'sites':summaries}


if __name__=='__main__':
    supp,result,destination=map(Path,sys.argv[1:])
    data=audit(json.loads(supp.read_text()),result)
    destination.write_text(json.dumps(data,indent=2)+'\n');print('RECEIVE',json.dumps(data),flush=True)
