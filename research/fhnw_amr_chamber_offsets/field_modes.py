"""Conditional common-field gauge and predeclared independent calibration controls."""
import numpy as np
def mm(m):
    u,s,v=np.linalg.svd(m.reshape(-1,3),full_matrices=False)
    if s[-1]<=0 or s[0]/s[-1]>40:raise ValueError(("source response rank",s.tolist()))
    return u,s
def proj(u,x):
    return (u@(u.T@x.reshape(-1))).reshape(x.shape)
def design(c,m):return np.column_stack((c.transpose(1,0,2).reshape(63,-1),m.reshape(63,-1)))
def ridge(X,y,V,lam):
    mu=X.mean(0);sd=X.std(0);sd=np.where(sd>1e-12,sd,1.)
    a=(X-mu)/sd;b=np.linalg.solve(a.T@a+lam*np.eye(a.shape[1]),a.T@(y-y.mean(0)))
    return (V-mu)/sd@b+y.mean(0)
def modes(c3,m3,c7,m7,z):
    u3,s3=mm(m3);u7,s7=mm(m7)
    b3,b7=c3.mean(0),c7.mean(0)
    pred=b7-proj(u7,b7-z);iso=b7-(b7-z).mean(0)
    diag=np.column_stack([c7[a,:,a] for a in range(3)])
    x3,x7=design(c3,m3),design(c7,m7)
    alphas=[100.,10.,1.,.1];cv=[]
    cand=[];std=[];raw=[]
    for k in range(63):
        train=np.arange(63)!=k
        y=c3[:,train].mean(0)-z[train]
        theta=np.linalg.lstsq(m3[train].reshape(-1,3),y.ravel(),rcond=None)[0]
        cand.append(b3[k]-m3[k]@theta-z[k]);std.append(b3[k]-y.mean(0)-z[k]);raw.append(b3[k]-z[k])
    for alpha in alphas:
        e=[]
        for k in range(63):
            train=np.arange(63)!=k;e.append(ridge(x3[train],z[train],x3[k:k+1],alpha)[0]-z[k])
        cv.append(float(np.sqrt(np.mean(np.square(e)))))
    alpha=alphas[int(np.argmin(cv))]
    a=np.stack([pred,z,iso,diag-diag.mean(0)+z.mean(0),diag-diag.mean(0)+.9921,b7,
      z+b7-b3,z+(b7-b3)-proj(u7,b7-b3),.5*(pred+z),.5*(iso+z),
      z+(b7-z-proj(u7,b7-z))-(b3-z-proj(u3,b3-z)),
      z+ridge(x3,z,x7,alpha)-ridge(x3,z,x3,alpha)])
    def drift(c,u):
        dd=c-c.mean(0)
        return [np.sqrt(np.mean((e-proj(u,e))**2,axis=0)).tolist() for e in dd]
    meta=dict(singular3=s3.tolist(),singular7=s7.tolist(),principal_angles_deg=np.rad2deg(np.arccos(np.clip(np.linalg.svd(u3.T@u7,compute_uv=False),0,1))).tolist(),out_of_span_pose_rms3=drift(c3,u3),out_of_span_pose_rms7=drift(c7,u7),source_chip_loo={k:np.sqrt(np.mean(np.array(x)**2,axis=0)).tolist() for k,x in zip(["candidate","common","raw"],[cand,std,raw])},ridge_alpha=alpha,ridge_cv=dict(zip(alphas,cv)),candidate_contrast_vs_prior_rms=float(np.sqrt(np.mean((pred-z)**2))))
    return a,meta
