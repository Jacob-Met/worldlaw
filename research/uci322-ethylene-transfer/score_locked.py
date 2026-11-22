"""Open controller setpoints only after both target forecasts pass their fixed digest gates."""
import hashlib
import itertools
import json
from pathlib import Path
import sys
import zipfile
import numpy as np

GASES=('CO','methane')
ROLES=('mean','linear','static_svr','static_rbf','history_linear','history_rbf','oger','nuisance','sham')


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def stats(pred,truth,mask):
    if not mask.any():return {'n':0,'rmse_ppm':None,'mae_ppm':None,'bias_ppm':None,'max_abs_ppm':None}
    d=pred[mask]-truth[mask]
    return dict(n=len(d),rmse_ppm=float(np.sqrt(np.mean(d*d))),mae_ppm=float(np.mean(np.abs(d))),
                bias_ppm=float(d.mean()),max_abs_ppm=float(np.max(np.abs(d))))


def outcomes(root,target,log,pack):
    name={'CO':'ethylene_CO.txt','methane':'ethylene_methane.txt'}[target]
    n=int(pack['native_rows']);cut=int(pack['threshold'])
    y=np.empty((n,3))
    with zipfile.ZipFile(root/'uci322-original.zip') as z,z.open(name) as f:
        assert b'Ethylene conc (ppm)' in f.readline()
        for i in range(0,n,40000):
            count=min(40000,n-i)
            y[i:i+count]=np.loadtxt(itertools.islice(f,count),usecols=(0,1,2),ndmin=2)
    native_ids=pack['native_ids'];t=pack['time']; truth=y[native_ids,2];co=y[native_ids,1]
    np.testing.assert_array_equal(t,y[native_ids,0])
    steps=np.diff(y[:,1:3],axis=0); hits=np.flatnonzero(np.any(steps!=0,axis=1))+1
    j=np.searchsorted(hits,native_ids,side='right')-1
    valid=j>=0;latest=hits[np.maximum(j,0)];dd=steps[latest-1]
    age=t-y[latest,0]
    early=valid&(age>=0)&(age<20)
    kinds=np.where((dd[:,0]!=0)&(dd[:,1]==0),'co',np.where((dd[:,0]==0)&(dd[:,1]!=0),'ethylene','both'))
    masks={'all':np.ones(len(t),dtype=bool),'early_co_only':early&(kinds=='co'),
           'early_ethylene_only':early&(kinds=='ethylene'),'early_simultaneous':early&(kinds=='both'),
           'plateau_60s':valid&(age>=60),'co_zero':co==0,'co_present':co>0,
           'ethylene_zero':truth==0,'ethylene_present':truth>0}
    result={'target':target,'decision_rows':len(t),'native_rows':n-cut,'routes':{},'worst':{},
            'event_counts':{k:int(len(np.unique(latest[v]))) for k,v in masks.items() if k.startswith('early_')}}
    for src in GASES:
        roles={}
        for role in ROLES:
            pred=pack[src+'__'+role]
            roles[role]={s:stats(pred,truth,m) for s,m in masks.items()}
            i=int(np.argmax(np.abs(pred-truth)))
            result['worst'][src+'__'+role]=dict(release_index=int(native_ids[i]),t=float(t[i]),
                 ppm=float(truth[i]),prediction_ppm=float(pred[i]),error_ppm=float(pred[i]-truth[i]),
                 co_ppm=float(co[i]),recent_change=str(kinds[i]),seconds_since_change=float(age[i]),
                 ethylene_before_ppm=float(y[latest[i]-1,2]),ethylene_after_ppm=float(y[latest[i],2]),
                 four_sensor_channels=pack['first_four_readings'][i].tolist())
        roles['oger_native_rate']={'all':stats(pack[src+'__fullrate_oger'],y[cut:,2],np.ones(n-cut,dtype=bool))}
        result['routes'][src]=roles
    d1=y[cut:,2]
    result['setpoint_sha256']=hashlib.sha256(y[cut:].tobytes()).hexdigest()
    result['held_ethylene_range_ppm']=[float(d1.min()),float(d1.max())]
    return result


def main(root, lock):
    for target in GASES:
        for ext in ('npz','json'):
            assert sha(root/f'input-only-{target}.{ext}')==lock[target][ext]
    reports={}
    for target in GASES:
        log=json.loads((root/f'input-only-{target}.json').read_text())
        assert log['npz']==lock[target]['npz'] and not log['setpoint_values_accessible_to_decoders']
        with np.load(root/f'input-only-{target}.npz',allow_pickle=False) as pack:
            reports[target]=outcomes(root,target,log,pack)
    gates={}
    for src in GASES:
        ref=json.loads((root/f'development-{src}.json').read_text())['chosen_reference']
        tgt=next(s for s in GASES if s!=src)
        cross=reports[tgt]['routes'][src];within=reports[src]['routes'][src]
        gates[src]={'reference':ref,
            'cross_all_improves_three':all(cross['nuisance']['all']['rmse_ppm']<cross[k]['all']['rmse_ppm'] for k in (ref,'history_rbf','sham')),
            'cross_co_onset_improves_ref_and_sham':all(cross['nuisance']['early_co_only']['rmse_ppm']<cross[k]['early_co_only']['rmse_ppm'] for k in (ref,'sham')),
            'cross_ethylene_onset_within_five_percent':cross['nuisance']['early_ethylene_only']['rmse_ppm']<=1.05*cross[ref]['early_ethylene_only']['rmse_ppm'],
            'within_all_within_five_percent':within['nuisance']['all']['rmse_ppm']<=1.05*within[ref]['all']['rmse_ppm']}
    full=all(v for data in gates.values() for k,v in data.items() if k!='reference')
    out=dict(boundary=177596,mechanism=177686,locks=lock,held=reports,gates=gates,joint_pass=bool(full))
    p=root/'held-scores.json'
    with p.open('x') as f:json.dump(out,f,indent=2,allow_nan=False)
    print('SCORED',sha(p),'GATES',gates,'OVERALL',full)
    for tgt,t in reports.items():
        for src,r in t['routes'].items():
            print(tgt,src,{k:round(v['all']['rmse_ppm'],5) for k,v in r.items()},'WORST',t['worst'][src+'__nuisance'],flush=True)


if __name__=='__main__':main(Path(sys.argv[1]),json.loads(sys.argv[2]))
