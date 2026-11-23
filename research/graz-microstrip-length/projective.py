"""Direct measured-scattering cascade; no division by individual transmissions."""
import numpy as np
from matrix_paths import paths,simplex_minvar


def compose(a,b,c):
    u=b[...,1,1]-a[...,1,1]
    v=c[...,0,0]-b[...,0,0]
    d=b[...,0,1]*b[...,1,0]+u*v
    out=np.empty_like(a)
    out[...,0,0]=a[...,0,0]+a[...,0,1]*a[...,1,0]*v/d
    out[...,1,1]=c[...,1,1]-c[...,0,1]*c[...,1,0]*u/d
    out[...,1,0]=a[...,1,0]*b[...,0,1]*c[...,1,0]/d
    out[...,0,1]=a[...,0,1]*b[...,1,0]*c[...,0,1]/d
    return out,d


def derivative(a,b,c,da,db,dc):
    out,d=compose(a,b,c)
    u,v=b[...,1,1]-a[...,1,1],c[...,0,0]-b[...,0,0]
    du,dv=db[...,1,1]-da[...,1,1],dc[...,0,0]-db[...,0,0]
    dd=db[...,0,1]*b[...,1,0]+b[...,0,1]*db[...,1,0]+du*v+u*dv
    dy=np.empty_like(da)
    dy[...,0,0]=(da[...,0,0]+((da[...,0,1]*a[...,1,0]+a[...,0,1]*da[...,1,0])*v
               +a[...,0,1]*a[...,1,0]*dv-(out[...,0,0]-a[...,0,0])*dd)/d)
    dy[...,1,1]=(dc[...,1,1]-((dc[...,0,1]*c[...,1,0]+c[...,0,1]*dc[...,1,0])*u
               +c[...,0,1]*c[...,1,0]*du+(out[...,1,1]-c[...,1,1])*dd)/d)
    for o,i in [(1,0),(0,1)]:
        n=(da[...,o,i]*b[...,i,o]*c[...,o,i]+a[...,o,i]*db[...,i,o]*c[...,o,i]
           +a[...,o,i]*b[...,i,o]*dc[...,o,i])
        dy[...,o,i]=(n-out[...,o,i]*dd)/d
    return dy


def predict(sweeps,target):
    roster=paths(sweeps,target)
    means={l:s.mean(axis=0) for l,s in sweeps.items()}
    delta={l:s-means[l] for l,s in sweeps.items()}
    zero=np.zeros_like(next(iter(delta.values())))
    predictions=[];orders=[]; influence={l:[] for l in means}
    for a,b,c in roster:
        x,y,z=means[a],means[b],means[c]
        forward=compose(x,y,z)[0];reverse=compose(z,y,x)[0]
        predictions.append((forward+reverse)/2)
        orders.append(forward-reverse)
        for l in means:
            da=delta[l] if l==a else zero
            db=delta[l] if l==b else zero
            dc=delta[l] if l==c else zero
            influence[l].append((derivative(x,y,z,da,db,dc)+derivative(z,y,x,dc,db,da))/2)
    base=np.array(predictions)
    cov=np.zeros((base.shape[1],len(roster),len(roster)))
    for l,items in influence.items():
        e=np.array(items);n=len(sweeps[l])
        cov+=np.einsum('pnfij,qnfij->fpq',e.conj(),e,optimize=True).real/(n*(n-1))
    weights=np.array([simplex_minvar(c) for c in cov])
    pred=np.einsum('fp,pfij->fij',weights,base)
    return {'covariance_weighted':pred,'equal_path':base.mean(axis=0),'paths':roster,
            'weights':weights,'order_disagreement':np.max(np.linalg.norm(orders,axis=(-2,-1)),axis=0),
            'path_spread':np.max(np.linalg.norm(base-pred,axis=(-2,-1)),axis=0),
            'sweep_std':np.sqrt(np.maximum(np.einsum('fp,fpq,fq->f',weights,cov,weights),0))}
