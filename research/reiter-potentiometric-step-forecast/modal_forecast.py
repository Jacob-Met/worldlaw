"""Finite-horizon universal kriging with an affine voltage and thermal drift mean."""
import itertools
import numpy as np


def coefficients(time, surface, scale, noise):
    """Best linear predictor under the stated finite mixture covariance and exact mean constraints."""
    t=np.asarray(time);temp=np.asarray(surface);future=11.75
    tf=np.mean(temp[-4:])
    X=np.column_stack([np.ones(len(t)),(t-t.mean())/6,temp-temp.mean()])
    x=np.array([1.,(future-t.mean())/6,tf-temp.mean()])
    # Remove only exactly redundant affine constraints with a target consistent
    # with their dependence. Reject ill-posed input instead of silently extrapolating.
    u,s,v=np.linalg.svd(X,full_matrices=False);mask=s>1.e-10*s[0]
    if np.max(np.abs(v[~mask]@x),initial=0)>1.e-9:raise ValueError("inconsistent target mean constraint")
    A=u[:,mask];a=(v[mask]@x)/s[mask]
    tau=scale*np.array([.5,1.,2.,4.,8.,16.,32.])
    phi=np.exp(-t[:,None]/tau);target=np.exp(-future/tau)
    K=phi@phi.T+noise*np.eye(len(t));k=phi@target
    Ki=np.linalg.solve(K,np.column_stack((k,A)));b,KiA=Ki[:,0],Ki[:,1:]
    w=b+KiA@np.linalg.solve(A.T@KiA,a-A.T@b)
    if max(abs(X.T@w-x))>2e-8:raise ValueError("mean reproduction check failed")
    return w


def predict(row, scale, noise):
    w=coefficients(row['hours'],row['surface_C'],scale,noise)
    v=np.array(row['voltage_mV'])
    return v[-1]+float(w@(v-v[-1])),float(sum(abs(w)))


def score(rows,values):
    groups=sorted({(r['soc'],r['approach']) for r in rows});v=np.array(values)
    y=np.array([r['endpoint_mV'] for r in rows]);err=v-y
    rmse={str(g):float(np.mean(err[[i for i,r in enumerate(rows) if (r['soc'],r['approach'])==g]]**2)**.5) for g in groups}
    return {'group_rmse_mV':rmse,'mean_rmse_mV':float(np.mean(list(rmse.values()))),'worst_abs_mV':float(max(abs(err)))}


def choose(training):
    grid=[]
    for scale,noise in itertools.product((.25,.5,1.,2.,4.),(1e-5,1e-4,1e-3,1e-2,.1,1.)):
        vals=[predict(row,scale,noise)[0] for row in training];s=score(training,vals)
        grid.append((s['mean_rmse_mV'],scale,noise))
    return sorted(grid)


def control():
    t=np.arange(.25,6,.5);temperature=np.exp(-t/.7)*8+30
    for temp2 in (temperature,np.zeros(len(t))):
        w=coefficients(t,temp2,1.,.01);v=3400+.05*t+.1*temp2
        assert abs(w@v-(3400+.05*11.75+.1*np.mean(temp2[-4:])))<1e-6
    return 'two exact linear-time/temperature fixtures including constant surface'
