"""Forecast signed coil-voltage integrals from measured housing-frame blade motion."""
import csv
import hashlib
import json
import os
from pathlib import Path

import numpy as np

MISSING = {19,25,29,31,34}
LOADED = [i for i in range(1,37) if i not in MISSING]
CONTROL = ['zero','source-bias','author-harmonic12','independent-flux','path-dependent','shared-path','load-blind','nominal-load']
CANDIDATE = 'shared-flux'
KINDS = [CANDIDATE,*CONTROL]
# The measured assembly carries three nominally identical blade magnet arrays.
# A free offset for each coil is calibrated only on loaded source measurements.
HARMONICS = 24
RIDGES = (.0001,.001,.01)
RESISTANCE = (100.,677.,993.)

def get_csv(path,columns, require_finite=True):
    with path.open() as stream:
        reader=csv.DictReader(stream)
        if any(c not in reader.fieldnames for c in columns):raise ValueError('source schema')
        values=np.array([[float(r[c]) for c in columns] for r in reader])
    if require_finite and not np.isfinite(values).all():raise ValueError('nonfinite measured values')
    return values

def file_check(path,expected):
    if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError('changed original '+str(path))

def integral(z,steps):
    v=(z[1:]+z[:-1])*.005
    return np.stack([np.sum(v[a:b],axis=0) for a,b in zip(steps,steps[1:])])

def build_motion(path, fine=False):
    z=get_csv(path,['Time','qr','qb','qy'])
    t=z[:,0];q=np.unwrap(z[:,1:],axis=0)
    times=np.arange(len(t),dtype=float)
    if t[-1]<9.99 or not any(np.max(np.abs(t-times/rate))<=2e-9 for rate in (120.,240.)):
        raise ValueError('complete released 120 or 240 Hz camera grid required')
    t100=np.arange(1000)/100.
    a=np.stack([np.interp(t100,t,q[:,i]) for i in range(3)],axis=1)
    cuts=np.arange(1000) if fine else np.r_[np.arange(0,1000,10),999]
    h=np.arange(1,HARMONICS+1)
    def features(angles):
        x=angles[:,:,None]*h
        return np.concatenate([np.cos(x),np.sin(x)],axis=2)
    trig=features(a)
    dx=trig[cuts[1:]]-trig[cuts[:-1]]
    # Signed angle-path terms integrated on the 100 Hz voltage grid.
    # Off-diagonal cross-angle terms and angle winding allow path-dependent voltage.
    cross=[]
    for i in range(3):
        delta=a[1:,i]-a[:-1,i]
        pieces=[delta]
        for j in range(3):
            if j==i:continue
            for k in (1,12):
                for op in (np.sin,np.cos):
                    basis=op(k*a[:,j]);pieces.append(delta*(basis[:-1]+basis[1:])/2)
        v=np.column_stack(pieces);c=np.vstack([np.zeros(v.shape[1]),np.cumsum(v,axis=0)])
        cross.append(c[cuts[1:]]-c[cuts[:-1]])
    # Summing over all ordered distinct blade pairs preserves blade-label symmetry.
    # The four cross terms have nonzero curl in general; the winding term
    # can carry nonzero circulation. Both are absent from the periodic flux map.
    shared_cross=[]
    dq=np.diff(a,axis=0)
    shared_cross.append(dq.sum(axis=1))
    for k in (1,12):
        for op in (np.sin,np.cos):
            u=op(k*a)
            midpoint=(u[:-1]+u[1:])/2
            shared_cross.append(((midpoint.sum(axis=1)[:,None]-midpoint)*dq).sum(axis=1))
    z=np.column_stack(shared_cross)
    acc=np.vstack([np.zeros(z.shape[1]),np.cumsum(z,axis=0)])
    shared_path=acc[cuts[1:]]-acc[cuts[:-1]]
    dt=np.diff(cuts)[:,None]/100
    simple=dx[:,:,[11,HARMONICS+11]].reshape(len(dt),-1)
    independent=dx.reshape(len(dt),-1)
    shared=np.sum(dx,axis=1)
    return {'shared-flux':np.c_[shared,dt],
            'load-blind':np.c_[shared,dt],
            'nominal-load':np.c_[shared,dt],
            'shared-path':np.c_[shared,shared_path,dt],
            'independent-flux':np.c_[independent,dt],
            'path-dependent':np.column_stack([independent,*cross,dt]),
            'author-harmonic12':np.c_[simple,dt],
            'source-bias':dt,'zero':dt*0,'dt':dt,'cuts':cuts}

def measured(path,cuts):
    z=get_csv(path,['Time']+['Vol_'+str(k) for k in range(1,25)], require_finite=False)
    if len(z)!=1000 or not np.isfinite(z[:,0]).all() or max(abs(z[:,0]-np.arange(1000)/100))>2e-9:
        raise ValueError('expected 1000 samples from ADC trigger')
    vol=z[:,1:]
    return integral(vol,cuts),vol[cuts[1:]]-vol[cuts[:-1]],vol

