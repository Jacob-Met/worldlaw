"""Controlled scalar-output state models for original experimental tank benchmarks.

A deliberately small, inspectable scientific solver, not an authority for causal
control. It only consumes explicitly supplied input/output segments and never
accesses a source loader, challenge target or held-out dataset by itself.
"""
from __future__ import annotations
import math
import numpy as np
from scipy.optimize import least_squares

ARX_ORDERS=(2,4,8)
ARX_RIDGES=(1e-9,1e-6,1e-4,1e-2,1e-1)
PHYSICAL_VARIANTS=("no_overflow","hard_overflow")
INITIALIZATION_WINDOW=50

def require(cond,message):
    if not cond:
        raise ValueError("controlled-hydraulics: "+message)

def numeric_series(u,y=None):
    u=np.asarray(u,dtype=np.float64).reshape(-1)
    require(u.ndim==1 and len(u)>=60 and np.all(np.isfinite(u)),
            "finite one-dimensional pump input with 60+ samples required")
    if y is not None:
        y=np.asarray(y,dtype=np.float64).reshape(-1)
        require(len(y)==len(u) and np.all(np.isfinite(y)),
                "aligned finite lower-tank sensor output required")
    return (u,y) if y is not None else u

def series_bounds(u,y):
    return {"u_mu":float(np.mean(u)), "u_sd":float(max(1e-6,np.std(u))),
            "y_mu":float(np.mean(y)), "y_sd":float(max(1e-6,np.std(y))),
            "y_lo":float(np.min(y)-max(1.,np.ptp(y)*.3)),
            "y_hi":float(np.max(y)+max(2.,np.ptp(y)*.3))}

def fit_arx(u,y,order,ridge):
    u,y=numeric_series(u,y)
    require(order in ARX_ORDERS,"unregistered ARX order")
    require(ridge in ARX_RIDGES,"unregistered ridge")
    n=len(y)
    require(n>order*12,"too-short training trajectory for ARX")
    scale=series_bounds(u,y)
    un=(u-scale["u_mu"])/scale["u_sd"]
    yn=(y-scale["y_mu"])/scale["y_sd"]
    columns=[np.ones(n-order)]
    for lag in range(1,order+1):
        columns.append(yn[order-lag:n-lag])
    for lag in range(1,order+1):
        columns.append(un[order-lag:n-lag])
    X=np.stack(columns,axis=-1)
    target=yn[order:]
    gram=X.T@X
    penalty=np.diag([0.]+[ridge*len(target)]*(X.shape[1]-1))
    gram=gram+penalty
    cross=X.T@target
    try:
        coefs=np.linalg.solve(gram,cross)
    except np.linalg.LinAlgError:
        coefs=np.linalg.lstsq(gram,cross,rcond=1e-10)[0]
    require(np.all(np.isfinite(coefs)),"ARX normal equations nonfinite")
    return {"family":"arx","order":order,"ridge":float(ridge),
            "coefs":coefs.tolist(),"scale":scale,"trained_rows":n-order}

def simulate_arx(model,u,y_prefix,*,shift=0,zero_input=False):
    u=numeric_series(u)
    y_prefix=np.asarray(y_prefix,dtype=np.float64).reshape(-1)
    order=model["order"]
    require(len(y_prefix)>=max(order,INITIALIZATION_WINDOW),
            "strict original 50-point initialization required")
    require(len(y_prefix)<len(u),"initialization consumes complete challenge")
    require(np.all(np.isfinite(y_prefix)),"initial outputs nonfinite")
    sc=model["scale"]
    result=np.empty(len(u))
    prefix=len(y_prefix)
    result[:prefix]=y_prefix
    source_u=np.roll(u,shift) if shift else u
    if zero_input: source_u=np.zeros_like(u)
    un=(source_u-sc["u_mu"])/sc["u_sd"]
    coef=np.asarray(model["coefs"])
    for k in range(prefix,len(u)):
        row=[1.]
        row.extend((result[k-l]-sc["y_mu"])/sc["y_sd"] for l in range(1,order+1))
        row.extend(un[k-l] for l in range(1,order+1))
        next_y=sc["y_mu"]+sc["y_sd"]*float(np.dot(coef,row))
        if not np.isfinite(next_y):
            raise ValueError("ARX generated a nonfinite value at "+str(k))
        result[k]=min(sc["y_hi"],max(sc["y_lo"],next_y))
    return result

