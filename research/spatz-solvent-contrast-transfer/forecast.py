"""Predict raw unstitched Spatz measurements using only D2O and H2O."""
import numpy as np
from scipy.special import expit
from scipy.optimize import least_squares, differential_evolution
from refnx.reflect import reflectivity

TRAIN=(3493,3494,3500,3501)
HELD=(3495,3496,3497,3498,3499)
SLD={3493:6.36,3494:6.36,3495:4.,3496:4.,3497:4.,3498:2.07,3499:2.07,3500:-.56,3501:-.56}
SIGMA=np.sqrt(8*np.log(2))
XG,WG=np.polynomial.hermite.hermgauss(25)
WG=WG/np.sqrt(np.pi)
KNOT=np.r_[np.arange(0.,.060,.003),np.arange(.060,.321,.006)]
SCALE=1e-5

def mix(s):
    return (np.asarray(s)+.56)/(6.36+.56)

def pack(design, roster):
    records=[design[str(n)] for n in roster]
    q=np.concatenate([a["q"] for a in records])
    w=np.concatenate([a["fwhm"] for a in records])
    s=np.repeat([SLD[n] for n in roster],[len(a["q"]) for a in records])
    return q,w,s

def nodes(q,w):
    return np.abs(q[:,None]+np.sqrt(2)*w[:,None]*XG[None,:]/SIGMA)

def observed(train):
    return (np.concatenate([train[str(n)]["R"] for n in TRAIN]),
            np.maximum(1e-8,np.concatenate([train[str(n)]["dR"] for n in TRAIN])))

def cal_by_angle(train,n,target_q):
    low=3493 if n in (3495,3496,3498) else 3494
    high=3500 if low==3493 else 3501
    return [np.interp(target_q, train[str(j)]["q"],train[str(j)]["R"]) for j in (low,high)]

def empirical(train,n,q):
    d,h=cal_by_angle(train,n,q)
    f=mix(SLD[n])
    return {"linear_SLD":f*d+(1-f)*h,
            "asinh_SLD":SCALE*np.sinh(f*np.arcsinh(d/SCALE)+(1-f)*np.arcsinh(h/SCALE)),
            "nearest_contrast":d.copy() if f>=.5 else h.copy()}

def disk_design(q,w,s):
    qq=nodes(q,w)
    kv=np.maximum(qq*.5,1e-15)
    yy2=kv**2-4*np.pi*(s[:,None]-2.07)*1e-6
    yc=np.sqrt(np.maximum(yy2,0.))
    x=(yc-kv)/(yc+kv)
    lo=np.clip(np.searchsorted(KNOT,qq)-1,0,len(KNOT)-2)
    f=np.clip((qq-KNOT[lo])/(KNOT[lo+1]-KNOT[lo]),0.,1.)
    return x,yy2<=0,lo,f

def disk_eval(params,cal,solvent,jac=False):
    x,closed,lo,f=cal;nk=len(KNOT)
    A,B,bg=params[:nk],params[nk:2*nk],params[-2:]
    u=expit((1-f)*A[lo]+f*A[lo+1])
    c=np.tanh((1-f)*B[lo]+f*B[lo+1])
    numerator=u*u+2*x*u*c+x*x
    den=1+2*x*u*c+(x*u)**2
    value=np.where(closed,1.,numerator/den)
    bgweights=np.column_stack([1-mix(solvent),mix(solvent)])*1e-4
    if not jac:return value@WG + bgweights@bg
    da=((2*u+2*x*c)*den-numerator*(2*x*c+2*x*x*u))/(den*den)*u*(1-u)
    db=(2*x*u)*(den-numerator)/(den*den)*(1-c*c)
    da=np.where(closed,0,da)*WG; db=np.where(closed,0,db)*WG
    J=np.zeros((len(x),len(params)))
    rows=np.arange(len(x))[:,None]
    for off,dv in [(0,da),(nk,db)]:
        np.add.at(J,(rows,off+lo),dv*(1-f))
        np.add.at(J,(rows,off+lo+1),dv*f)
    J[:,-2:]=bgweights
    return J

