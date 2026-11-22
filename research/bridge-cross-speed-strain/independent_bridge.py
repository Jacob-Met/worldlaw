"""Verify all raw held measurements against the original locked arrays, using only stdlib."""
import argparse,array,ast,bisect,hashlib,json,math,struct,sys,zipfile
from pathlib import Path

ARMS=('zero','mean_crawl','mean_medium','static_axles','modal_axles','speed_axles','empirical_history','empirical_modes','own_load_profile')
CHANNELS=('Str_202Y','Str_203Y','Str_204Y','Str_211Z','Str_255Z')
CASES=tuple(f'loaded/{speed}_Run_{i}' for speed in ('11.1','13.9') for i in range(1,6))
PRIMARY='modal_axles'
def sha(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def read(z,key,pin=None):
    raw=z.read(key+'.npy')
    if raw[:6]!=b'\x93NUMPY':raise ValueError('Array magic differs')
    if raw[6] not in (1,2): raise ValueError('Unsupported NPY version')
    n=2 if raw[6]==1 else 4
    stop=8+n+int.from_bytes(raw[8:8+n],'little');header=ast.literal_eval(raw[8+n:stop].decode('latin1'))
    if header['fortran_order'] or header['descr'] not in ('<f8','<i8'):raise ValueError('Unexpected array ordering or type')
    body=raw[stop:]
    if pin and hashlib.sha256(body).hexdigest()!=pin:raise ValueError('Locked numeric payload changed')
    values=array.array('d' if header['descr']=='<f8' else 'q')
    values.frombytes(body)
    if sys.byteorder!='little':values.byteswap()
    if math.prod(header['shape'])!=len(values):raise ValueError('Array dimensions differ')
    return header['shape'],values


def interp(grid,bank,ch,t):
    if t<grid[0] or t>grid[-1]:raise ValueError('Timestamp outside locked grid')
    ix=max(0,min(len(grid)-2,bisect.bisect_right(grid,t)-1))
    a=(t-grid[ix])/(grid[ix+1]-grid[ix])
    return bank[ix*5+ch]*(1-a)+bank[(ix+1)*5+ch]*a


def verify(truth,predictions,registry,clock,score):
    reg=json.loads(registry.read_text());stored=json.loads(score.read_text());clocks=json.loads(clock.read_text())['fits']
    if not (sha(predictions)==reg['prediction_sha256']==stored['pred_sha256'] and sha(truth)==stored['truth_sha256'] and sha(clock)==stored['clock_sha256']==reg['clock_sha256']):
        raise ValueError('Source/forecast/clock receipt differs')
    max_delta=0.;checks=0
    def matched(a,b):
        nonlocal max_delta,checks
        if not math.isclose(a,b,rel_tol=2e-8,abs_tol=2e-9):raise ValueError(f'Independent numeric difference {a} {b}')
        checks+=1;max_delta=max(max_delta,abs(a-b))
    metrics={a:{} for a in ARMS};by_run={a:{} for a in ARMS};ncurves=0;points=0
    worst={};witnesses={}
    with zipfile.ZipFile(truth) as targets,zipfile.ZipFile(predictions) as locked:
        if set(targets.namelist())!={f'{c}/{s}/{k}.npy' for c in CASES for s in CHANNELS for k in ('utc_ns','value')}:raise ValueError('Truth roster differs')
        if set(locked.namelist())!={f'{c}/{a}.npy' for c in CASES for a in (*ARMS,'grid')}:raise ValueError('Forecast roster differs')
        for c in CASES:
            g=clocks[c]
            lo=max(g['optical_trace_start_s'],g['first_axle_east_s']-2)
            hi=min(g['optical_trace_end_s'],g['last_axle_west_s']+2)
            _,grid=read(locked,c+'/grid',reg['members'][c+'/grid'])
            sensors={}
            for s in CHANNELS:
                _,ns=read(targets,c+'/'+s+'/utc_ns');_,y=read(targets,c+'/'+s+'/value')
                t=[(u-g['utc_origin_ns'])*1e-9 for u in ns]
                indices=[i for i,tt in enumerate(t) if lo<=tt<=hi]
                nbase=sum(t[i]<lo+.5 for i in indices)
                if nbase<2 or len(indices)<10:raise ValueError('Insufficient endpoint support')
                origin=math.fsum(y[i] for i in indices[:nbase])/nbase
                sensors[s]=(ns,t,[y[i]-origin for i in indices],indices,nbase)
            for arm in ARMS:
                shape,bank=read(locked,c+'/'+arm,reg['members'][c+'/'+arm])
                if shape!=(len(grid),5):raise ValueError('Locked bank dimensions differ')
                per=[]
                for col,s in enumerate(CHANNELS):
                    ref=stored['raw'][arm][c][s]
                    ns,t,y,idx,nbase=sensors[s]; pred=[interp(grid,bank,col,t[i]) for i in idx]
                    origin=math.fsum(pred[:nbase])/nbase;pred=[a-origin for a in pred]
                    err=[a-b for a,b in zip(pred,y)];n=len(err)
                    k=max(range(n),key=lambda i:abs(err[i]))
                    if ref['n']!=n or ref['baseline_observations']!=nbase or ref['worst']['utc_ns']!=ns[idx[k]] or ref['worst']['row_in_observed_channel']!=idx[k]:
                        raise ValueError(f'Observation or worst row differs {c} {s} {arm}')
                    rms=math.sqrt(math.fsum(v*v for v in err)/n)
                    matched(rms,ref['rmse_um_per_m']);matched(math.fsum(map(abs,err))/n,ref['mae_um_per_m'])
                    matched(err[k],ref['worst']['signed_error_um_per_m']);matched(pred[k],ref['worst']['prediction_um_per_m'])
                    matched(y[k],ref['worst']['target_um_per_m']);per.append(rms);points+=n;ncurves+=1
                    if arm not in worst or abs(err[k])>abs(worst[arm]['error']):
                        worst[arm]={'case':c,'channel':s,'utc_ns':ns[idx[k]],'error':err[k],'time':t[idx[k]],'truth':y[k],'prediction':pred[k]}
                by_run[arm][c]=math.fsum(per)/5;matched(by_run[arm][c],stored['per_run'][arm][c])
    for a in ARMS:
        run=by_run[a];metrics[a]={'mean':math.fsum(run.values())/10,
             'max_run_mean':max(run.values()),'by_speed':{speed:math.fsum(v for c,v in run.items() if c.startswith('loaded/'+speed+'_'))/5 for speed in ('11.1','13.9')}}
        for key in ('mean','max_run_mean'):matched(metrics[a][key],stored['mean_scores'][a][key])
        for speed in ('11.1','13.9'):matched(metrics[a]['by_speed'][speed],stored['mean_scores'][a]['by_speed'][speed])
    peers=[a for a in ARMS if a!=PRIMARY]
    gates={'complete':ncurves==450,'mean_better_than_all':all(metrics[PRIMARY]['mean']<metrics[a]['mean'] for a in peers),
           'each_speed_better_than_all':all(metrics[PRIMARY]['by_speed'][s]<metrics[a]['by_speed'][s] for a in peers for s in ('11.1','13.9')),
           'worst_run_better_than_all':all(metrics[PRIMARY]['max_run_mean']<metrics[a]['max_run_mean'] for a in peers)}
    if gates!=stored['gates'] or all(gates.values())!=stored['joint']:raise ValueError('Scientific verdict differs')
    return {'curves':ncurves,'comparisons_of_scalar_forecasts':points,'scalar_recount_checks':checks,'max_absolute_numerical_difference':max_delta,
            'gates':gates,'joint':all(gates.values()),'worst_per_arm':worst,'means':metrics,'sha256_score':sha(score)}


if __name__=='__main__':
    p=argparse.ArgumentParser()
    for k in ('truth','locked','registry','clocks','score','out'):p.add_argument(k,type=Path)
    a=p.parse_args()
    a.out.write_text(json.dumps(verify(a.truth,a.locked,a.registry,a.clocks,a.score),sort_keys=True,allow_nan=False))