def physical_bounds(y,variant):
    require(variant in PHYSICAL_VARIANTS,"unsupported physical variant")
    miny,maxy=float(np.min(y)),float(np.max(y))
    # k_in, k_transfer, k_out, sensor_bias, initial_upper;
    # overflow adds upper and lower hard tank capacities (pseudo-voltage units).
    lo=[.00001,.00001,.00001,miny-5.,0.]
    hi=[1.5,1.5,1.5,miny-.001,30.]
    if variant=="hard_overflow":
        lo.extend([max(1.,np.ptp(y)*.4),max(.5,np.ptp(y)*.4)])
        hi.extend([40.,max(12.,np.ptp(y)*3.)])
    return np.asarray(lo),np.asarray(hi)

def physical_caps(params,variant):
    return (float(params[5]),float(params[6])) if variant=="hard_overflow" else (80.,80.)

def integrate_physical(u,params,variant,*,upper0=None,observed_y0=None,substeps=4):
    u=numeric_series(u)
    pars=np.asarray(params,dtype=float)
    require((len(pars)==7 if variant=="hard_overflow" else len(pars)==5),
            "wrong physical parameter count")
    kin,ktransfer,kout,bias,training_upper=pars[:5]
    capupper,caplower=physical_caps(pars,variant)
    upper=float(training_upper if upper0 is None else upper0)
    lower=max(0.,float(observed_y0-bias if observed_y0 is not None else 0.))
    upper=min(capupper,upper)
    lower=min(caplower,lower)
    out=np.empty(len(u),dtype=float)
    stride=1./substeps
    for k in range(len(u)):
        out[k]=bias+lower
        for _ in range(substeps if k<len(u)-1 else 0):
            flux=ktransfer*math.sqrt(max(upper,0.))
            discharge=kout*math.sqrt(max(lower,0.))
            inflow=kin*max(0.,float(u[k]))
            upper=min(capupper,max(0.,upper+stride*(inflow-flux)))
            lower=min(caplower,max(0.,lower+stride*(flux-discharge)))
        if not (math.isfinite(upper) and math.isfinite(lower)):
            raise ValueError("nonfinite hydraulic state at "+str(k))
    return out

def fit_physical(u,y,variant,max_nfev=190):
    u,y=numeric_series(u,y)
    lo,hi=physical_bounds(y,variant)
    miny=float(np.min(y))
    seeds=[
        [.08,.15,.12,miny-1.5,2.0],
        [.2,.25,.15,miny-2.5,8.0],
        [.03,.05,.2,miny-.5,15.0],
    ]
    if variant=="hard_overflow":
        measured_span=float(np.ptp(y))
        for seed in seeds:
            seed.extend([max(2.,min(15.,measured_span*1.5)),
                         max(1.,min(12.,measured_span*1.2))])
    best=None
    for seed in seeds:
        initial=np.clip(np.asarray(seed,dtype=float),lo+1e-7,hi-1e-7)
        def residual(params):
            predicted=integrate_physical(u,params,variant,observed_y0=y[0])
            return predicted-y
        fit=least_squares(residual,initial,bounds=(lo,hi),loss="soft_l1",
                          f_scale=.5,max_nfev=max_nfev,ftol=1e-5,
                          xtol=1e-5,gtol=1e-5)
        score=float(np.sqrt(np.mean(residual(fit.x)**2)))
        candidate={"family":"hydraulic","variant":variant,"parameters":fit.x.tolist(),
            "train_rmse":score,"converged":bool(fit.success),
            "nfev":int(fit.nfev),"solver_message":str(fit.message)}
        if best is None or score<best["train_rmse"]:
            best=candidate
    require(best is not None,"no valid hydraulic candidate")
    return best

