"""Reduced-rank Gaussian-kernel control with the same four-row input support."""
import numpy as np
from scipy.linalg import cholesky, solve_triangular
from scipy.spatial.distance import cdist
from path_model import path_views,reconstruct,valid_mask

def nystrom(train,test,k=256):
    mean=train.mean(0);sd=np.maximum(train.std(0),1e-8)
    x=(train-mean)/sd;u=(test-mean)/sd
    rng=np.random.default_rng(21157);ids=rng.choice(len(x),min(k,len(x)),replace=False)
    centers=x[ids]
    def kernel(v):
        d=cdist(v,centers,metric="sqeuclidean")/x.shape[1]
        return .5*np.exp(-d/2)+.5*np.exp(-d/.25)
    gram=kernel(centers);root=cholesky(gram+1e-6*np.eye(len(ids)),lower=True)
    return (solve_triangular(root,kernel(x).T,lower=True).T,
            solve_triangular(root,kernel(u).T,lower=True).T)

def fit_kernel(x,y,u,train_starts,test_starts):
    good=valid_mask(len(x),train_starts);active=valid_mask(len(u),test_starts)
    bx=path_views(x,train_starts);bu=path_views(u,test_starts)
    vx,ax=reconstruct(bx,"position");vu,au=reconstruct(bu,"position")
    xvars=np.column_stack([x[:,:6],vx,ax]);uvars=np.column_stack([u[:,:6],vu,au])
    xt=xvars[good];ut=uvars[active]
    xm,ym=x.mean(0),y.mean(0)
    p=(u-xm)@np.linalg.lstsq(x-xm,y-ym,rcond=None)[0]+ym
    shared,testshared=nystrom(xt,ut)
    for j in range(6):
        ids=[j,j+6,j+12]
        loc,testloc=nystrom(xt[:,ids],ut[:,ids])
        # Shared and per-output local covariance terms plus a linear mean.
        Z=np.column_stack([shared,loc,xt]);W=np.column_stack([testshared,testloc,ut])
        m=Z.mean(0);sd=np.maximum(Z.std(0),1e-5);Z=(Z-m)/sd;W=(W-m)/sd
        z=y[good,j];mu=z.mean();c=np.linalg.solve(Z.T@Z+len(z)*.002*np.eye(Z.shape[1]),Z.T@(z-mu))
        p[active,j]=mu+W@c
    return p
