"""Causal controls for a finite-window voltage forecast. One row is one chamber plateau."""
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def slope(x, y):
    x=np.asarray(x,float);y=np.asarray(y,float)
    xc=x-x.mean()
    return np.dot(xc, y-y.mean())/np.dot(xc,xc)


def simple(row):
    # Each bin is a mean of measured samples; use its actual measured mean clock.
    t=np.asarray(row['hours']); v=np.asarray(row['voltage_mV']); tcell=np.asarray(row['surface_C'])
    target_time=11.75
    v0=v[-1]
    late=t>=3
    linear_late=v[late].mean()+slope(t[late],v[late])*(target_time-t[late].mean())
    # Use the last measured surface value as the future temperature estimate,
    # never the recorded terminal temperature or an inter-specimen measurement.
    X=np.column_stack([np.ones(len(t)),t-t[-1],tcell-tcell[-1]])
    beta=np.linalg.lstsq(X,v-v0,rcond=None)[0]
    td=v0+beta[0]+beta[1]*(target_time-t[-1])
    return {'persistence':v0,'late_linear':linear_late,'thermal_drift':td}


def features(row):
    v=np.asarray(row['voltage_mV']); surf=np.asarray(row['surface_C']);amb=np.asarray(row['ambient_C'])
    simp=simple(row)
    return np.r_[row['soc']/100, 1. if row['approach']=='cha' else -1., row['ordinal']/20,
                 (v[-1]-3500)/500, surf[0],surf[-1], amb[0],amb[-1], v-v[-1],
                 surf-surf[-1], amb-surf, simp['late_linear']-v[-1], simp['thermal_drift']-v[-1]]


def fit_forecasts(train, test):
    """Only source-cell complete chamber episodes enter hyperparameter comparisons."""
    xt=np.stack([features(row) for row in train]);xv=np.stack([features(row) for row in test])
    base=np.array([row['voltage_mV'][-1] for row in train]);target=np.array([row['endpoint_mV'] for row in train])-base
    sig=np.array([row['soc'] for row in train]);out=[simple(row) for row in test];b=np.array([p['persistence'] for p in out])
    for kind,opts in [('ridge',(0.1,1.,10.,100.,1000.)),('boost',(3,7))]:
        def model(param):
            if kind=='ridge':
                return make_pipeline(StandardScaler(),Ridge(alpha=param))
            return HistGradientBoostingRegressor(max_leaf_nodes=param,min_samples_leaf=12,max_iter=100,
                                                 l2_regularization=1,early_stopping=False,random_state=314159)
        scores=[]
        for opt in opts:
            residual=[]
            for g in sorted(set(sig)):
                testmask=sig==g
                residual.append(np.mean((model(opt).fit(xt[~testmask],target[~testmask]).predict(xt[testmask])-target[testmask])**2))
            scores.append(np.mean(residual))
        val=opts[int(np.argmin(scores))]
        fit=model(val).fit(xt,target).predict(xv)+b
        for p,v in zip(out,fit):p[kind]=float(v)
    return out


def matched_stage_correction(train,test):
    """Interpolate the calibration-cell's endpoint corrections at the same scheduled step/direction."""
    out=[]
    for row in test:
        pairs=sorted((r['soc'],r['endpoint_mV']-r['voltage_mV'][-1]) for r in train
                     if r['approach']==row['approach'] and r['ordinal']==row['ordinal'])
        if not pairs:
            raise ValueError("no same-schedule source cell")
        x,y=zip(*pairs)
        out.append(row['voltage_mV'][-1]+float(np.interp(row['soc'],x,y)))
    return out