def calibrate_upper_prefix(u,y_prefix,model,*,shift=0,zero_input=False):
    u=numeric_series(u)
    y=np.asarray(y_prefix,dtype=np.float64).reshape(-1)
    require(len(y)>=INITIALIZATION_WINDOW and len(y)<len(u) and np.all(np.isfinite(y)),
            "physical latent state needs original first 50 valid output samples")
    params=model["parameters"]
    variant=model["variant"]
    uppercap,_=physical_caps(params,variant)
    # Only source-allowed first 50 measured outputs may calibrate latent
    # upper tank. Candidate selection and plant coefficients are frozen.
    source_u=np.roll(u,shift) if shift else u
    if zero_input: source_u=np.zeros_like(u)
    choices=np.linspace(0.,min(uppercap,30.),40)
    scores=[]
    for upper0 in choices:
        pred=integrate_physical(source_u[:len(y)],params,variant,
                                upper0=float(upper0),observed_y0=float(y[0]))
        scores.append(float(np.mean((pred-y)**2)))
    index=int(np.argmin(scores))
    return {"upper0":float(choices[index]),"prefix_rmse":float(math.sqrt(scores[index])),
        "prefix_count":int(len(y))}

def simulate_physical(model,u,y_prefix,*,shift=0,zero_input=False):
    u=numeric_series(u)
    prefix=np.asarray(y_prefix,dtype=np.float64).reshape(-1)
    calibration=calibrate_upper_prefix(u,prefix,model,shift=shift,zero_input=zero_input)
    source_u=np.roll(u,shift) if shift else u
    if zero_input: source_u=np.zeros_like(u)
    pred=integrate_physical(source_u,model["parameters"],model["variant"],
             upper0=calibration["upper0"],observed_y0=float(prefix[0]))
    # Calibrating using first50 does NOT grant access to subsequent measurements.
    pred[:len(prefix)]=prefix
    return pred,calibration

def free_run(model,u,y,init=INITIALIZATION_WINDOW,*,shift=0,zero_input=False):
    u,y=numeric_series(u,y)
    require(init==INITIALIZATION_WINDOW,"official 50 sample prefix policy is fixed")
    if model["family"]=="arx":
        forecast=simulate_arx(model,u,y[:init],shift=shift,zero_input=zero_input)
        calib=None
    elif model["family"]=="hydraulic":
        forecast,calib=simulate_physical(model,u,y[:init],shift=shift,zero_input=zero_input)
    elif model["family"]=="persistence":
        forecast=np.r_[y[:init],np.full(len(y)-init,y[init-1])]
        calib=None
    else:
        raise ValueError("unregistered scalar-output model")
    residual=forecast[init:]-y[init:]
    require(np.all(np.isfinite(residual)),"nonfinite heldout physical forecast")
    return {"rmse":float(np.sqrt(np.mean(residual**2))),"count":len(residual),
        "prediction":forecast,"calibration":calib}

def select_on_development(u_train,y_train,u_dev,y_dev):
    u_train,y_train=numeric_series(u_train,y_train)
    u_dev,y_dev=numeric_series(u_dev,y_dev)
    candidates=[]
    for order in ARX_ORDERS:
        for ridge in ARX_RIDGES:
            model=fit_arx(u_train,y_train,order,ridge)
            result=free_run(model,u_dev,y_dev)
            candidates.append({"family":"arx","model":model,"dev_rmse":result["rmse"]})
    for variant in PHYSICAL_VARIANTS:
        model=fit_physical(u_train,y_train,variant)
        result=free_run(model,u_dev,y_dev)
        candidates.append({"family":"hydraulic","model":model,"dev_rmse":result["rmse"],
                           "dev_prefix_calibration":result["calibration"]})
    choices={}
    for family in ("arx","hydraulic"):
        offered=[x for x in candidates if x["family"]==family]
        chosen=min(offered,key=lambda x:x["dev_rmse"])
        require(np.isfinite(chosen["dev_rmse"]),"no finite validation candidate")
        choices[family]=chosen["model"]
    return choices,candidates
