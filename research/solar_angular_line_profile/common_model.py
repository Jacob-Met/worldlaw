"""Disk predictions and endpoint on the common author-supported core."""
import numpy as np
from model import C, V, DV, annuli, convolve

def window(flat=5.,edge=7.3):
    a=np.abs(V)
    return np.where(a<=flat,1.,np.where(a>=edge,0.,.5+.5*np.cos(np.pi*(a-flat)/(edge-flat))))

def sample(x,y):
    keep=np.abs(x)<=8
    x=x[keep];y=y[keep];z=V[np.abs(V)<7.3]
    j=np.searchsorted(x,z)
    if np.any(j==0) or np.any(j==len(x)):raise ValueError("missing in-window bracket")
    gap=x[j]-x[j-1]
    if np.min(gap)<=0 or np.max(gap)>.7 or not np.all(np.isfinite(y[np.r_[j-1,j]])):
        raise ValueError("invalid gap/finite coordinate")
    out=np.zeros_like(V)
    out[np.abs(V)<7.3]=np.interp(z,x,y)
    return out

def depth(flux,flat=5.,edge=7.3):
    return np.maximum(0,1-flux)*window(flat,edge)

def measure(d):
    z=d*window();area=np.sum(z)*DV
    if not np.isfinite(area) or area<=.2:raise ValueError("small line area")
    c=np.dot(z,V)*DV/area
    if abs(c)>2:raise ValueError(("large centroid",float(c)))
    return np.interp(V+c,V,z/area,left=0,right=0),[float(area),float(c)]

def predict(mu,local,auth,lam,date,flat=5.,edge=7.3,**geometry):
    D=np.stack([depth(row,flat,edge) for row in local])
    w,D,K=annuli(mu,D,lam,date,**geometry)
    E=D.sum(1)*DV
    if min(E)<=.2:raise ValueError("small local area")
    p=w*E/(w@E);aver=w@D
    paired=w@np.stack([convolve(d,k) for d,k in zip(D,K)])
    ind=convolve(aver,p@K)
    cent=D@V/D.sum(1);spread=K@(V**2)
    cov=3*np.dot(p,(cent-p@cent)*(spread-p@spread))
    deltas=[float((paired-ind)@((V-p@cent)**h)/aver.sum()) for h in range(4)]
    if max(abs(a-b)/max(1,abs(b)) for a,b in zip(deltas,[0,0,0,cov]))>3e-7:raise ValueError("moment identity")
    sigma=(C/2.354820045)*np.sqrt(250000**-2-700000**-2)
    psf=np.exp(-.5*(V/sigma)**2);psf/=sum(psf)
    fields=[paired,ind,convolve(aver,w@K),aver,depth(auth,flat,edge)]
    out=[];detail=[]
    for f in fields:
        a,b=measure(convolve(f,psf));out.append(a);detail.append(b)
    # Physical wing contamination bound is conditional on depth <=1, before
    # recentering/area normalization. Compute actual kernel weights reaching
    # the raw central output interval from native inputs exterior to ±8.
    kernel=np.sum(w[:,None]*np.stack([convolve(k,psf) for k in K]),axis=0)
    exterior=np.abs(V)>8
    leak=convolve(exterior.astype(float),kernel)
    return np.stack(out),dict(covariance=float(cov),moments=deltas,area_center=detail,
            edge_weight_raw_r3=float(np.max(leak[np.abs(V)<=3])),edge_weight_raw_r5=float(np.max(leak[np.abs(V)<=5])),
            shift=float(np.max(abs(V[np.any(K>0,axis=0)]))),sigma=float(sigma))
