"""Frozen two-site retrospective diagnostic for paired weighing gauges."""
import hashlib
import json
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import scipy
import sklearn
from scipy.optimize import nnls
from sklearn.ensemble import HistGradientBoostingRegressor

from primary import extract

GRID = (0., .01, .1, 1., 10., 100.)
CAPTURE = [0, 1, 4, 5, 6, 7]
NAMES = ['raw_UN', 'raw_SA', 'raw_pair_mean', 'UN_eq3', 'UN_eq4', 'SA_eq3',
         'SA_eq4', 'equal_pair_eq3', 'equal_pair_eq4', 'NNLS_stack', 'HGB',
         'unpenalized_projection', 'temperature_partition', 'paired_projection']


def efficiencies(wind):
    u = np.clip(wind, 0, 7.2)
    return np.minimum(1., .860*np.exp(-.371*u)+.229), np.minimum(1., .728*np.exp(-.230*u)+.336)


def project(X, penalty):
    U, A, wind, temp = X[:, :4].T
    e, f = efficiencies(wind)
    pi = np.clip((2-temp)/4, 0, 1)
    h = U+A
    k = e*U+f*A
    a = 2+penalty*pi**2
    b = e+f-penalty*pi*(1-pi)
    c = e**2+f**2+penalty*(1-pi)**2
    # Cauchy–Binet avoids cancellation for almost parallel response columns.
    det = (f-e)**2+penalty*((1-pi+e*pi)**2+(1-pi+f*pi)**2)
    liquid = np.divide(h*c-k*b, det, out=np.zeros_like(h), where=det>0)
    solid = np.divide(k*a-h*b, det, out=np.zeros_like(h), where=det>0)
    L = np.stack([np.maximum(0,h/a), np.zeros_like(h), liquid])
    S = np.stack([np.zeros_like(h),np.maximum(0,k/c),solid])
    loss=(L+e*S-U)**2+(L+f*S-A)**2 + penalty*(S-pi*(L+S))**2
    loss[2,(det==0)|(liquid<0)|(solid<0)] = np.inf
    choice = np.argmin(loss,axis=0)
    return (L+S)[choice,np.arange(len(h))]


def prior(X):
    U,A,w,t = X[:,:4].T
    e,f = efficiencies(w)
    p=np.clip((2-t)/4,0,1)
    a,b=1-p+p*e,1-p+p*f
    return np.maximum(0,(a*U+b*A)/(a*a+b*b))


def fixture():
    worst=0.
    for wind in (0., .3, 1., 2., 4., 6., 9.):
        e,f=(float(x) for x in efficiencies(wind))
        for T in (-5.,0.,4.):
            p=np.clip((2-T)/4,0,1)
            for U,A in ((0.,0.),(1.,1.),(e,f),(.2+e,.2+f),(1.2,.2),(-.04,.6)):
                for penalty in GRID:
                    M=np.array([[1.,e],[1.,f],[-np.sqrt(penalty)*p,np.sqrt(penalty)*(1-p)]])
                    sol=nnls(M,[U,A,0])[0]
                    actual=project(np.array([[U,A,wind,T]]),penalty)[0]
                    worst=max(worst,abs(actual-sol.sum()))
    assert worst < 2e-10, worst
    return worst


def load_records(records):
    for r in records:
        with np.load(r['path']) as n:
            yield r['site'],n['times'],n['values'][:,1:],n['values'][:,0]


def fit(records):
    folds=list(load_records(records))
    risk={l:float(np.mean([np.sqrt(np.mean((project(X,l)-y)**2)) for _,_,X,y in folds])) for l in GRID}
    selected=min(GRID,key=risk.get)
    X=np.vstack([x for _,_,x,_ in folds])
    y=np.concatenate([y for _,_,_,y in folds])
    weight=np.concatenate([np.repeat(len(X)/(len(folds)*len(t)),len(t)) for _,t,_,_ in folds])
    coef=nnls(X[:,CAPTURE]*np.sqrt(weight[:,None]), y*np.sqrt(weight))[0]
    model=HistGradientBoostingRegressor(max_iter=125, learning_rate=.06, min_samples_leaf=60,
                                       l2_regularization=1., early_stopping=False, random_state=0)
    model.fit(X,y,sample_weight=weight)
    return selected,coef,model,risk


