"""Forward models for a physically separate mixed-pickup pluck. All fitting is source-only."""
import json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares


L=np.array([649,650,652,651,652,650.])
D=np.array([[157,99,38],[158,100,41],[160,102,45],[159,101,46],[160,102,49],[158,100,49]])
PAIRS=np.array([[0,1],[1,2]],dtype=int)
K=np.arange(1.,26.)
ROLES=('point_geometry','finite_geometry_nominal','fitted_finite_geometry','coherent','unsigned','power','reversed',
       'fitted_real_gain','phase_blind_circuit','geometry_phase','coherent_envelope','mixed_position_interpolation',
       'empirical_corrected_coherent','shared_circuit')


def shape(x):
    a=np.abs(x)
    return 20*np.log10(np.maximum(a/np.maximum(np.max(a,axis=-1,keepdims=True),1e-24),.001))


def renorm_db(x):
    return np.maximum(x-x.max(axis=-1,keepdims=True),-60.)


class Cases:
    def __init__(self,directory):
        d=Path(directory);X=np.load(d/'singles.npy',allow_pickle=False)
        assert X.shape==(6,8,3,25) and np.isfinite(X).all()
        self.s,self.j,self.p=np.indices((6,8,2)).reshape(3,-1)
        self.a,self.b=PAIRS[self.p].T
        self.A=X[self.s,self.j,self.a];self.B=X[self.s,self.j,self.b]
        self.q=30+20*self.j;self.ll=L[self.s,None]
        self.da=D[self.s,self.a,None];self.db=D[self.s,self.b,None]
        m=json.loads((d/'metadata.json').read_bytes())
        self.f=np.array([m[f'{s+1}/{j+1}/singles']['peak_Hz'] for s,j in zip(self.s,self.j)])
        assert self.f.shape==self.A.shape==(96,25) and np.isfinite(self.f).all()
        self.omega=2j*np.pi*self.f
        self.sa=np.sin(np.pi*K*self.da/self.ll);self.sb=np.sin(np.pi*K*self.db/self.ll)
        self.pluck=np.sin(np.pi*K*self.q[:,None]/self.ll)/K

    def eq12(self,diameter,widths):
        ga=np.sinc(K*widths[self.a,None]/(2*self.ll))
        gb=np.sinc(K*widths[self.b,None]/(2*self.ll))
        return self.pluck*np.sinc(K*diameter/(2*self.ll))*(self.sa*ga+self.sb*gb)


