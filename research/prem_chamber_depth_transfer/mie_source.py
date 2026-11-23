"""Translate the deposited Maetzler Mie coefficient equations for scalar size and index."""
import numpy as np
from scipy.special import jv,yv
def coefficients(m,wavelength,d,packing=.37):
    x=np.pi*d/wavelength;z=m*x
    nn=int(np.floor(2+x+4*x**(1/3)+.5))
    n=np.arange(1,nn+1);nu=n+.5
    bx=jv(nu,x)*np.sqrt(.5*np.pi/x);bz=jv(nu,z)*np.sqrt(.5*np.pi/z)
    hx=bx+1j*yv(nu,x)*np.sqrt(.5*np.pi/x)
    ax=x*np.r_[np.sin(x)/x,bx[:-1]]-n*bx
    az=z*np.r_[np.sin(z)/z,bz[:-1]]-n*bz
    ah=x*np.r_[(np.sin(x)-1j*np.cos(x))/x,hx[:-1]]-n*hx
    an=(m*m*bz*ax-bx*az)/(m*m*bz*ah-hx*az)
    bn=(bz*ax-bx*az)/(bz*ah-hx*az)
    cn=2*n+1;ext=2*np.sum(cn*(an+bn).real)/(x*x)
    sca=2*np.sum(cn*(abs(an)**2+abs(bn)**2))/(x*x)
    absorb=ext-sca
    nxt=n[:-1]*(n[:-1]+2)/(n[:-1]+1)
    g=4*(np.sum(nxt*(an[:-1]*an[1:].conj()+bn[:-1]*bn[1:].conj()).real)+np.sum(cn/(n*(n+1))*(an*bn.conj()).real))/(x*x*sca)
    out=np.array([1.5*packing*sca/d,g,1.5*packing*absorb/d])
    assert np.isfinite(out).all() and out[0]>=0 and out[2]>0 and abs(g)<1, (d,wavelength,out.tolist())
    return out
def mix(sga,weights):
    w=np.asarray(weights)[:,None];s=(w*sga[:,:,0]).sum(0);g=(w*sga[:,:,0]*sga[:,:,1]).sum(0)/s;a=(w*sga[:,:,2]).sum(0)
    return np.column_stack((s,g,a))
