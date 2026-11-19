"""Source-independent measured multichannel hydraulic state identification.

Registered for original InTaSet DOI 10.5281/zenodo.17652851 BEFORE reading
any sensor value (prospective docs/INTASET_QUADRUPLE_PREREG.md).
All model features are causal: tank sensor values at t and earlier, pumps at
t and earlier, never future measured tank levels. No original-source reader
is imported by this reusable scientific primitive.

Four fully observed tank states + two pump inputs. Calibration remains in
unknown original native sensor units per sample; no SI volume claims.
"""
from __future__ import annotations
import math
import numpy as np
from scipy.optimize import lsq_linear

PREFIX = 64
ARX_ORDERS = (2, 4, 8, 16)
NARX_ORDERS = (2, 4)
DATA_RIDGES = (1e-6, 1e-4, 1e-2, 1e-1)
PHYS_VARIANTS = ("coupled", "no_cross")
PHYS_RIDGES = (1e-8, 1e-5, 1e-3)
HYD_WINDOW = 10

def require(condition, reason):
    if not condition:
        raise ValueError("original four-tank hydraulics: "+reason)

def finite(matrix):
    return np.all(np.isfinite(matrix))

def validate_segment(segment):
    require(isinstance(segment, dict) and isinstance(segment.get("id"), str),
            "original segment ID required")
    u = np.asarray(segment.get("u"), dtype=np.float64)
    y = np.asarray(segment.get("y"), dtype=np.float64)
    require(u.ndim == 2 and y.ndim == 2 and u.shape[1] == 2
            and y.shape[1] == 4 and u.shape[0] == y.shape[0],
            "four sensor and two pump channels with identical sample count are required")
    require(len(u) >= 128 and finite(u) and finite(y),
            "128+ contiguous finite original observations required")
    return u, y

def validate_segments(segments):
    require(isinstance(segments, list) and len(segments) > 0,
            "nonempty source-indivisible list of source segments required")
    ids = set()
    for s in segments:
        validate_segment(s)
        require(s["id"] not in ids, "duplicate original source segment "+s["id"])
        ids.add(s["id"])
    return segments

def train_scale(segments):
    validate_segments(segments)
    u = np.concatenate([validate_segment(s)[0] for s in segments], axis=0)
    y = np.concatenate([validate_segment(s)[1] for s in segments], axis=0)
    sd = np.std(y, axis=0)
    rg = np.ptp(y, axis=0)
    return {"u_mean":np.mean(u, axis=0).tolist(),
            "u_sd":np.maximum(np.std(u, axis=0), 1e-6).tolist(),
            "y_mean":np.mean(y, axis=0).tolist(),
            "y_sd":np.maximum(sd, np.maximum(1e-6, rg*0.05)).tolist(),
            "y_min":np.min(y, axis=0).tolist(),
            "y_max":np.max(y, axis=0).tolist(),
            "sensor_floor":np.minimum(0., np.min(y, axis=0)-0.05*np.maximum(1.,rg)).tolist(),
            "pump_scale":np.maximum(1.,np.max(np.abs(u),axis=0)).tolist(),
            "sample_rows":int(len(y))}

def derived_score_scale(norm):
    std=np.asarray(norm["y_sd"], dtype=float)
    require(std.shape == (4,) and np.all(std > 0), "four original training source scales required")
    return std

def augmented_features(y_lags,u_lags,family):
    y_lags=np.asarray(y_lags, dtype=np.float64)
    u_lags=np.asarray(u_lags, dtype=np.float64)
    p=len(y_lags)
    require(p >= 1 and y_lags.shape==(p,4) and u_lags.shape==(p,2),
            "exact causal lagged source state/pump tensor expected")
    features=[1.]
    features.extend(y_lags.reshape(-1))
    features.extend(u_lags.reshape(-1))
    if family=="narx":
        y0=y_lags[0]
        u0=u_lags[0]
        features.extend((y0*y0).tolist())
        features.extend((u0*u0).tolist())
        for i in range(4):
            for j in range(i+1,4):
                features.append(y0[i]*y0[j])
        for i in range(4):
            for j in range(2):
                features.append(y0[i]*u0[j])
    elif family!="arx":
        raise ValueError("unknown registered nonlinear autoregression")
    return np.asarray(features,dtype=np.float64)