def training(d,case):
    y=np.load(Path(d)/'training-mixed.npy',allow_pickle=False)
    assert y.shape==(6,4,2,25)
    obs=np.flatnonzero(case.j%2==0)
    return obs,shape(y[case.s[obs],case.j[obs]//2,case.p[obs]])


def fit_nonlin(calc,initial,lo,hi,train,y,reg):
    initial=np.asarray(initial,dtype=float)
    def residual(x):
        d=calc(x)[train]-y
        return np.r_[d.ravel(),reg*(x-initial)]
    r=least_squares(residual,initial,bounds=(lo,hi),max_nfev=120,ftol=1e-7,xtol=1e-7,gtol=1e-7)
    return calc(r.x),{'theta':r.x.tolist(),'init':initial.tolist(),'evaluations':r.nfev,'status':r.status,
                       'lower':np.broadcast_to(lo,r.x.shape).tolist(),'upper':np.broadcast_to(hi,r.x.shape).tolist()}


def positive_coils(c,theta):
    # All quantities are normalized by an arbitrary middle-coil resistance.
    # tau is L/R (s). shunt capacitance is represented as R_mid*C (s).
    v=np.exp(theta);r=np.array([v[0],1.,v[1]])
    tau=v[2:5];cap=v[5:8]
    gl,cl=v[8:10];gain=np.array([v[10],1.,v[11]])
    def y(idx):
        return 1/(r[idx,None]*(1+c.omega*tau[idx,None]))+c.omega*cap[idx,None]
    ya,yb=y(c.a),y(c.b);load=gl+c.omega*cl;den=ya+yb+load
    return (ya+load)/den*gain[c.a,None],(yb+load)/den*gain[c.b,None]


def envelope_basis(c):
    u=np.log2(c.f/700.)
    centers=np.array([-3.,-1.5,0.,1.5,3.,4.5])
    return np.stack([np.exp(-.5*((u-v)/.95)**2) for v in centers],axis=-1)


def fit_models(c,train,y):
    train=np.asarray(train);y=np.asarray(y);assert len(train)==len(y) and np.all(c.j[train]%2==0)
    A,B=c.A,c.B
    pred={'point_geometry':shape(c.eq12(0.,np.zeros(3))),
          'finite_geometry_nominal':shape(c.eq12(.88,np.full(3,15.))),
          'coherent':shape(A+B),'unsigned':shape(abs(A)+abs(B)),'power':shape(np.hypot(abs(A),abs(B))),
          'reversed':shape(A-B)}
    params={};basis=envelope_basis(c)
    def envelope(param):
        vv=param.reshape(2,6)
        return np.einsum('nkh,nh->nk',basis,vv[c.p])
    def fit(name,fn,x,lo,hi,reg):
        pred[name],params[name]=fit_nonlin(fn,x,lo,hi,train,y,reg)
    fit('coherent_envelope',lambda x:renorm_db(pred['coherent']+envelope(x)),np.zeros(12),-20.,20.,2.)
    def geom(x):
        return renorm_db(shape(c.eq12(x[0],x[1:4]))+envelope(x[4:]))
    fit('fitted_finite_geometry',geom,np.r_[[.88,15,15,15],np.zeros(12)],np.r_[[0.,.1,.1,.1],np.full(12,-20.)],
          np.r_[[10.,60.,60.,60.],np.full(12,20.)],np.r_[np.full(4,.1),np.full(12,2.)])
    def simple(x,use_geometry):
        w=np.exp(x[:2])[c.p,None]
        if use_geometry:
            a=np.sign(c.sa)*abs(A);b=np.sign(c.sb)*abs(B)
        else:a,b=A,B
        return renorm_db(shape(a+w*b)+envelope(x[2:]))
    limits=(np.r_[np.full(2,-1.4),np.full(12,-20.)],np.r_[np.full(2,1.4),np.full(12,20.)])
    for role,use_geometry in [('fitted_real_gain',False),('geometry_phase',True)]:
        fit(role,lambda x:simple(x,use_geometry),np.zeros(14),*limits,np.r_[[3.,3.],np.full(12,2.)])
    init=[1,1,.0004,.0004,.0004,.000001,.000001,.000001,.012,.000003,1.,1.]
    lo=[.25,.25,.00002,.00002,.00002,.00000005,.00000005,.00000005,.0002,.00000005,.25,.25]
    hi=[4,4,.004,.004,.004,.000015,.000015,.000015,.25,.00005,4,4]
    for role,coherent in [('shared_circuit',True),('phase_blind_circuit',False)]:
        def effect(x):
            a,b=positive_coils(c,x)
            return shape(a*A+b*B if coherent else abs(a*A)+abs(b*B))
        fit(role,effect,np.log(init),np.log(lo),np.log(hi),3.)
    # These source-calibrated controls can absorb smooth empirical transfer
    # that cannot be attributed to component impedance. Each uses the same
    # training takes and no held spectrum.
    interp=[];correct=[];train_s,train_p=c.s[train],c.p[train];res=y-pred['coherent'][train]
    for row in range(len(c.s)):
        matching=np.flatnonzero((train_s==c.s[row])&(train_p==c.p[row]));assert len(matching)>=2
        delta=abs(c.q[train[matching]]-c.q[row]);w=1/np.maximum(delta,5.)**2;w/=w.sum()
        local=np.sum(w[:,None]*y[matching],axis=0)
        interp.append(renorm_db(local))
        pooled=np.mean(res[train_p==c.p[row]],axis=0)
        r=.5*np.sum(w[:,None]*res[matching],axis=0)+.5*pooled
        correct.append(renorm_db(pred['coherent'][row]+r))
    pred['mixed_position_interpolation']=np.asarray(interp);pred['empirical_corrected_coherent']=np.asarray(correct)
    assert set(pred)==set(ROLES) and all(v.shape==(96,25) and np.isfinite(v).all() for v in pred.values())
    return pred,params
