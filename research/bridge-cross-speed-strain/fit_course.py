"""Fit all registered models on the 31 development acquisitions, then lock ten prospective runs."""
import argparse, hashlib, json, time
from pathlib import Path
import numpy as np
from bridge_source import CASES, HELD, STRAIN, sha_file
from passage_models import (DT, design, whole_grid, lerp_rows, observed_channel,
                            target_slices, ridge_fit, profile_predictor)

FAMILIES=('static_axles','modal_axles','speed_axles','empirical_history','empirical_modes','own_load_profile')
DIRECT=('zero','mean_crawl','mean_medium')
ARMS=DIRECT+FAMILIES
CANDIDATE='modal_axles'
LAMBDA=(.0001,.001,.01,.1,1.)
VALID=('loaded/Crawling_Run_10','unloaded/Crawling_Run_11','loaded/5.6_Run_5','unloaded/5.6_Run_5')
DEV=tuple(w+'/'+n for w,ns in CASES.items() for n in ns if w+'/'+n not in HELD)
PRIMARY_TRAIN=tuple(case for case in DEV if case not in VALID)


def represented(t):
    # Earliest measured strain value in each occupied absolute 20 ms bin of the native clock.
    # t is in seconds relative to the first recorded laser. No resampling or averaging of y.
    bins=np.floor(t/.02+1e-9).astype('int64')
    return np.r_[True,bins[1:]!=bins[:-1]]


def components(z,clocks,family):
    grams={};rhs={};validation={}
    for case in DEV:
        c=clocks[case];grid=whole_grid(c);x=design(grid,c,case.split('/')[0],family)
        gram_cache={}
        for sensor in STRAIN:
            t,y=observed_channel(z,c,case,sensor)
            valid,ref,_=target_slices(t,c)
            y=y-y[ref].mean()
            sample=valid&represented(t)
            key=hashlib.sha256(t[sample].tobytes()+b'\0'+t[ref].tobytes()).digest()
            if key not in gram_cache:
                baseline=lerp_rows(grid,x,t[ref]).mean(0)
                train=lerp_rows(grid,x,t[sample])-baseline
                gram_cache[key]=(train,train.T@train/len(train),baseline)
            train,gram,baseline=gram_cache[key]
            grams[case,sensor]=gram
            rhs[case,sensor]=train.T@y[sample]/len(train)
            if case in VALID:
                validation[case,sensor]=(lerp_rows(grid,x,t[valid])-baseline,y[valid])
    return grams,rhs,validation


def fit_coeffs(grams,rhs,cases,lam):
    return {s:ridge_fit(sum(grams[c,s] for c in cases)/len(cases),
                        sum(rhs[c,s] for c in cases)/len(cases),lam) for s in STRAIN}


def learning(z,clocks,family):
    g,b,val=components(z,clocks,family);trial={}
    for lam in LAMBDA:
        coeffs=fit_coeffs(g,b,PRIMARY_TRAIN,lam)
        cells={c:{s:float(np.sqrt(np.mean((x@coeffs[s]-y)**2))) for s in STRAIN
                   for x,y in [val[c,s]]} for c in VALID}
        trial[lam]={'cells':cells,'mean':float(np.mean([v for row in cells.values() for v in row.values()]))}
    selected=min(LAMBDA,key=lambda l:(trial[l]['mean'],l))
    return fit_coeffs(g,b,DEV,selected),{'selected_lambda':selected,'trials':trial}


def controls(z,clocks,cases,held,arm):
    profiles={}
    if arm!='zero':
        for w in ('loaded','unloaded'):
            for s in STRAIN:
                profiles[w,s]=profile_predictor(z,clocks,cases,s,w,arm)
    result={}
    for c in held:
        grid=whole_grid(clocks[c]); pos=clocks[c]['range_intercept']-25.-clocks[c]['speed']*grid
        if arm=='zero':result[c]=np.zeros((len(grid),len(STRAIN)));continue
        model=[]
        for s in STRAIN:
            loc,mean=profiles[c.split('/')[0],s];model.append(np.interp(pos,loc,mean))
        result[c]=np.column_stack(model)
    return result


def lock(path,clock_json,dest):
    started=time.perf_counter()
    if dest.exists():raise ValueError('Would overwrite a locked course')
    clock_receipt=json.loads(clock_json.read_text());clocks=clock_receipt['fits']
    allcases=set(DEV)|HELD
    if clock_receipt['refusal'] or set(clocks)!=allcases or len(allcases)!=41:raise ValueError('All source optical clocks required')
    registry={'arms':ARMS,'channels':STRAIN,'validation_runs':VALID,'development_runs':DEV,'held_runs':sorted(HELD),
              'target_read_before_lock':False,'clock_sha256':sha_file(clock_json),'development_strain_sha256':sha_file(path),
              'validation':{},'members':{},'seconds_per_arm':{}}
    out={}
    with np.load(path,allow_pickle=False) as z:
        expected={c+'/'+s+'/'+col for c in DEV for s in STRAIN for col in ('utc_ns','value')}
        if set(z.files)!=expected:raise ValueError('Development projection roster differs')
        for c in HELD:out[c+'/grid']=whole_grid(clocks[c]).astype('<f8')
        for arm in ARMS:
            begin=time.perf_counter()
            if arm in DIRECT:
                pred=controls(z,clocks,DEV,sorted(HELD),arm)
                devpred=controls(z,clocks,PRIMARY_TRAIN,VALID,arm)
                cells={}
                for c in VALID:
                    cells[c]={}
                    for i,s in enumerate(STRAIN):
                        t,y=observed_channel(z,clocks[c],c,s);valid,ref,_=target_slices(t,clocks[c])
                        p=np.interp(t,whole_grid(clocks[c]),devpred[c][:,i])
                        cells[c][s]=float(np.sqrt(np.mean(((p[valid]-np.mean(p[ref]))-(y[valid]-np.mean(y[ref])))**2)))
                reg={'cells':cells,'mean':float(np.mean([v for row in cells.values() for v in row.values()]))}
            else:
                coeff,reg=learning(z,clocks,arm);pred={}
                for c in sorted(HELD):
                    xx=design(whole_grid(clocks[c]),clocks[c],c.split('/')[0],arm)
                    pred[c]=xx@np.column_stack([coeff[s] for s in STRAIN])
            registry['validation'][arm]=reg
            for c,a in pred.items():
                assert a.shape==(len(whole_grid(clocks[c])),len(STRAIN)) and np.isfinite(a).all()
                out[c+'/'+arm]=a.astype('<f8')
            registry['seconds_per_arm'][arm]=time.perf_counter()-begin
            print('FROZEN_ARM',arm,round(registry['seconds_per_arm'][arm],3),flush=True)
    for k,a in out.items():registry['members'][k]=hashlib.sha256(a.tobytes()).hexdigest()
    with dest.open('xb') as f:np.savez_compressed(f,**out)
    registry['prediction_sha256']=sha_file(dest);registry['wall_s']=time.perf_counter()-started
    return registry


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('development_strain',type=Path);p.add_argument('clocks',type=Path)
    p.add_argument('destination',type=Path);args=p.parse_args()
    z=lock(args.development_strain,args.clocks,args.destination)
    args.destination.with_suffix('.json').write_text(json.dumps(z,sort_keys=True,allow_nan=False))
    print(json.dumps({k:z[k] for k in ('prediction_sha256','wall_s','seconds_per_arm')},sort_keys=True))
