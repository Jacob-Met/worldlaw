"""Offline benchmark estimators with matched four-sample causal input support."""
import numpy as np


def path_starts(raw_recording_count,first_recording=0):
    # The nominal sixth boundaries are in the wide stationary home segments.
    # Map native 4ms sample indices to the organizer's concatenated 25:1 grid.
    start=(first_recording*90881+24)//25
    raw=[(first_recording+i)*90881+(j*90881+3)//6 for i in range(raw_recording_count) for j in range(6)]
    return np.asarray([(r+24)//25-start for r in raw])


def valid_mask(n,starts):
    valid=np.ones(n,dtype=bool)
    for s in starts:valid[s:s+3]=False
    return valid


def path_views(x,starts):
    n=len(x);idx=np.arange(n)
    begin=np.maximum.accumulate(np.where(np.isin(idx,starts),idx,0))
    return np.stack([x[np.maximum(idx-k,begin)] for k in range(4)],axis=1)


def reconstruct(bank,source):
    q,vf,af=np.hsplit(bank[:,0],3)
    def deriv(signal):
        x0,x1,x2,x3=np.moveaxis(signal,1,0)
        return (11*x0-18*x1+9*x2-2*x3)/.6,(2*x0-5*x1+4*x2-x3)/.01
    if source=="released":return vf,af
    if source=="position":return deriv(bank[:,:,:6])
    if source=="filter":
        da,dda=deriv(bank[:,:,12:18])
        return vf+.5*af+.25*da,af+da+.25*dda
    raise ValueError(source)


def common_columns(bank,source):
    q=bank[:,0,:6]*np.pi/180
    v,a=reconstruct(bank,source)
    # A low-order trigonometric dictionary for pose-dependent static loads
    # and inertial coefficients. Coefficients act in measured motor units.
    phase=np.column_stack([q,q[:,1]+q[:,2],q[:,1]-q[:,2],q[:,1]+q[:,2]+q[:,4]])
    G=np.column_stack([q,np.sin(phase),np.cos(phase)])
    J=np.column_stack([np.sin(q[:,1:3]),np.cos(q[:,1:3]),np.sin(q[:,1]+q[:,2]),np.cos(q[:,1]+q[:,2])])
    i,j=np.triu_indices(6);quadratic=v[:,i]*v[:,j]
    base=np.column_stack([G,v,a,(a[:,:,None]*J[:,None,:]).reshape(len(q),-1),quadratic])
    return base,v


def fit_points(x,y,u,train_starts,test_starts,source,lam=.0005):
    xbank=path_views(x,train_starts);ubank=path_views(u,test_starts)
    a,v=common_columns(xbank,source);b,w=common_columns(ubank,source)
    good=valid_mask(len(x),train_starts);active=valid_mask(len(u),test_starts)
    # Three startup rows per trajectory use a common affine source baseline.
    # None of the learned dynamics consume a previous trajectory's samples.
    xm,ym=x.mean(0),y.mean(0);baseline=np.linalg.lstsq(x-xm,y-ym,rcond=None)[0]
    pred=(u-xm)@baseline+ym;info=[]
    for j in range(6):
        scale=np.array([.03,.3,3.,30.])
        design=np.column_stack([a,np.tanh(v[:,j,None]/scale)])
        test=np.column_stack([b,np.tanh(w[:,j,None]/scale)])
        train=design[good];m=train.mean(0);sd=train.std(0);selected=sd>1e-7
        X=(train[:,selected]-m[selected])/sd[selected]
        U=(test[:,selected]-m[selected])/sd[selected]
        z=y[good,j];mean=z.mean();reg=len(z)*lam
        c=np.linalg.solve(X.T@X+reg*np.eye(X.shape[1]),X.T@(z-mean))
        pred[active,j]=U[active]@c+mean
        info.append({"columns":int(X.shape[1]),"ridge":lam})
    return pred,{"fit_rows":int(sum(good)),"fallback_rows":int(sum(~active)),"axes":info}
