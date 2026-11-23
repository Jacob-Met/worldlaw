import hashlib
import json
import math
import warnings
from collections import Counter
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares, minimize
from sklearn.ensemble import HistGradientBoostingRegressor
from pdi import pdi_vg

EDGES = np.array([-8.0, math.log10(6), 1.3, 1.8, 2.3, 2.8, 3.4, 6.8])
LOG10 = math.log(10)
PDI_CONSTANTS = [10**6.8, .062, .5, 6., 1.5]

def fields(x):
    r,s,loga,n=x
    return np.array([r,s,math.exp(loga),n,*PDI_CONSTANTS])

def theta_vg(x,pf):
    r,s,la,n=x
    return r+(s-r)*np.exp(-(1-1/n)*np.logaddexp(0,n*(pf*LOG10+la)))

def fit_curve(record, family='pdi'):
    points=record['ret']
    h=np.array([k[1] for k in points])
    theta=np.array([k[2] for k in points])
    weights=np.array([math.sqrt(10.) if k[0]=='WP4' else 1. for k in points])
    # Separate lower-dimensional wet-end arm fixes theta_s >= largest observed theta.
    constrained=family=='wet_vg'
    lo_s=max(.1,float(np.max(theta))) if constrained else .1
    lo_s=min(lo_s,.9899)
    best=None
    for n0 in (1.25,1.8,3):
        p0=[max(.0001,min(.1,.5*float(theta.min()))),max(lo_s+.00001,min(.98,theta.max())),-3.,n0]
        def residual(x):
            if x[1]<=x[0]:return np.ones_like(theta)*100
            if family=='pdi':
                y=pdi_vg(fields(x),10**h,lcon=False).th
            else:y=theta_vg(x,h)
            return (y-theta)*weights
        opt=least_squares(residual,p0,bounds=([0,lo_s,-12,1.01],[.49,.99,3,8]),max_nfev=300)
        if opt.success and opt.x[0]<opt.x[1] and (best is None or opt.cost<best.cost):best=opt
    if best is None:raise ValueError('retention fit failed '+record['id'])
    return best.x

def vg_logk(x,pf,ks):
    r,s,la,n=x;m=1-1/n;v=n*(LOG10*pf+la)
    lse=-m*np.logaddexp(0,v)
    return math.log10(ks)+(.5*lse+2*np.log(-np.expm1(-m*np.logaddexp(0,-v))))/LOG10

def physical(record):
    p=np.array(record['pF']);x=fit_curve(record)
    th_r,th_s=x[:2];ks=record['ksat']
    pooled=np.unique(np.r_[p, EDGES,0.])
    with warnings.catch_warnings():
        warnings.simplefilter('ignore',RuntimeWarning)
        a=pdi_vg(fields(x),10**pooled,TC=20.,lcap=True,lcon=True,optkc='taus',optknc='pred',lvap=True,ldiff=False)
    qi=np.searchsorted(pooled,p);ix=np.searchsorted(pooled,EDGES)
    sc=np.maximum(1e-16,a.thc/(th_s-th_r))
    J=np.sqrt(np.maximum(a.kc,0)/np.sqrt(sc))
    w=np.empty((len(p),len(EDGES)-1))
    for j in range(w.shape[1]):
        start=np.where(p<=EDGES[j],J[ix[j]],J[qi])
        end=np.where(p<EDGES[j+1],J[ix[j+1]],J[qi])
        w[:,j]=np.maximum(start-end,0.)
    # J at h0 vanishes analytically; carry roundoff residue in the final class.
    w[:,-1]+=J[ix[-1]]
    cap=np.sqrt(sc[qi]);floor=a.knc[qi]+a.kv[qi]
    identity=cap*w.sum(axis=1)**2+floor
    if not np.allclose(identity,a.kt[qi],rtol=3e-7,atol=1e-13):raise ValueError('PDI partition identity '+record['id'])
    ks_ref=float(a.kc[ix[0]]+a.knc[ix[0]])  # Saturated liquid reference: zero gas-filled porosity, zero vapor contribution.
    delta=math.tanh((math.log10(ks)-math.log10(ks_ref))/2.)
    wet_h=min(v[1] for v in record['ret'] if v[0]=='HyProp')
    ranges=[min(v[1] for v in record['ret']),max(v[1] for v in record['ret']),wet_h,float(any(v[0]=='AirEntry' for v in record['ret'])),float(any(v[0]=='WP4' for v in record['ret']))]
    # Fixed phase curves are embedded as features for the empirical predictor.
    pdi_log=np.log10(a.kt[qi])
    V=vg_logk(fit_curve(record,'vg'),p,ks)
    wet=vg_logk(fit_curve(record,'wet_vg'),p,ks)
    features=np.column_stack([p,pdi_log,V,wet,np.log10(np.maximum(a.kc[qi],1e-30)),np.log10(np.maximum(floor,1e-30)),a.th[qi],*[np.full(len(p),t) for t in [*x,math.log10(ks),math.log10(ks_ref),*ranges]]])
    assert np.isfinite(features).all() and np.all(floor>0)
    return {'fit':x.tolist(),'Jparts':w,'cap':cap,'floor':floor,'delta':np.full(len(p),delta),'features':features,'pdi':pdi_log,'vg':V,'vg_wetend':wet,'stock':np.array(record['stock_log10K']),'identity_error':float(np.max(np.abs((identity-a.kt[qi])/a.kt[qi])))}

