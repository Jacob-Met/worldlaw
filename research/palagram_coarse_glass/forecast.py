"""Fit only the 61 allowed releases and emit frozen trajectories for the 13 complete held runs."""
import hashlib
import json
import time
import warnings
import numpy as np
from scipy.optimize import least_squares

from course import COURSE, DESIGN, GRID, POLICY, conditions, member, observe

START=time.monotonic()
source=[i for i,r in enumerate(DESIGN) if not r["held"]]
held=[i for i,r in enumerate(DESIGN) if r["held"]]
assert (len(source),len(held))==(61,13)
y=np.full((len(DESIGN),len(GRID)),np.nan)
saved=[]
for i in source:
    y[i]=observe(DESIGN[i])[0]
    with member(DESIGN[i],output=True) as f:
        saved.append([float(f["Fr"][()]),float(f["lamb"][()])])
valid=np.isfinite(y[source])
counts=valid.sum(axis=1)
assert min(counts)>0
weight=1/np.sqrt(counts[:,None])
def residual(p):
    return ((p[source]-np.nan_to_num(y[source]))*weight)[valid]

def props(alt=False):
    cs=[conditions(r,alt) for r in DESIGN]
    return {k:np.array([a[k] for a in cs])[:,None] for k in cs[0]}
base=props()
quad,qw=np.polynomial.legendre.leggauss(20)
nodes=(quad+1)/2
weights=qw/2
def parametric(c,b,k,kind,skey,alt=False):
    p=alternate if alt else base
    u=GRID[None,:]*base["t0"]/p["t0"]
    S=p[skey]
    rate=k*S
    if kind=="finite":
        end=np.minimum(u,np.divide(1,rate,out=np.full_like(rate,np.inf),where=rate>0))
        # Transform s=end*(1-v^2), smoothing the square-root endpoint at exhaustion.
        s=end[:,:,None]*(1-nodes**2)
        integrand=np.sqrt(np.maximum(1-rate[:,:,None]*s,0))*np.exp(-b*s)
        path=end*np.sum(integrand*(2*nodes*weights),axis=-1)
    else:
        decay=b+rate/2
        path=np.divide(-np.expm1(-decay*u),decay,out=u.copy(),where=decay!=0)
    return c*p["froude"]*path
alternate=props(True)
pred={}; fits={}
def fit_role(role,kind,skey,alt=False):
    n=1 if role=="constant_velocity" else 2 if role=="hydraulic_decay" else 3
    def predict(theta):
        return parametric(*list(theta)+[0.]*(3-n),kind,skey,alt)
    starts=([.9],[1.2]) if n==1 else ([.9,.015],[1.1,.06]) if n==2 else ([.9,.01,1.],[1.2,.05,.1],[1.2,.005,4.],[1.,.08,9.])
    tries=[]
    for a in starts:
        o=least_squares(lambda w:residual(predict(w)),a,bounds=(0,[3,.2,10][:n]),max_nfev=400,ftol=1e-10,xtol=1e-10,gtol=1e-10)
        tries.append({"theta":list(o.x),"ss":float(np.dot(o.fun,o.fun)),"nfev":o.nfev,"status":o.status})
    best=min(tries,key=lambda f:f["ss"])
    pred[role]=predict(best["theta"]);fits[role]=tries

for args in [("finite_column","finite","eff",False),("mixed_column","mixed","eff",False),
             ("finite_raw_stokes","finite","raw",False),("mixed_raw_stokes","mixed","raw",False),
             ("finite_no_hindrance","finite","nohind",False),("hydraulic_decay","mixed","eff",False),
             ("constant_velocity","mixed","eff",False),("finite_glass2500","finite","eff",True)]:
    fit_role(*args)

