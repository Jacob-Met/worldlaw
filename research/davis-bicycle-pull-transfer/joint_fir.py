"""Fit a force-to-angle impulse response with a shared causal basis for both outputs."""
import numpy as np
from scipy import signal
from scipy.interpolate import BSpline
from scipy.linalg import block_diag, solve
from weak_balance import balance_operator

def basis_grid(fs):
    count=769
    t=np.arange(count,dtype=float)/fs
    horizon=t[-1]
    # Fine spacing covers the early steering reaction. Later spacing follows
    # the experiment's longer, low-frequency balance response.
    interior=np.unique(np.r_[np.arange(.04,min(1.2,horizon),.04),
                             np.arange(1.2,min(2.4,horizon),.08),
                             np.arange(2.4,horizon,.16)])
    interior=interior[(interior>0)&(interior<horizon)]
    knots=np.r_[np.zeros(4),interior,np.repeat(horizon,4)]
    spline=BSpline(knots,np.eye(len(knots)-4),3,extrapolate=False)
    # A force impulse changes the angular rates. Both positions start continuously.
    B=spline(t)[:,1:-1]
    d2=spline(t,nu=2)[:,1:-1]
    rough=d2.T@d2/count
    rough/=np.trace(rough)/len(rough)
    return t,B,rough

def force_features(u,B,fs):
    return signal.oaconvolve(np.asarray(u)[:,None],B,axes=0)[:len(u)]/fs

def training_stats(u,y,fs):
    t,B,_=basis_grid(fs)
    X=force_features(u,B,fs)
    y=np.asarray(y)-np.mean(y,axis=0)
    return {'xx':X.T@X/len(X),'xy':X.T@y/len(X),'yy':np.mean(y*y,axis=0),
            'fs':fs,'rows':len(u)}

def fit(stats, speed, alpha, lam, variant='true'):
    fs=stats[0]['fs']
    assert all(s['fs']==fs for s in stats)
    t,B,R=basis_grid(fs)
    XX=np.mean([v['xx'] for v in stats],axis=0)
    XY=np.mean([v['xy'] for v in stats],axis=0)
    sigma=np.sqrt(np.mean([v['yy'] for v in stats],axis=0))
    assert np.all(sigma>0)
    gain=np.trace(XX)/len(XX)
    p=len(XX)
    main=XX/gain+alpha*R+1e-7*np.eye(p)
    mat=block_diag(main,main)
    rhs=(XY/sigma[None,:]/gain).T.ravel()
    if lam:
        centers=np.arange(0.,min(2.4,t[-1]-.22),.08)
        widths=np.minimum(.22,.13+.03*centers)
        L,q=balance_operator(t,B,speed,centers,widths,sham=variant=='sham')
        L[:,:p]*=sigma[0]
        L[:,p:]*=sigma[1]
        norm=np.linalg.norm(L,axis=1)
        assert np.all(norm>0)
        L/=norm[:,None]
        q/=norm
        weight=lam*2*p/len(centers)
        mat+=weight*(L.T@L)
        rhs+=weight*(L.T@q)
    beta=solve(mat,rhs,assume_a='pos').reshape((2,p)).T*sigma[None,:]
    kernel=B@beta/fs
    assert np.all(np.isfinite(kernel))
    return kernel

def synthetic_regression():
    from weak_balance import synthetic_plant
    from author_fir import replay_kernel
    rng=np.random.default_rng(615)
    fs=200;speed=4.
    t,h=synthetic_plant(speed,1/fs,total=768/fs)
    stats=[]
    for i in range(2):
        u=rng.normal(size=2200)
        y=replay_kernel(u,h/fs)+rng.normal(scale=.0001,size=(len(u),2))
        stats.append(training_stats(u,y,fs))
    u=rng.normal(size=2400)
    y=replay_kernel(u,h/fs)
    out={}
    for variant,lam in [('unstructured',0.),('true',1.),('sham',1.)]:
        k=fit(stats,speed,1e-3,lam,variant=variant)
        out[variant]=np.sqrt(np.mean((y-replay_kernel(u,k))**2,axis=0)).tolist()
    return out

if __name__=='__main__':print(synthetic_regression())
