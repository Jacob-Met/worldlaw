"""Rasilo et al. Script8 and fitSpline2 derivative-spline family on four anchors.

This implementation uses cubic optimal-recovery knots and least squares on the
stacked derivative matrix. The published normal-equation solve and full-panel
fit are separate. At prediction, invert the implicit strain coordinate.
"""
import numpy as np
from scipy.interpolate import BSpline,PchipInterpolator
from scipy.linalg import lstsq,solve

def optknots(x):
    k=4; n=len(x); m=n-k
    if m==0:
        return np.repeat(x[[0,-1]],k),0.
    if m<0:raise ValueError('insufficient cubic interpolation sites')
    z=np.array([x[j+1:j+k].mean() for j in range(m)])
    basis=[BSpline.basis_element(x[j:j+k+1],extrapolate=False) for j in range(m)]
    anti=[b.antiderivative() for b in basis]
    rootsigns=(-1.)**np.arange(m)
    # Alternating interval signs integrate to zero against the B-splines on x.
    def residual(nodes):
        bounds=np.r_[x[0],nodes,x[-1]]
        integral=np.stack([a(np.clip(bounds,x[j],x[j+k])) for j,a in enumerate(anti)])
        return np.diff(integral,axis=1)@((-1.)**np.arange(m+1))
    for _ in range(10):
        f=residual(z)
        if max(abs(f))<=1e-13*(x[-1]-x[0]):break
        jac=2*np.stack([np.nan_to_num(b(z),nan=0.) for b in basis])*rootsigns
        move=solve(jac,-f)
        for damp in 0.5**np.arange(20):
            zz=z+damp*move
            if np.all(np.diff(np.r_[x[0],zz,x[-1]])>0) and max(abs(residual(zz)))<max(abs(f)):
                z=zz;break
        else:raise ValueError('optimal recovery knot iteration failed')
    err=max(abs(residual(z)))/(x[-1]-x[0])
    if err>1e-9:raise ValueError('optimal recovery knot residual')
    return np.r_[np.repeat(x[0],k),z,np.repeat(x[-1],k)],float(err)

def spline_predict(b,sig,h,lam,anchors,seed):
    E=183e9; nu=.34; a=(1+nu)/E; n=len(b)
    anchor_sig=sig[anchors]
    vraw=a*anchor_sig[None,:]+1.5*lam
    v=np.linspace(vraw.min(),vraw.max(),len(anchors))
    hcols=[]; lambdas=[]
    for i in range(n):
        order=np.argsort(vraw[i]); x=vraw[i,order]
        if min(np.diff(x))<=0:raise ValueError('duplicate training strain coordinate')
        hcols.append(PchipInterpolator(x,h[i,anchors][order])(v))
        lambdas.append(PchipInterpolator(x,lam[i,order])(v))
    hcols=np.array(hcols); lambdas=np.array(lambdas)
    bs=1/np.abs(hcols).max(); vs=1/(lambdas/a).max()
    if not bs>0 or not vs>0:raise ValueError('author-positive coordinate scales unavailable')
    u=b/bs; y=v/vs
    ku,kerr=optknots(u);kv,_=optknots(y)
    U=BSpline(ku,np.eye(n),3); V=BSpline(kv,np.eye(len(v)),3)
    X1=np.kron(V(y),U(u,nu=1)); X2=np.kron(V(y,nu=1),U(u))
    X=np.vstack((X1,X2))[:,1:]
    rhs=np.r_[(hcols*bs).flatten('F'),(-lambdas/a*vs).flatten('F')]
    coeff,_,rank,_=lstsq(X,rhs,lapack_driver='gelsy')
    C=np.r_[0.,coeff].reshape((n,len(v)),order='F')
    # Exactly four stress anchors give a cubic basis without internal stress
    # knots. dpsi/dy and the scalar issuance equation are quadratic throughout.
    val=U(u)@C
    yn=np.array([-1.,0.,1.]); v0=(v[0]+v[-1])/2; dv=(v[-1]-v[0])/2
    x=(v0+dv*yn)/vs
    lvals=-a/vs*val@V(x,nu=1).T
    c0=lvals[:,1];c1=(lvals[:,2]-lvals[:,0])/2;c2=(lvals[:,2]+lvals[:,0])/2-c0
    out=np.empty((n,len(sig))); fallback=multiroot=outside=0
    for i in range(n):
        for j,stress in enumerate(sig):
            poly=[1.5*c2[i],1.5*c1[i]-dv,1.5*c0[i]+a*stress-v0]
            roots=np.roots(poly)
            candidates=[(v0+dv*q.real-a*stress)/1.5 for q in roots if abs(q.imag)<=1e-8*(1+abs(q.real))]
            if not candidates:
                fallback+=1;out[i,j]=seed[i,j];continue
            multiroot+=len(candidates)>1
            out[i,j]=min(candidates,key=lambda t:(abs(t-seed[i,j]),t))
            outside+=not v[0]<=a*stress+1.5*out[i,j]<=v[-1]
    return (out-out[0])*1e6,{'rank':int(rank),'columns':X.shape[1],'knot_residual':kerr,
                             'input_seed_fallbacks':fallback,'multiple_roots':multiroot,'outside_calibration_v':outside}
