"""Per-frequency fits in bounded, dimensionless reflection coordinates."""
import itertools
import numpy as np

def roots(z,w):
    n=len(z);yield np.zeros(n,complex),np.ones(n,complex)
    yield np.ones(n,complex),np.zeros(n,complex)
    for h in range(z.shape[1]):
        for i,j in itertools.combinations(range(z.shape[2]),2):
            za,zb=z[:,h,i],z[:,h,j];wa,wb=w[:,h,i],w[:,h,j]
            da=wa-za;db=wb-zb
            A=da-db; B=-da*(wb+zb)+db*(wa+za); C=da*wb*zb-db*wa*za
            d=np.sqrt(B*B-4*A*C)
            # Two homogeneous root pairs (-B ± sqrt(D), 2A). In the
            # linear case the second finite root is (-C,B).
            for sign in (1,-1):
                u=-B+sign*d;v=2*A
                small=(abs(u)+abs(v))<1e-14*(abs(A)+abs(B)+abs(C))
                u=np.where(small,-C,u);v=np.where(small,B,v)
                norm=np.sqrt(abs(u)**2+abs(v)**2)
                yield np.divide(u,norm,out=np.zeros_like(u),where=norm>0),np.divide(v,norm,out=np.zeros_like(v),where=norm>0)

def parabolic(z,w,zh,shared):
    n,h,_=z.shape
    best=np.full((n,1 if shared else h),np.inf)
    pred=np.zeros_like(zh);bad=np.ones(zh.shape,bool)
    for u0,v0 in roots(z,w):
        u=u0[:,None,None];v=v0[:,None,None]
        g=(v*w-u)*(v*z-u);norm=np.sum(abs(g)**2,axis=2,keepdims=True)
        k=np.divide(np.sum(g.conj()*(w-z),axis=2,keepdims=True),norm,out=np.zeros_like(norm,dtype=complex),where=norm>1e-28)
        def calc(x):
            term=k*v*(v*x-u);D=1-term
            invalid=(abs(D)<1e-10*(1+abs(term)))|(norm<=1e-28)
            value=np.divide(x-k*u*(v*x-u),D,out=x.copy(),where=~invalid)
            return value,invalid|~np.isfinite(value)
        fit,ff=calc(z);test,tf=calc(zh)
        err=np.mean(abs(fit-w)**2,axis=2)
        err=np.where(np.any(ff,axis=2),np.inf,err)
        if shared:err=np.mean(err,axis=1,keepdims=True)
        use=err<best;best=np.minimum(best,err)
        pred=np.where(use[:,:,None],test,pred);bad=np.where(use[:,:,None],tf,bad)
    return pred,bad

def fit(z,w,zh):
    # z,w are [frequency,upper,calibration_lower], and zh uses held lowers.
    A=np.stack([z,np.ones_like(z),-w*z,-w],axis=-1)
    A/=np.linalg.norm(A,axis=-1,keepdims=True)
    _,sing,vh=np.linalg.svd(A,full_matrices=False)
    cond=sing[:,:,2]/sing[:,:,0];a,b,c,d=np.moveaxis(vh[:,:,-1,:].conj(),-1,0)
    den=c[:,:,None]*zh+d[:,:,None]
    freebad=(abs(den)<1e-10*np.maximum(1e-30,abs(c[:,:,None]*zh)+abs(d[:,:,None])))
    free=np.divide(a[:,:,None]*zh+b[:,:,None],den,out=zh.copy(),where=~freebad)
    common,cb=parabolic(z,w,zh,True)
    separate=[parabolic(z[:,i:i+1],w[:,i:i+1],zh[:,i:i+1],False) for i in range(z.shape[1])]
    per=np.concatenate([x[0] for x in separate],axis=1);pb=np.concatenate([x[1] for x in separate],axis=1)
    answers=[];counts=[]
    for value,bad in [(common,cb),(per,pb),(free,freebad)]:
        bad=bad|~np.isfinite(value)|(cond[:,:,None]<1e-8)
        answers.append(np.where(bad,zh,value));counts.append(bad)
    return answers,counts,cond

def synthetic():
    rng=np.random.default_rng(16169580)
    z=(rng.random((8,3,4))-.5)+1j*(rng.random((8,3,4))-.5)
    zh=(rng.random((8,3,3))-.5)+1j*(rng.random((8,3,3))-.5)
    r=(.44+.51j);k=np.array([.1+.2j,-.24+.05j,.17-.1j])[None,:,None]
    def mapx(x):return (x-k*r*(x-r))/(1-k*(x-r))
    p,b,c=fit(z,mapx(z),zh)
    assert max(np.max(abs(y-mapx(zh))) for y in p)<1e-10 and not any(y.any() for y in b)
    _,bad,_=fit(np.ones_like(z),np.ones_like(z),zh)
    assert all(y.all() for y in bad)
    print("exact synthetic 3-diameter shunt and rank refusal passed",flush=True)