def rload(i,role):
    return ((100.,666.,1000.) if role=='nominal-load' else RESISTANCE)[(i-1)//12]

def fit(data,ids,role,ridge):
    X=np.vstack([data[i][0][role] for i in ids])
    if role=='zero': return np.zeros((X.shape[1],24)),{'L_H':0.}
    def scale(i):
        return 1 if role=='load-blind' else 1+100/rload(i,role)
    y=np.vstack([data[i][1]*scale(i) for i in ids])
    z=np.vstack([data[i][2]/rload(i,role) for i in ids])
    good=np.isfinite(y).all(axis=1)&np.isfinite(z).all(axis=1)
    X,y,z=X[good],y[good],z[good]
    col=np.sqrt(np.mean(X*X,axis=0));col[col<1e-10]=1
    a=X/col
    # Shared nonnegative L is profiled in loaded KVL; zero and bias-only
    # controls do not estimate reactive storage from unrelated signal energy.
    reg=np.eye(a.shape[1])*ridge*len(X);reg[-1,-1]=0
    gram=a.T@a+reg
    joint=np.linalg.solve(gram,a.T@np.column_stack([y,z]))
    by,bz=np.hsplit(joint,2);ey=y-a@by;ez=z-a@bz
    # Penalized residual includes the identical ridge penalty on both coefficient blocks.
    den=np.sum(ez*ez)+np.sum(bz*(reg@bz))
    num=np.sum(ey*ez)+np.sum(by*(reg@bz))
    L=max(0.,-num/den) if den>1e-15 and role not in ('source-bias','load-blind') else 0.
    return (by+L*bz)/col[:,None],{'L_H':float(L),'profile_den':float(den),'raw_rank':int(np.linalg.matrix_rank(a)),'features':a.shape[1],'gram_condition':float(np.linalg.cond(gram))}

def summary(pred,actual,dt):
    voltage=(pred-actual)/dt
    ind=np.unravel_index(np.nanargmax(abs(voltage)),voltage.shape)
    return {'rms_V':float(np.sqrt(np.nanmean(voltage**2))),'mae_V':float(np.nanmean(abs(voltage))),'finite_cells':int(np.isfinite(voltage).sum()),'all_cells':int(voltage.size),
            'worst_abs_V':float(abs(voltage[ind])),'window':int(ind[0]),'coil':int(ind[1])+1,
            'target_volt_seconds':float(actual[ind]),'predicted_volt_seconds':float(pred[ind]),
            'duration_s':float(dt[ind[0],0])}


def loaded_voltage_integrals(fine_delta, cuts, load, inductance):
    """Causal series circuit, with zero initial current and held motion-only emf."""
    gain=load/(100.+load)
    e=fine_delta/.01
    if inductance<=1e-12:
        steps=gain*fine_delta
    else:
        tau=inductance/(100.+load)
        a=-np.expm1(-.01/tau)
        current=np.zeros(24)
        steps=np.empty_like(e)
        for i,ev in enumerate(e):
            settled=gain*ev
            steps[i]=.01*settled+(current-settled)*tau*a
            current+=a*(settled-current)
    agg=np.vstack([np.zeros(24),np.cumsum(steps,axis=0)])
    return agg[cuts[1:]]-agg[cuts[:-1]]

def develop(root):
    data={};fine={}
    for i in LOADED:
        mo=build_motion(root/(f'{i:02d}-motion.csv'))
        u,dv,v=measured(root/(f'{i:02d}-terminal.csv'),mo['cuts'])
        data[i]=(mo,u,dv)
        fine[i]=build_motion(root/(f'{i:02d}-motion.csv'),True)
    # All three initial-orientation classes are rotated through validation,
    # so each available loaded trajectory is predicted once for each trial setting.
    score={};chosen={};fits={}
    for role in KINDS:
        scores={}
        for ridge in ((.001,) if role in ('source-bias','zero') else RIDGES):
            byrun={}
            for fold in range(3):
                valid=[i for i in LOADED if (i-1)%3==fold]
                train=[i for i in LOADED if i not in valid]
                b,diag=fit(data,train,role,ridge)
                for i in valid:
                    x,u,dv=data[i];pred=x[role]@b;R=rload(i,role)
                    # Source validation sees only camera motion and the declared
                    # load/initial condition. No measured terminal endpoints are inputs.
                    if role!='load-blind':
                        pred=loaded_voltage_integrals(fine[i][role]@b,x['cuts'],R,diag['L_H'])
                    byrun[i]=summary(pred,u,x['dt'])
            scores[str(ridge)]={'rms_mean_V':float(np.mean([b['rms_V'] for b in byrun.values()])),
                                'worst':max(byrun,key=lambda i:byrun[i]['worst_abs_V']),'per_run':byrun}
        best=min(scores,key=lambda key:(scores[key]['rms_mean_V'],float(key)))
        score[role]=scores;chosen[role]=float(best)
        b,diag=fit(data,LOADED,role,float(best));fits[role]={'B':b,'diagnosis':diag}
    return score,chosen,fits

if __name__=='__main__':
    import sys
    root,out=map(Path,sys.argv[1:]);out.mkdir(exist_ok=True)
    score,chosen,fits=develop(root)
    (out/'loaded-development.json').write_text(json.dumps({'score':score,'chosen':chosen,'fit_diagnostics':{k:v['diagnosis'] for k,v in fits.items()}},sort_keys=True,indent=2)+'\n')
    np.savez_compressed(out/'loaded-coefficients.npz',**{k:v['B'] for k,v in fits.items()})
    print(json.dumps({'chosen':chosen,'summary':{k:{'mean_V':score[k][str(r)]['rms_mean_V'],'worst_run':score[k][str(r)]['worst'],'worst':score[k][str(r)]['per_run'][score[k][str(r)]['worst']],'full_fit':fits[k]['diagnosis']} for k,r in chosen.items()}}))