def candidate_features(u,y,norm,order,family,at):
    sc=norm
    y_lags=np.stack([(y[at-l]-sc["y_mean"])/sc["y_sd"]
                     for l in range(order)],axis=0)
    u_lags=np.stack([(u[at-l]-sc["u_mean"])/sc["u_sd"]
                     for l in range(order)],axis=0)
    return augmented_features(y_lags,u_lags,family)

def fit_data_model(segments,order,ridge,family):
    validate_segments(segments)
    require((order in ARX_ORDERS and family=="arx") or
            (order in NARX_ORDERS and family=="narx"),
            "only preregistered ARX/NARX order allowed")
    require(ridge in DATA_RIDGES, "only preregistered ridge allowed")
    norm=train_scale(segments)
    rows=[]
    targets=[]
    for segment in segments:
        u,y=validate_segment(segment)
        for at in range(order-1,len(u)-1):
            rows.append(candidate_features(u,y,norm,order,family,at))
            targets.append((y[at+1]-norm["y_mean"])/norm["y_sd"])
    x=np.stack(rows,axis=0)
    target=np.stack(targets,axis=0)
    gram=x.T@x
    penalizer=np.diag(np.r_[0., np.full(x.shape[1]-1,ridge*len(x))])
    right=x.T@target
    try:
        coeff=np.linalg.solve(gram+penalizer,right)
    except np.linalg.LinAlgError:
        coeff=np.linalg.lstsq(gram+penalizer,right,rcond=1e-10)[0]
    require(finite(coeff), "nonfinite original training ARX/NARX coefficients")
    return {"family":family,"order":int(order),"ridge":float(ridge),
            "coefficients":coeff.tolist(),"scale":norm,"trainRows":int(len(x)),
            "features":int(x.shape[1]),"causalInputLag":"pump at present t and earlier" }

def hyd_features(y,u,channel,variant,floor,pump_scale):
    require(variant in PHYS_VARIANTS, "registered source physics variant only")
    require(channel in (0,1,2,3), "four independent tank-state channels required")
    roots=np.sqrt(np.maximum(np.asarray(y)-np.asarray(floor),0.))
    pump=np.maximum(np.asarray(u,dtype=float),0.)/np.asarray(pump_scale)
    if channel==0:
        return np.array([-roots[0],roots[2],pump[0],1.] if variant=="coupled"
                        else [-roots[0],pump[0],1.],dtype=float)
    if channel==1:
        return np.array([-roots[1],roots[3],pump[1],1.] if variant=="coupled"
                        else [-roots[1],pump[1],1.],dtype=float)
    if channel==2:
        return np.array([-roots[2],pump[1],1.],dtype=float)
    return np.array([-roots[3],pump[0],1.],dtype=float)

