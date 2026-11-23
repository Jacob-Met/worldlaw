"""Frozen finite-line measurement, disk quadrature and exact coupling checks."""
from datetime import datetime, timezone
import math
import numpy as np

C=299792.458
V=np.arange(-220,221,dtype=float)/10
DV=.1
COEFF=np.array([
[519.930,.23695,1.29927,-1.28034,1.37760,-.85054,.21706],
[541.760,.26073,1.27428,-1.30352,1.47085,-.96618,.26384],
[559.950,.26892,1.34319,-1.58427,1.91271,-1.31350,.37295],
[579.880,.28392,1.36896,-1.75998,2.22154,-1.56074,.44630],
[610.975,.30854,1.36620,-1.83572,2.33221,-1.63082,.45959],
[640.970,.33644,1.30590,-1.79238,2.45040,-1.89979,.59943]])
TAPER=np.where(abs(V)<=8,1,np.where(abs(V)>=12,0,(1+np.cos(np.pi*(abs(V)-8)/4))/2))


def feature(flux):
    left=np.median(flux[(V>=-14)&(V<=-12)])
    right=np.median(flux[(V>=12)&(V<=14)])
    continuum=(left+right)/2+(right-left)*V/26
    if min(continuum)<=0: raise ValueError("nonpositive continuum")
    q=np.maximum(1-flux/continuum,0)*TAPER
    e=q.sum()*DV
    if not np.isfinite(e) or e<=.2: raise ValueError(("line absorption support",e))
    center=np.dot(q,V)*DV/e
    return q,e,center,np.interp(V+center,V,q/e,left=0,right=0)


def solar_b0(date,hours=12):
    t=datetime.fromisoformat(date).replace(tzinfo=timezone.utc).timestamp()+3600*hours
    jd=t/86400+2440587.5
    d=jd-2451545.0
    rad=np.pi/180
    g=(357.528+.9856003*d)*rad
    longitude=(280.460+.9856474*d+1.915*np.sin(g)+.020*np.sin(2*g))*rad
    node=(73.6667+1.3958333*(jd-2396758)/36525)*rad
    return np.arcsin(np.sin(longitude-node)*np.sin(7.25*rad))


def annuli(mu_obs,profiles,lam,date,limb="constant",sidereal=False,hours=12):
    mu=(np.arange(96)+.5)/96
    w=np.array([np.interp(lam/10,COEFF[:,0],COEFF[:,k]) for k in range(1,7)])
    weights=2*mu*np.polynomial.polynomial.polyval(mu,w)
    if limb=="omit":weights[mu<mu_obs[0]]=0
    weights=weights/np.sum(weights)
    loc=np.stack([np.interp(mu,mu_obs,col) for col in profiles.T],axis=1)
    if limb=="linear":
        sel=mu<mu_obs[0]
        loc[sel]=np.maximum(0,profiles[0]+(mu[sel,None]-mu_obs[0])*(profiles[1]-profiles[0])/(mu_obs[1]-mu_obs[0]))
    b=solar_b0(date,hours);phi=(np.arange(192)+.5)*2*np.pi/192
    rad=np.sqrt(1-mu**2)[:,None]
    sinlat=np.sin(b)*mu[:,None]+np.cos(b)*rad*np.sin(phi)
    omega=(14.713-2.396*sinlat**2-1.787*sinlat**4-(0 if sidereal else .9856))
    vv=695700*np.pi/(180*86400)*omega*np.cos(b)*rad*np.cos(phi)
    kernels=[]
    for rr in vv:
        bins=np.rint(rr/DV).astype(int)+220
        k=np.bincount(bins,minlength=len(V)).astype(float)
        k=(k+k[::-1])/(2*len(rr))
        kernels.append(k)
    return weights,loc,np.array(kernels)


def convolve(a,k):
    return np.convolve(a,k,mode="same")


def profiles_for(mu,local,author,lam,date,limb="constant",sidereal=False,hours=12):
    w,local,k=annuli(mu,local,lam,date,limb,sidereal,hours)
    e=local.sum(axis=1)*DV; p=w*e/np.dot(w,e)
    if np.any(e<=0):raise ValueError("annulus lost all absorption")
    average=w@local
    paired=w@np.stack([convolve(x,ker) for x,ker in zip(local,k)])
    independent=convolve(average,p@k)
    unweighted=convolve(average,w@k)
    mean=(average@V)/np.sum(average)
    centers=local@V/local.sum(axis=1)
    var_kernel=k@(V**2)
    covariance=3*np.dot(p,(centers-np.dot(p,centers))*(var_kernel-np.dot(p,var_kernel)))
    errors=[]
    for power,want in ((0,0.),(1,0.),(2,0.),(3,covariance)):
        signed=np.dot(paired-independent,(V-mean)**power)/average.sum()
        err=abs(signed-want)
        if err>3e-7*max(1,abs(want)):raise ValueError(("finite convolution moment",lam,power,err))
        errors.append(err)
    sigma=(C/2.354820045)*np.sqrt(250000**-2-700000**-2)
    psf=np.exp(-.5*(V/sigma)**2);psf/=psf.sum()
    spectra=[1-convolve(x,psf) for x in (paired,independent,unweighted,average)]
    spectra.append(1-convolve(1-author,psf))
    return np.stack([feature(s)[3] for s in spectra]),dict(covariance=covariance,moment_error=errors,
           limb_below_point2_weight=float(w[(np.arange(96)+.5)/96<.2].sum()),B0_degrees=float(np.rad2deg(solar_b0(date,hours))))
