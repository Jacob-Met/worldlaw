"""Development-only fits and two-way source-repeat checks. Never decode held angles."""
import hashlib,io,json,os,time
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.io import loadmat
from author_fir import author_kernel,replay_kernel,synthetic_check
from author_controller import forecast as feedback, qualified_check
from joint_fir import training_stats,fit
from trial_io import original_measurements,named_members,read_inputs,read_angles,crop_from_force,input_detrend
from weak_balance import synthetic_check as balance_check

ALPHAS=(.001,.03,1.)
LAMBDAS=(.1,1.,10.,100.)
ROLES=('zero','author_fir','author_start','author_refit','smooth','balance','sham')
def read_source():
    rows={v['RunID']:v for v in json.loads(Path('design.json').read_text())}
    split=json.loads(Path('split.json').read_text())
    declared=set(split['source_ids'])
    assert declared=={184,185,190,191,248,249,251,252,255,256}
    starts=json.loads(Path('source-controller-starts.json').read_text());assert set(map(int,starts))==declared
    records={}
    for i,blob in named_members(original_measurements()):
        if i not in declared:continue
        digest=rows[i]['sha256']
        run,u,fs,v=read_inputs(blob,digest)
        assert i==run and fs==200 and v==rows[i]['Speed']
        sl=crop_from_force(u);u=input_detrend(u[sl]);y=read_angles(blob,digest)[sl].copy()
        center=y.mean(axis=0);y-=center
        speed=np.asarray(loadmat(io.BytesIO(blob),variable_names=['ForwardSpeed'],squeeze_me=True)['ForwardSpeed'])
        va=float(np.mean(speed));assert np.isfinite(va) and va>0
        k=np.asarray(starts[str(i)],float)[[0,2,5,6]]
        kr=author_kernel(u,y,fs)
        target=replay_kernel(u,kr)[:,1]
        def objective(theta):
            try:
                pred=feedback(u,va,theta,fs)[:,1]
                if np.max(np.abs(pred))>1e7:return np.full(len(u),1e8)
                return pred-target
            except (OverflowError,ValueError,np.linalg.LinAlgError,FloatingPointError):
                return np.full(len(u),1e8)
        opt=least_squares(objective,k,method='trf',max_nfev=45,ftol=1e-7,xtol=1e-7,gtol=1e-7)
        records[i]={'u':u,'y':y,'v':v,'v_actual':va,'fs':fs,'sl':sl,'mean':center,'k':k,
                    'refit':opt.x,'fit_status':int(opt.status),'nfev':int(opt.nfev),'fit_cost':opt.cost,
                    'kr':kr,'stats':training_stats(u,y,fs)}
    assert set(records)==declared
    return split,records

def smooth_label(role,a,l):
    return f'{role}.{a:.4g}.{l:.4g}'

def metrics(y,p,scale):
    err=(y-p)/scale
    return np.mean(err*err,axis=0)

def main():
    print('source-only synthetic',synthetic_check(),qualified_check(),balance_check(),flush=True)
    start=time.perf_counter();split,ds=read_source()
    boxes={}
    for cell in split['matched_cells'].values():
        ids=cell['source']
        assert len(ids)==2
        for i,j in (ids,ids[::-1]):
            s,d=ds[i],ds[j]
            preds={'zero':np.zeros_like(d['y']),
                   'author_fir':replay_kernel(d['u'],s['kr']),
                   'author_start':feedback(d['u'],d['v'],s['k'],d['fs']),
                   'author_refit':feedback(d['u'],d['v'],s['refit'],d['fs'])}
            for a in ALPHAS:
                for role,ll in [('smooth',[0.]),('balance',LAMBDAS),('sham',LAMBDAS)]:
                    for l in ll:
                        k=fit([s['stats']],s['v'],a,l,variant=role)
                        preds[smooth_label(role,a,l)]=replay_kernel(d['u'],k)
            sigma=np.sqrt(s['stats']['yy'])
            for label,p in preds.items():
                assert np.all(np.isfinite(p))
                raw=metrics(d['y'],p,sigma);pos=np.unravel_index(np.argmax(abs(d['y']-p)/sigma),p.shape)
                t,m=map(int,pos)
                boxes.setdefault(label,[]).append({'donor':i,'receiver':j,'loss':raw.tolist(),
                        'worst':{'index_in_published_trial':d['sl'].start+t,'coordinate':['roll','steer'][m],
                        'target_centered_rad':float(d['y'][t,m]),'target_raw_rad':float(d['y'][t,m]+d['mean'][m]),
                        'prediction_rad':float(p[t,m]),'force_N_detrended':float(d['u'][t]),'normalized_abs':float(abs(d['y'][t,m]-p[t,m])/sigma[m])}})
    values={k:np.mean([x['loss'] for x in v],axis=0).tolist() for k,v in boxes.items()}
    chosen={z:min((k for k in values if k.startswith(z+'.')),key=lambda k:(np.mean(values[k]),k)) for z in ['smooth','balance','sham']}
    ranked={k:values[v] for k,v in {**{z:z for z in ROLES[:4]},**chosen}.items()}
    worst={k:max(boxes[v],key=lambda w:w['worst']['normalized_abs']) for k,v in {**{z:z for z in ROLES[:4]},**chosen}.items()}
    ctl={k:{'v_actual':v['v_actual'],'start':v['k'].tolist(),'refitted':v['refit'].tolist(),'fit_status':v['fit_status'],'nfev':v['nfev'],'cost':float(v['fit_cost'])} for k,v in ds.items()}
    result={'source_repeat_fold_ids':[[x['donor'],x['receiver']] for x in boxes['zero']],'chosen':chosen,'source_crossvalidation':ranked,'full_grid':values,'worst_source_rows':worst,'source_controller':ctl,'elapsed':time.perf_counter()-start,'held_angles_read':0}
    print('DEVELOPMENT '+json.dumps(result,sort_keys=True,allow_nan=False),flush=True)
if __name__=='__main__':main()
