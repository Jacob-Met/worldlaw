"""Polarization-current prediction at supplied potential for a rotating disk."""
import math
import numpy as np
from scipy.optimize import least_squares

F = 96485.3
RT = 8.314 * 298.15
KW = 10.0 ** -13.9918
H_BULK = 10.0 ** -10.458
XI = H_BULK - KW / H_BULK
AREA = math.pi * 0.25**2
SOURCE = [400,625,900,1600,2025]
HELD = [1225,2500]
METALS = ['Au','Ir','Pt']
START = {'Au':(-19,1.3),'Pt':(-14,1.33),'Ir':(-5,1.1)}

def intrinsic(e, rpm, par):
    diffusivity, log_rate, alpha, resistance, background = par
    d = diffusivity * 1e-7
    nu = 0.8917e-4
    delta = nu**(1/6) * d**(1/3) * math.gamma(1/3) / (3**(2/3) * 0.51023**(1/3) * np.sqrt(np.asarray(rpm)*math.pi/30))
    reduced = F*(e + 0.197 - 1.229)/RT - math.log(KW)/2
    def theta(power):
        return 2*(1 + 2*10**(log_rate+1)*delta/d*np.exp(np.clip(power*reduced,-300,300)))
    ta, tb = theta(alpha), theta(alpha-2)
    hydroxide = (-XI + np.sqrt(XI*XI + KW*ta*tb))/ta
    return .01*F*d/delta*(KW/hydroxide - hydroxide - XI) + background

def forward(e,rpm,par):
    e=np.asarray(e,dtype=float)
    if par[3]==0:
        return intrinsic(e,rpm,par)
    lo,hi=e-3,e+3
    def potential(x):
        return x + par[3]*intrinsic(x,rpm,par)
    if np.any(potential(lo)>e) or np.any(potential(hi)<e):
        raise ValueError("ohmic bracket")
    for _ in range(47):
        mid=(lo+hi)/2
        high=potential(mid)>e
        lo=np.where(high,lo,mid)
        hi=np.where(high,mid,hi)
    return intrinsic((lo+hi)/2,rpm,par)

def fit(source,metal,filtered=False,zero_rs=False):
    E=[];J=[];S=[];W=[]
    for rpm in SOURCE:
        e,j=source[rpm]
        eligible=np.flatnonzero(j>max(j)/100) if filtered else np.arange(len(j))
        if len(eligible)<4:
            raise ValueError("insufficient design")
        idx=eligible[np.unique(np.rint(np.linspace(0,len(eligible)-1,min(len(eligible),50 if filtered else 100))).astype(int))]
        E.extend(e[idx]);J.extend(j[idx]);S.extend(np.full(len(idx),rpm))
        val,count=np.unique(j,return_counts=True)
        mode=val[np.argmax(count)]
        W.extend(np.exp(-6*(j[idx]-.25*mode)))
    e,j,s,w=map(np.asarray,(E,J,S,W))
    weight=np.sqrt((w-w.min())/(w.max()-w.min())) if filtered and np.ptp(w)>0 else np.ones(len(w))
    logk,alpha=START[metal]
    initial=[4.18,logk,alpha,10,0]
    lower=[.05,-36,.02,.000001,-.05];upper=[50,-.01,1.98,300,.05]
    use=[0,1,2,4] if zero_rs else list(range(5))
    def unpack(x):
        values=np.array(initial,dtype=float);values[use]=x
        if zero_rs: values[3]=0
        return values
    def residual(x):
        return (forward(e,s,unpack(x))-j)*weight
    opt=least_squares(residual,np.array(initial)[use],bounds=(np.array(lower)[use],np.array(upper)[use]),x_scale='jac',max_nfev=250,gtol=1e-12,ftol=1e-11,xtol=1e-11)
    if not opt.success or not np.isfinite(opt.fun).all(): raise ValueError("training optimizer failed")
    return unpack(opt.x),{'evaluations':opt.nfev,'objective':opt.cost,'active_constraints':opt.active_mask.tolist()}

def lookup(e,y,target):
    x,ix=np.unique(e,return_inverse=True)
    mean=np.bincount(ix,weights=y)/np.bincount(ix)
    return np.interp(target,x,mean)

def predict(source,metal,targets):
    pars={};metrics={}
    for role,filtered,zero in [('notebook_equations_full',False,False),('notebook_equations_filtered',True,False),('physics_without_solution_resistance',False,True)]:
        pars[role],metrics[role]=fit(source,metal,filtered,zero)
    main=pars['notebook_equations_full'];out={}
    for speed,e in targets.items():
        pair=[900,1600] if speed==1225 else [1600,2025]
        a,b=pair
        t=(math.sqrt(speed)-math.sqrt(a))/(math.sqrt(b)-math.sqrt(a))
        u=(speed-a)/(b-a)
        nearest=min(SOURCE,key=lambda v:abs(math.sqrt(v)-math.sqrt(speed)))
        ys={r:lookup(*source[r],e) for r in SOURCE}
        residual={r:lookup(source[r][0],source[r][1]-forward(source[r][0],r,main),e) for r in pair}
        data={k:forward(e,speed,v) for k,v in pars.items()}
        root=np.sqrt(SOURCE);weights=(np.sqrt(speed)-root.mean())*(root-root.mean())/np.sum((root-root.mean())**2)+1/len(SOURCE)
        data.update(physics_fixed_speed=forward(e,nearest,main),nearest_speed=ys[nearest],current_linear_sqrt_rpm=ys[a]+t*(ys[b]-ys[a]),current_linear_rpm=ys[a]+u*(ys[b]-ys[a]),all_source_linear_sqrt_rpm=sum(w*ys[r] for w,r in zip(weights,SOURCE)),scaled_limiting_flux=ys[nearest]*math.sqrt(speed/nearest),corrected_physics=data['notebook_equations_full']+(1-t)*residual[a]+t*residual[b])
        if not all(np.isfinite(v).all() for v in data.values()): raise ValueError("nonfinite forecast")
        out[str(speed)]={k:v.tolist() for k,v in data.items()}
    return {'params':{k:v.tolist() for k,v in pars.items()},'fit':metrics,'predictions':out}
