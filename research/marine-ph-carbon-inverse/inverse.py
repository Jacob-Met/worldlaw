"""Infer conserved inorganic carbon and alkalinity from measured total-pH bath series.

Concentrations are µmol/kg. All input baths are at atmospheric pressure. The
parameterization below matches one of the source's evaluated constant combinations.
"""
import numpy as np
from scipy.optimize import linprog, lsq_linear
import PyCO2SYS as carb

BASE = {"opt_k_carbonic":14, "opt_total_borate":2, "opt_k_bisulfate":1,
        "opt_k_fluoride":1, "opt_pH_scale":1, "pressure":0.,
        "total_ammonia":0., "total_sulfide":0.}


def lines(s, t, ph, phosphate, silicate, *, carbonic=14, boron=2):
    """The published solver is affine in DIC when pH is supplied."""
    common={**BASE,"opt_k_carbonic":carbonic,"opt_total_borate":boron,
            "par1":ph,"par1_type":3,"par2_type":2,"temperature":t,
            "salinity":s,"total_phosphate":phosphate,"total_silicate":silicate}
    one=carb.sys(par2=1000.,**common)["alkalinity"]
    two=carb.sys(par2=2000.,**common)["alkalinity"]
    z=(two-one)/1000.
    return z,one-1000.*z


def rectangle(zlo,blo,zhi,bhi):
    """Return unrestricted nonnegative-concentration extrema for joint pH strips."""
    rows=np.vstack((np.column_stack([-np.ones_like(zlo),zlo]),
                    np.column_stack([np.ones_like(zhi),-zhi])))
    bound=np.concatenate((-blo,bhi))
    status=[]; endpoints=[]
    for i,sign in ((0,1),(0,-1),(1,1),(1,-1)):
        cost=np.zeros(2);cost[i]=sign
        sol=linprog(cost,A_ub=rows,b_ub=bound,bounds=(0.,None),method="highs")
        status.append(int(sol.status))
        if sol.success:
            if np.max(rows@sol.x-bound)>2e-6:raise ValueError("LP residual")
            endpoints.append(float(sol.x[i]))
        elif sol.status in (2,3):
            endpoints.append(None)
        else:
            raise ValueError(("LP failure",sol.status,sol.message))
    # Increasing DIC by one and TA by k keeps every inequality if k
    # belongs to the intersection of the measured-bath slope intervals.
    # This exposes data-permitted rays directly rather than capping molarity.
    ray=[float(np.max(zlo)),float(np.min(zhi))]
    return {"status":status,"TA_min_max":endpoints[:2],"DIC_min_max":endpoints[2:],
            "recession_slope_intersection":ray,"nonnegative_ray":max(0.,ray[0])<=ray[1]}


def optical(s,t,ph,p,si, *, carbonic=14, boron=2, envelopes=True):
    t,ph=np.asarray(t,float),np.asarray(ph,float)
    if not len(ph) or len(ph)!=len(t) or not np.all(np.isfinite(ph+t)):
        raise ValueError("requires every supplied zero-dye bath")
    opts={"carbonic":carbonic,"boron":boron}
    z,b=lines(s,t,ph,p,si,**opts)
    X=np.column_stack((np.ones_like(z),-z))
    # This salinity-only scale is solely for scaling the measured pH residual
    # into concentration units. It is never used as a target or prior penalty.
    step=.0001
    za,ba=lines(s,t,ph-step,p,si,**opts);zb,bb=lines(s,t,ph+step,p,si,**opts)
    slope=((zb-za)*65.*s+(bb-ba))/(2.*step)
    if not np.all(slope>0):raise ValueError("non-positive pH response")
    lhs=np.vstack((X,-X));rhs=np.r_[b,-b]
    sol=linprog([0.,0.,1.],A_ub=np.column_stack((lhs,-np.r_[slope,slope])),
                b_ub=rhs,bounds=(0.,None),method="highs")
    if not sol.success:raise ValueError(("minimax LP",sol.message))
    sir=np.linalg.svd(X,compute_uv=False).tolist()
    uu=lsq_linear(X,b,bounds=(0.,np.inf))
    ww=lsq_linear(X/slope[:,None],b/slope,bounds=(0.,np.inf))
    idx=np.array([np.argmin(t),np.argmax(t)])
    zz=lsq_linear(X[idx],b[idx],bounds=(0.,np.inf))
    out={"minimax":sol.x[:2].tolist(),"ols":uu.x.tolist(),"scaled_ls":ww.x.tolist(),
         "endpoint_pair":zz.x.tolist(),"z":z.tolist(),"buffer":b.tolist(),
         "singular_values":sir,"pH_concentration_scale":slope.tolist(),"scaled_max_pH_residual":float(sol.x[2])}
    if envelopes:
        out["engineering_pH_strips"]={}
        out["pH_strip_coefficients"]={}
        for delta in (.0005,.003,.010):
            zl,bl=lines(s,t,ph-delta,p,si,**opts)
            zh,bh=lines(s,t,ph+delta,p,si,**opts)
            if np.any(zh<zl) or np.any(bh<bl):
                raise ValueError("endpoint monotonicity is required for nonnegative DIC")
            out["engineering_pH_strips"][str(delta)]=rectangle(zl,bl,zh,bh)
            out["pH_strip_coefficients"][str(delta)]=[x.tolist() for x in (zl,bl,zh,bh)]
    return out