def fit_physical_model(segments,variant,ridge):
    validate_segments(segments)
    require(variant in PHYS_VARIANTS and ridge in PHYS_RIDGES,
            "only preregistered signed square-root variants and ridges allowed")
    norm=train_scale(segments)
    floor=norm["sensor_floor"]
    scale=norm["pump_scale"]
    all_coeff=[]
    fits=[]
    for channel in range(4):
        rows=[]
        targets=[]
        for segment in segments:
            u,y=validate_segment(segment)
            for at in range(0,len(u)-HYD_WINDOW):
                # Ten-original-sample differencing reduces noise amplification
                # at the real physical ~0.1s sampling interval.
                row=hyd_features(y[at],np.mean(u[at:at+HYD_WINDOW],axis=0),
                                 channel,variant,floor,scale)
                rows.append(row)
                targets.append((y[at+HYD_WINDOW,channel]-y[at,channel])/HYD_WINDOW)
        x=np.asarray(rows,dtype=np.float64)
        target=np.asarray(targets,dtype=np.float64)
        require(len(x)>100 and finite(x) and finite(target),
                "unidentifiable measured source derivative dictionary")
        width=x.shape[1]
        feature_norm=np.maximum(np.sqrt(np.mean(x*x,axis=0)),1e-8)
        feature_norm[-1]=1.
        xscaled=x/feature_norm
        # Do not penalize arbitrary source voltage/level intercept. The other
        # signed coefficients are nonnegative by physical design.
        penalty=np.diag(np.r_[np.ones(width-1),0.])*math.sqrt(ridge*len(x))
        augmented=np.vstack([xscaled,penalty])
        responses=np.r_[target,np.zeros(width)]
        lower=np.r_[np.zeros(width-1),-np.inf]
        upper=np.full(width,np.inf)
        fit=lsq_linear(augmented,responses,bounds=(lower,upper),
                      method="trf",tol=1e-10,max_iter=1000)
        require(bool(fit.success) and finite(fit.x),
                "signed physical original training solver did not converge")
        coeff=fit.x/feature_norm
        require(np.min(coeff[:-1])>=-1e-9, "signed water flow coefficient negative")
        all_coeff.append(coeff.tolist())
        predicted=x@coeff
        fits.append({"channel":channel+1,"windowSamples":HYD_WINDOW,
            "trainTransitions":len(x),"derivativeRmseNative":
                float(np.sqrt(np.mean((predicted-target)**2))),
            "solverIterations":int(fit.nit),"solverStatus":int(fit.status)})
    return {"family":"physical","variant":variant,"ridge":float(ridge),
            "coefficients":all_coeff,"scale":norm,"fit":fits,
            "registration":"signed water sqrt own drainage, upper-to-lower coupling and positive pump actuation",
            "interpretation":"Native sensor units per sample. No independently calibrated SI flow or guaranteed identical valve settings across modes."}

def forecast(model,u,y_prefix,*,shift=0,zero_input=False):
    u=np.asarray(u,dtype=float)
    prefix=np.asarray(y_prefix,dtype=float)
    require(u.ndim==2 and u.shape[1]==2 and len(u)>PREFIX and finite(u),
            "finite two-pump source future trajectory required")
    require(prefix.shape==(PREFIX,4) and finite(prefix),
            "exact source-authorized first 64 four-tank sensor values required")
    source_u=np.roll(u,shift,axis=0) if shift else u
    if zero_input:source_u=np.zeros_like(source_u)
    result=np.empty((len(u),4),dtype=np.float64)
    result[:PREFIX]=prefix
    family=model.get("family")
    if family=="persistence":
        result[PREFIX:]=prefix[-1]
        return result
    if family in ("arx","narx"):
        order=int(model["order"])
        coeff=np.asarray(model["coefficients"])
        norm=model["scale"]
        for at in range(PREFIX-1,len(u)-1):
            f=candidate_features(source_u,result,norm,order,family,at)
            next_native=np.asarray(norm["y_mean"])+np.asarray(norm["y_sd"])*(f@coeff)
            if not finite(next_native) or np.max(np.abs(next_native))>1e9:
                raise ValueError("source-fitted autoregression diverged at "+str(at))
            result[at+1]=next_native
        return result
    if family=="physical":
        floor=np.asarray(model["scale"]["sensor_floor"])
        pump_scale=np.asarray(model["scale"]["pump_scale"])
        coefficients=[np.asarray(c) for c in model["coefficients"]]
        variant=model["variant"]
        for at in range(PREFIX-1,len(u)-1):
            y=result[at].copy()
            for _ in range(4):
                derivative=np.array([float(hyd_features(y,source_u[at],i,variant,
                                  floor,pump_scale)@coefficients[i])
                                     for i in range(4)])
                next_y=np.maximum(floor,y+0.25*derivative)
                if not finite(next_y) or np.max(np.abs(next_y))>1e9:
                    raise ValueError("original signed physical state diverged at "+str(at))
                y=next_y
            result[at+1]=y
        return result
    raise ValueError("unregistered source model family")