def fit_disk(design,train):
    q,w,s=pack(design,TRAIN);cal=disk_design(q,w,s);y,dy=observed(train)
    nk=len(KNOT);D=np.diff(np.eye(nk),n=2,axis=0)
    reg=np.zeros((2*len(D),2*nk+2))
    reg[:len(D),:nk]=D;reg[len(D):,nk:2*nk]=D
    x0=np.r_[np.interp(KNOT,[0,.012,.035,.15,.32],[2,-1,-3.8,-6,-9]),np.zeros(nk+2)]
    def cost(p):return np.r_[(disk_eval(p,cal,s)-y)/dy,reg@p]
    def jac(p):return np.vstack([disk_eval(p,cal,s,True)/dy[:,None],reg])
    fit=least_squares(cost,x0,jac=jac,bounds=(np.r_[np.full(nk,-16),np.full(nk,-5),-3,-3],np.r_[np.full(nk,9),np.full(nk,5),3,3]),max_nfev=600)
    return fit.x,{"cost":float(2*fit.cost),"nfev":int(fit.nfev),"status":int(fit.status),"optimality":float(fit.optimality)}

# Ambient silicon, two finite slabs, terminal water. The author model varies two
# solvent volume fractions and backgrounds. Common layer properties are fitted
# on the four endpoint-solvent scans. Intermediate fitted archive values are excluded.
def slab_eval(p,q,w,s,solvated,free_backing=False):
    t1,r1,h1,t2,r2,h2,hback=p[:7]
    hfrac,pfrac=(p[7],p[8]) if solvated else (0.,0.)
    fraction=mix(s)
    water=(1-fraction)*p[-4]+fraction*p[-3] if free_backing else np.asarray(s)
    qq=nodes(q,w)
    result=np.empty(len(q))
    for val in np.unique(water):
        mask=water==val
        layers=np.array([[0.,2.07,0.,0.],[t1,(1-hfrac)*r1+hfrac*val,0.,h1],
                         [t2,(1-pfrac)*r2+pfrac*val,0.,h2],[0.,val,0.,hback]])
        raw=reflectivity(qq[mask].flatten(),layers,scale=1.,bkg=0.,dq=0.,threads=1)
        result[mask]=raw.reshape((-1,len(WG)))@WG
    return result+1e-4*((1-mix(s))*p[-2]+mix(s)*p[-1])

def fit_slab(design,train,solvated,free_backing=False):
    q,w,s=pack(design,TRAIN);y,dy=observed(train)
    bounds=[(0,250),(-.56,6.36),(0,45),(30,2500),(-.56,6.36),(0,60),(0,100)]
    if solvated:bounds += [(0,1),(0,1)]
    if free_backing:bounds += [(-.56,2.90),(2.90,6.36)]
    bounds += [(-3,3),(-3,3)]
    def residual(p):return (slab_eval(p,q,w,s,solvated,free_backing)-y)/dy
    def score(p):
        r=residual(p);return r@r
    solutions=[]
    for seed in (27,193):
        pop=differential_evolution(score,bounds,popsize=7,maxiter=120,tol=1e-6,seed=seed,polish=False,updating="immediate")
        refined=least_squares(residual,pop.x,bounds=np.array(bounds).T,max_nfev=350,x_scale="jac")
        solutions.append((float(2*refined.cost),refined.x,int(pop.nfev),int(refined.nfev)))
    best=min(solutions,key=lambda line:line[0])
    return best[1],{"solutions":[[c,ng,nl] for c,_,ng,nl in solutions],"seeds":[27,193]}

def forecasts(design,train):
    pars,dc=fit_disk(design,train);sp,sc=fit_slab(design,train,True);dry,xc=fit_slab(design,train,False)
    free,fc=fit_slab(design,train,True,True)
    estimates={}
    for n in HELD:
        q,w,s=pack(design,[n]);e=empirical(train,n,q)
        e["shared_disk"]=disk_eval(pars,disk_design(q,w,s),s)
        e["author_solvated_slabs"]=slab_eval(sp,q,w,s,True)
        e["author_free_backing"]=slab_eval(free,q,w,s,True,True)
        e["dry_slabs"]=slab_eval(dry,q,w,s,False)
        estimates[str(n)]={name:v.tolist() for name,v in e.items()}
    return {"points":estimates,"fits":{"disk":{"p":pars.tolist(),**dc},"solvated":{"p":sp.tolist(),**sc},"dry":{"p":dry.tolist(),**xc},"solvated_free_backing":{"p":free.tolist(),**fc}}}