# Published Fig5 thresholds and quadratic trajectory, using source-only fitted outcomes.
F,L=np.asarray(saved).T; X=np.maximum(0,base["raw"].ravel()-.01)
m=np.isfinite(L); denom=np.dot(X[source][m],X[source][m]); assert denom>0
slope=np.dot(X[source][m],L[m])/denom
pred["author_fr_lambda"]=np.nanmean(F)*GRID*(1-slope*X[:,None]*GRID)
fits["author_fr_lambda"]={"mean_fr":float(np.nanmean(F)),"attenuation_slope":slope,
    "source_coefficients":[[DESIGN[i]["id"],*[v if np.isfinite(v) else None for v in row]] for i,row in zip(source,saved)]}
# Linear reparameterization of cF u(1-(l0+l1*hinge)u).
F0=base["froude"]; columns=[F0*GRID,F0*GRID**2,F0*X[:,None]*GRID**2]
A=np.stack(columns,axis=2)
B=(A[source]*weight[:,:,None])[valid]; obs=(np.nan_to_num(y[source])*weight)[valid]
theta=np.linalg.lstsq(B,obs,rcond=None)[0]
pred["author_hinge_fit"]=A@theta;fits["author_hinge_fit"]=list(theta)

group=np.array([str(r["d"]) if r["material"]=="glass beads" else r["material"] for r in DESIGN])
features=np.array([[base["raw"][i,0],r["phi"],np.log(base["re"][i,0]),np.log(r["d"] or .0001),
            float(r["material"]=="saline water")] for i,r in enumerate(DESIGN)])
def ridge(train,k):
    z=(features-features[train].mean(0))/np.maximum(features[train].std(0),1.e-8)
    z=np.column_stack([np.ones(len(z)),z,z*z,z[:,0]*z[:,1]])
    # Degree 1-3 in common dimensionless time. Extrapolations remain visible.
    A=np.concatenate([z[:,None,:]*(GRID[None,:,None]/10)**i for i in (1,2,3)],axis=-1)
    mask=np.isfinite(y[train]); w=1/np.sqrt(np.sum(mask,axis=1))[:,None]
    x=(A[train]*w[:,:,None])[mask]; target=(np.nan_to_num(y[train])*w)[mask]
    coef=np.linalg.solve(x.T@x+k*np.eye(x.shape[1]),x.T@target)
    return A@coef,coef
cv=[]
for k in (.0001,.001,.01,.1,1.,10.,100.):
    errs=[]
    for g in sorted(set(group[source])):
        train=[i for i in source if group[i]!=g]; validrows=[i for i in source if group[i]==g]
        out,_=ridge(train,k)
        errs.append(float(np.nanmean(np.nanmean((out[validrows]-y[validrows])**2,axis=1))))
    cv.append([float(np.mean(errs)),k])
best=min(cv)[1]
pred["empirical_curve"],coef=ridge(source,best);fits["empirical_curve"]={"cv":cv,"ridge":best,"coef":list(coef)}
medium=[i for i in source if DESIGN[i]["material"]=="glass beads" and .00013<DESIGN[i]["d"]<.00014]
assert len(medium)==8
pred["frozen_medium_curve"]=np.tile(np.nanmean(y[medium],axis=0),(len(DESIGN),1))
assert set(pred)==set(POLICY["roles"]) and all(np.isfinite(a).all() for a in pred.values())
report={"roles":POLICY["roles"],"source":{},"held":{},"fits":fits,"clock_grid":list(GRID),
        "train_seconds":time.monotonic()-START,"source_raw_positions_opened":61,"held_positions_opened":0}
for i in source:
    z={"valid":int(np.isfinite(y[i]).sum()),"rmse_mm":{}}
    for name,a in pred.items(): z["rmse_mm"][name]=float(np.sqrt(np.nanmean((a[i]-y[i])**2))*DESIGN[i]["L0"]*1000)
    report["source"][DESIGN[i]["id"]]=z
for i in held:
    report["held"][DESIGN[i]["id"]]={k:list(a[i]*DESIGN[i]["L0"]) for k,a in pred.items()}
print("LOCKED "+json.dumps(report,sort_keys=True,allow_nan=False,separators=(',',':')))