def score_model(model,segments,target_norm,*,shift=0,zero_input=False,swap_tank12=False,
                horizons=(1,30,120)):
    validate_segments(segments)
    scale=derived_score_scale(target_norm)
    errors=np.zeros(4,dtype=float)
    count=0
    by_segment=[]
    horizon_sum={h:np.zeros(4,dtype=float) for h in horizons}
    horizon_count={h:0 for h in horizons}
    prediction_hashes=[]
    import hashlib
    for segment in segments:
        u,y=validate_segment(segment)
        predicted=forecast(model,u,y[:PREFIX],shift=shift,zero_input=zero_input)
        prediction_hashes.append({"id":segment["id"],
          "sha256":hashlib.sha256(predicted.astype("<f8").tobytes()).hexdigest()})
        scored=predicted[PREFIX:]
        if swap_tank12:
            scored=scored[:,[1,0,2,3]]
        delta=scored-y[PREFIX:]
        require(finite(delta),"nonfinite original independent observed error")
        local=np.sum(delta*delta,axis=0)
        errors+=local
        count+=len(delta)
        item={"id":segment["id"],"scored":int(len(delta)),
              "perTankRmseNative":np.sqrt(local/len(delta)).tolist(),
              "perTankNrmse":(np.sqrt(local/len(delta))/scale).tolist()}
        by_segment.append(item)
        for h in horizons:
            num=min(int(h),len(delta))
            horizon_sum[h]+=np.sum(delta[:num]*delta[:num],axis=0)
            horizon_count[h]+=num
    require(count>0,"no valid original test samples beyond first64")
    rmse=np.sqrt(errors/count)
    normalized=rmse/scale
    return {"macroNormalizedRmse":float(np.mean(normalized)),
      "perTankRmseNative":rmse.tolist(),"perTankNrmse":normalized.tolist(),
      "scoredSamples":int(count),"sourceSegments":len(segments),
      "bySegment":by_segment,"horizonScores":{
        str(h):{"samples":horizon_count[h],
                "macroNormalizedRmse":float(np.mean(np.sqrt(horizon_sum[h]/horizon_count[h])/scale))}
                for h in horizons if horizon_count[h]},
      "predictionHashes":prediction_hashes,
      "metric":"macro of four sensor RMSE individually divided by original target MODE training per-channel std (floor >= max[1e-6,5% native range]); first64 output samples initialize only, no later measured output ever enters forecast."}

def fit_select_original(train_segments,dev_segments):
    validate_segments(train_segments)
    validate_segments(dev_segments)
    all_candidates=[]
    selected={}
    norms=train_scale(train_segments)
    registered=( [("arx",p,r,None) for p in ARX_ORDERS for r in DATA_RIDGES]
        +[("narx",p,r,None) for p in NARX_ORDERS for r in DATA_RIDGES]
        +[("physical",None,r,v) for v in PHYS_VARIANTS for r in PHYS_RIDGES] )
    for family,order,ridge,variant in registered:
        spec={"family":family,"order":order,"ridge":ridge,"variant":variant}
        try:
            m=(fit_physical_model(train_segments,variant,ridge) if family=="physical"
               else fit_data_model(train_segments,order,ridge,family))
            score=score_model(m,dev_segments,norms)
            all_candidates.append({"spec":spec,"model":m,
                  "devMacroNrmse":score["macroNormalizedRmse"],"devDetails":score})
        except Exception as error:
            all_candidates.append({"spec":spec,"error":str(error),
                  "devMacroNrmse":None})
    for family in ("arx","narx","physical"):
        options=[x for x in all_candidates if x["spec"]["family"]==family
                 and x.get("model") is not None
                 and np.isfinite(x["devMacroNrmse"])]
        if options:
            best=min(options,key=lambda x:x["devMacroNrmse"])
            selected[family]=best["model"]
    require("arx" in selected or "narx" in selected,
            "no stable source-fitted multivariate ARX or NARX baseline")
    refs=[x for x in all_candidates if x["spec"]["family"] in ("arx","narx")
          and x.get("model") is not None and np.isfinite(x["devMacroNrmse"])]
    best=min(refs,key=lambda x:x["devMacroNrmse"])
    selected["best_reference"]=best["model"]
    return {"selected":selected,
      "referenceType":selected["best_reference"]["family"],
      "referenceDevelopmentScore":best["devMacroNrmse"],
      "candidates":all_candidates,
      "physicalStatus":"fitted" if "physical" in selected else "all physical configurations refused",
      "trainingNormalization":norms,
      "sourceOnlySelection":True}