def predict(X,selected,coef,model):
    u,a,_,_,p3,p4,q3,q4=X.T
    return np.column_stack([u,a,(u+a)/2,p3,p4,q3,q4,(p3+q3)/2,(p4+q4)/2,
                            X[:,CAPTURE]@coef,model.predict(X),project(X,0),prior(X),project(X,selected)])


def summarize(site,t,X,y,p):
    masks={'all':np.ones(len(y),bool),'ref_ge_0.1':y>=.1,'both_zero':(X[:,0]==0)&(X[:,1]==0)}
    e,f=efficiencies(X[:,2]);general=e!=f
    response=np.ones_like(e);response[general]=(2-e[general]-f[general])/abs(f[general]-e[general])
    scores={}
    for j,method in enumerate(NAMES):
        z=p[:,j];error=z-y
        worst=np.argsort(-abs(error),kind='stable')[:10]
        scores[method]={'strata':{k:{'n':int(i.sum()),'rmse':float(np.mean(error[i]**2)**.5),
            'mae':float(np.mean(abs(error[i]))),'sum_observed':float(y[i].sum()),'sum_estimated':float(z[i].sum())} for k,i in masks.items() if i.any()},
            'worst':[{'end_GMT':str(t[i]),'reference':float(y[i]),'predictors':X[i].tolist(),'estimated':float(z[i]),'error':float(error[i])} for i in worst]}
    key=lambda n:scores[n]['strata']['all']['rmse']
    best=min(NAMES[:-1],key=key)
    return {'n':len(y),'best_control':best,'ratio':key(NAMES[-1])/key(best),'threshold_pass':key(NAMES[-1])<=.95*key(best),
            'wet_reference_both_zero':int(np.sum(masks['both_zero']&(y>0))),'bare_greater_than_shielded':int((X[:,0]>X[:,1]).sum()),
            'conditional_total_noise_amplification':[float(x) for x in np.quantile(response,[0,.5,.95,1])],
            'methods':scores}


def main(root,train,headers,support):
    root.mkdir(parents=True,exist_ok=True)
    finite_control=fixture()
    records=json.loads((train/'manifest-train.json').read_text())
    selected,coef,model,risk=fit(records)
    state=root/'training-only.joblib';joblib.dump(model,state)
    lock={'selected':selected,'risks':risk,'coefs':coef.tolist(),'HGB_sha256':hashlib.sha256(state.read_bytes()).hexdigest(),
          'training_rows':{r['site']:r['rows'] for r in records},'methods':NAMES,'nnls_fixture_max':finite_control,
          'versions':[np.__version__,scipy.__version__,sklearn.__version__]}
    lockbytes=(json.dumps(lock,sort_keys=True,indent=2)+'\n').encode()
    (root/'training-lock.json').write_bytes(lockbytes);print('PRELABEL_LOCK',hashlib.sha256(lockbytes).hexdigest(),lock,flush=True)
    records=extract(headers,support,root/'partial','partial_development')
    result={}
    for site,t,X,y in load_records(records):
        p=predict(X,selected,coef,model);assert np.isfinite(p).all()
        np.savez_compressed(root/(site+'-estimates.npz'),end_GMT=t,predictors=X,reference=y,estimates=p)
        result[site]=summarize(site,t,X,y,p)
        d=result[site];print('SCORE',site,d['n'],d['best_control'],d['ratio'],d['threshold_pass'],d['methods']['paired_projection']['strata'],d['methods']['paired_projection']['worst'][:2],flush=True)
    out=root/'partial-diagnostic.json';out.write_text(json.dumps(result,indent=2)+'\n')
    print('COMPLETE',hashlib.sha256(out.read_bytes()).hexdigest(),out,flush=True)


if __name__=='__main__':
    main(*map(Path,sys.argv[1:]))
