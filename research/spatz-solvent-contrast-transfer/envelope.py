"""Continuous passivity bound on positively averaged powers."""
import math
import numpy as np
from scipy.special import ndtr
from forecast import SIGMA, SLD, TRAIN, HELD

def amplitude_radius(qa,wa,ra,qb,wb,rb):
    # Gaussians are normalized on the full signed-q axis. The unsupported
    # negative-q and critical-edge regions get the universal unit discrepancy.
    sa=wa/SIGMA;sb=wb/SIGMA
    overlap=np.sqrt(2*sa*sb/(sa*sa+sb*sb))*np.exp(-(qa-qb)**2/(4*(sa*sa+sb*sb)))
    H=np.sqrt(np.maximum(0,2-2*np.minimum(1,overlap)))
    best=np.ones_like(qa)
    for depth in (2.,3.,4.,5.,6.,7.,8.):
        # Integrating against the donor kernel suffices since min(Ka,Kb)<=Ka.
        # delta(q) decreases above the largest propagation threshold.
        left=qa-depth*sa
        aa=(left/2)**2-4*np.pi*(ra-2.07)*1e-6
        bb=(left/2)**2-4*np.pi*(rb-2.07)*1e-6
        ya=np.sqrt(np.maximum(aa,0));yb=np.sqrt(np.maximum(bb,0))
        delta=np.where((left>0)&(aa>0)&(bb>0),np.abs(ya-yb)/np.maximum(ya+yb,1e-30),1.)
        tail=float(ndtr(-depth))
        bound=H+np.sqrt(delta**2*(1-tail)+tail)
        best=np.minimum(best,bound)
    # Small numerical cushion; the proof is analytic, these evaluations use
    # binary64 transcendental functions and are not directed-rounding certificates.
    return np.minimum(1,best+2e-12)

def envelopes(train,design):
    rows=[(n,np.asarray(train[str(n)]["q"]),np.asarray(train[str(n)]["fwhm"]),
           np.asarray(train[str(n)]["R"]),np.asarray(train[str(n)]["dR"])) for n in TRAIN]
    bad=[];limits={}
    for n,q,w,r,err in rows:
        lo=np.maximum(0.,r-3*err);hi=np.minimum(1.,r+3*err)
        bad += [[n,int(i),float(r[i]),float(err[i])] for i in np.where(lo>hi)[0]]
    pair_violations=[]
    for n,q,w,r,err in rows:
        for j,(qb,wb,rval,se) in enumerate(zip(q,w,r,err)):
            for a,qa,wa,rr,ee in rows:
                radius=amplitude_radius(qa,wa,SLD[a],qb,wb,SLD[n])
                la=np.maximum(0,rr-3*ee);ha=np.minimum(1,rr+3*ee)
                lb=max(0,rval-3*se);hb=min(1,rval+3*se)
                gap=np.maximum(np.sqrt(la)-np.sqrt(max(hb,0)),np.sqrt(lb)-np.sqrt(np.maximum(0,ha)))
                for i in np.where(gap>radius)[0]:
                    if (a,int(i))<(n,j):
                        pair_violations.append([a,int(i),n,j,float(gap[i]),float(radius[i])])
    for n in HELD:
        out=[]
        for q,w in zip(design[str(n)]["q"],design[str(n)]["fwhm"]):
            lower=0.; upper=1.
            for a,qa,wa,r,err in rows:
                lo=np.maximum(0.,r-3*err);hi=np.minimum(1.,r+3*err)
                radius=amplitude_radius(qa,wa,SLD[a],q,w,SLD[n])
                lower=max(lower,float(np.max(np.maximum(0,np.sqrt(lo)-radius)**2)))
                upper=min(upper,float(np.min(np.minimum(1,np.sqrt(np.maximum(0,hi))+radius)**2)))
            out.append([lower,upper])
        limits[str(n)]=out
    return {"limits":limits,"outside_physical_training":bad,"incompatible_training_pairs":pair_violations,"global_feasible":False if bad or pair_violations else None,
            "notes":"These are necessary pairwise outer bounds. Passing every check does not prove a joint film exists. An empty observed training band globally rejects this model-and-tolerance system."}
