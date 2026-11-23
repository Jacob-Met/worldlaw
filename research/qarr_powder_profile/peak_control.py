"""Released lmfit pseudo-Voigt peak-area calibration on pure and development patterns."""
import math
import numpy as np
import lmfit, lmfit.lineshapes
from lmfit.models import PseudoVoigtModel, LinearModel
from scipy.signal import find_peaks
from pathlib import Path
from acquisition import P,sha
def calibrate(t,refs,train,w):
    assert lmfit.__version__==P['source']['lmfit'] and sha(Path(lmfit.lineshapes.__file__).read_bytes())==P['source']['lineshapes_sha256']
    maxima=[]
    for y in refs:
        peak,prop=find_peaks(y,prominence=.02*np.ptp(y))
        maxima.append(list(zip(peak,prop['prominences'])))
    co=np.empty((len(train),3));records=[]
    for k,y in enumerate(refs):
        sel=[];other=[t[i] for j,l in enumerate(maxima) if j!=k for i,_ in l]
        for i,v in sorted(maxima[k],key=lambda p:(-p[1],p[0])):
            if min(t[i]-t[0],t[-1]-t[i])<=.5:continue
            if min(abs(t[i]-q) for q in other)<=.85 or any(abs(t[i]-t[j])<=1 for j in sel):continue
            sel.append(i)
            if len(sel)==3:break
        assert len(sel)==3,('too few isolated peaks',k,sel)
        ratios=[]
        for i in sel:
            x0=t[i];window=np.abs(t-x0)<=.4;x=t[window]-x0
            areas=[]
            for ni,a in enumerate([y,*train]):
                obs=a[window];model=PseudoVoigtModel(prefix='p_')+LinearModel(prefix='b_')
                bg=float((obs[0]+obs[-1])/2)
                par=model.make_params(p_amplitude=max(1.,(float(obs.max())-bg)*.16),p_center=0.,p_sigma=.065,p_fraction=.5,b_intercept=bg,b_slope=0.)
                for name,lo,hi in [('p_amplitude',0.,np.inf),('p_center',-.12,.12),('p_sigma',.01,.3),('p_fraction',0.,1.)]:par[name].set(min=lo,max=hi)
                fit=model.fit(obs,par,x=x,method='least_squares',max_nfev=600)
                ar=float(fit.params['p_amplitude'].value)
                assert fit.success and ar>0 and math.isfinite(ar),('failed peak-area fit',k,x0,ni,fit.message,ar)
                records.append([k,ni,x0,ar,fit.nfev,float(fit.chisqr)])
                areas.append(ar)
            ratios.append(np.log(np.array(areas[1:])/areas[0])-np.log(w[:,k]))
        co[:,k]=np.median(ratios,axis=0)
    co-=np.mean(co,axis=1,keepdims=True)
    return np.exp(co.mean(axis=0)),records
