"""Receive all 450 pre-registered held strain forecasts; compute all scores without refitting."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from bridge_source import HELD, STRAIN, sha_file
from passage_models import target_slices,observed_channel
from fit_course import ARMS,CANDIDATE


def evaluate(data_path,clock_path,pred_path,reg_path,pinned_prediction):
    if sha_file(pred_path)!=pinned_prediction:raise ValueError('Wrong immutable prediction file')
    clocks=json.loads(clock_path.read_text());reg=json.loads(reg_path.read_text())
    if clocks['refusal'] or reg['prediction_sha256']!=pinned_prediction or reg['clock_sha256']!=sha_file(clock_path):
        raise ValueError('Wrong clock or forecast registry')
    if reg['arms']!=list(ARMS) or reg['channels']!=list(STRAIN) or reg['held_runs']!=sorted(HELD):
        raise ValueError('Held case/arm/gauge pin differs')
    raw={a:{} for a in ARMS};by_run={a:{} for a in ARMS};clocks=clocks['fits']
    with np.load(data_path,allow_pickle=False) as truth,np.load(pred_path,allow_pickle=False) as pred:
        if set(truth.files)!={c+'/'+s+'/'+k for c in HELD for s in STRAIN for k in ('utc_ns','value')}:
            raise ValueError('Held truth projection not exhaustive')
        expected={c+'/'+a for c in HELD for a in (*ARMS,'grid')}
        if set(pred.files)!=expected or set(reg['members'])!=expected:raise ValueError('Locked roster differs')
        for k in expected:
            val=pred[k]
            if hashlib.sha256(val.astype('<f8').tobytes()).hexdigest()!=reg['members'][k]:raise ValueError('Locked member differs')
        for a in ARMS:
            for case in sorted(HELD):
                raw[a][case]={};grid=pred[case+'/grid'];bank=pred[case+'/'+a]
                for i,sensor in enumerate(STRAIN):
                    t,y=observed_channel(truth,clocks[case],case,sensor)
                    valid,ref,bounds=target_slices(t,clocks[case])
                    p=np.interp(t,grid,bank[:,i]);p=p-p[ref].mean();y=y-y[ref].mean()
                    err=p[valid]-y[valid];k=int(np.argmax(abs(err)));idx=int(np.flatnonzero(valid)[k])
                    raw[a][case][sensor]={
                        'n':len(err),'baseline_observations':int(ref.sum()),'window_s':bounds,
                        'rmse_um_per_m':float(np.sqrt(np.mean(err**2))),'mae_um_per_m':float(np.mean(abs(err))),
                        'worst':{'row_in_observed_channel':idx,'utc_ns':int(truth[case+'/'+sensor+'/utc_ns'][idx]),
                                 'time_since_optical_origin_s':float(t[idx]),'signed_error_um_per_m':float(err[k]),
                                 'prediction_um_per_m':float(p[idx]),'target_um_per_m':float(y[idx])}}
                by_run[a][case]=float(np.mean([z['rmse_um_per_m'] for z in raw[a][case].values()]))
    result={}
    for a,rows in by_run.items():
        result[a]={'by_speed':{speed:float(np.mean([v for c,v in rows.items() if c.startswith('loaded/'+speed+'_')])) for speed in ('11.1','13.9')},
                   'mean':float(np.mean(list(rows.values()))),'worst_run':max(rows,key=rows.get),'max_run_mean':max(rows.values())}
    other=[a for a in ARMS if a!=CANDIDATE]
    qc={'complete':sum(len(s) for r in raw.values() for s in r.values())==450,
        'mean_better_than_all':all(result[CANDIDATE]['mean']<result[a]['mean'] for a in other),
        'each_speed_better_than_all':all(result[CANDIDATE]['by_speed'][s]<result[a]['by_speed'][s] for a in other for s in ('11.1','13.9')),
        'worst_run_better_than_all':all(result[CANDIDATE]['max_run_mean']<result[a]['max_run_mean'] for a in other)}
    return {'gates':qc,'joint':all(qc.values()),'mean_scores':result,'per_run':by_run,'raw':raw,
            'truth_sha256':sha_file(data_path),'pred_sha256':pinned_prediction,'clock_sha256':sha_file(clock_path)}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('truth','clocks','predictions','registry','out'):parser.add_argument(name,type=Path)
    parser.add_argument('--forecast-sha256',required=True)
    a=parser.parse_args()
    if a.out.exists():raise ValueError('Would overwrite existing outcome')
    score=evaluate(a.truth,a.clocks,a.predictions,a.registry,a.forecast_sha256)
    a.out.write_text(json.dumps(score,sort_keys=True,allow_nan=False));print(json.dumps(score['gates']),flush=True)