def assemble(records):
    states=[physical(r) for r in records]
    ix=np.concatenate([np.full(len(r['pF']),i) for i,r in enumerate(records)])
    keys=('Jparts','cap','floor','delta','features','pdi','vg','vg_wetend','stock')
    result={k:np.concatenate([s[k] for s in states],axis=0) for k in keys}
    result.update({'index':ix,'records':records,'fits':[s['fit'] for s in states],'partition_max_relative_error':max(s['identity_error'] for s in states)})
    if 'K_HyProp' in records[0]:
        result['y']=np.concatenate([np.log10(r['K_HyProp']) for r in records])
    return result

def equal_weights(data):
    sites=[tuple(r['site']) for r in data['records']]
    counts=Counter(sites)
    n=len(counts)
    return np.concatenate([np.full(len(r['pF']),1/(n*counts[s]*len(r['pF']))) for r,s in zip(data['records'],sites)])

def correction(x,a,derivative=False):
    j=a['Jparts'];n=j.shape[1]
    logw=x[:n][None,:]+x[n:][None,:]*a['delta'][:,None]
    blocks=j*np.exp(logw)
    total=blocks.sum(axis=1)
    k=a['cap']*total**2+a['floor']
    pred=np.log10(k)
    if not derivative:return pred
    grad=((2/LOG10)*a['cap']*total/k)[:,None]*blocks
    return pred,np.column_stack([grad,grad*a['delta'][:,None]])

def coeffs(data):
    w=equal_weights(data);n=data['Jparts'].shape[1];y=data['y']
    def loss(x):
        pred,g=correction(x,data,True);dr=pred-y
        smooth=np.diff(x.reshape(2,n),axis=1)
        val=np.sum(w*dr**2)+.002*np.sum(x*x)+.02*np.sum(smooth*smooth)
        grad=2*g.T@(w*dr)+.004*x
        pen=np.zeros((2,n));pen[:,:-1]-=.04*smooth;pen[:,1:]+=.04*smooth
        return val,grad+pen.ravel()
    z=minimize(loss,np.zeros(2*n),jac=True,method='L-BFGS-B',bounds=[(-5,5)]*(2*n),options={'maxiter':350,'ftol':1e-11})
    if not z.success: raise ValueError(str(z.message))
    return z.x

def train(data):
    W=equal_weights(data);y=data['y'];F=data['features']
    # Standardized ridge controls use the exact same physical and moisture features as boosting.
    mu=W@F;sd=np.sqrt(W@((F-mu)**2));sd=np.where(sd>1e-8,sd,1.)
    zz=np.column_stack([np.ones(len(y)),(F-mu)/sd])
    pn=np.eye(zz.shape[1])*.02;pn[0,0]=0.
    ridge=np.linalg.solve(zz.T@(W[:,None]*zz)+pn,zz.T@(W*(y-data['pdi'])))
    hgb=HistGradientBoostingRegressor(learning_rate=.065,max_iter=180,max_leaf_nodes=15,max_depth=5,min_samples_leaf=25,l2_regularization=2.0,early_stopping=False,random_state=142)
    hgb.fit(F,y-data['pdi'],sample_weight=W*len(W))
    return {'x':coeffs(data),'vg_offset':float(W@(y-data['vg'])),'pdi_offset':float(W@(y-data['pdi'])),'hgb':hgb,'ridge':ridge,'mu':mu,'sd':sd}

def predict(data,model):
    F=data['features'];a=model
    z=np.column_stack([np.ones(len(F)),(F-a['mu'])/a['sd']])
    return {'vg_stock':data['stock'],'vg_author_ret_weights':data['vg'],'vg_wetend':data['vg_wetend'],'pdi_author':data['pdi'],'vg_scale':data['vg']+a['vg_offset'],'pdi_scale':data['pdi']+a['pdi_offset'],'ridge_pdi':data['pdi']+z@a['ridge'],'hgb_pdi':data['pdi']+a['hgb'].predict(F),'weighted_capillary':correction(a['x'],data)}
