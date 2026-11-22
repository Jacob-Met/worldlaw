"""Forward predictions using only command/time and the five pre-impulse output rows."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import numpy as np
import pandas as pd
import wt_models as author

PANEL="wt_intake_impulse_v1"
ROLES=("persistence","author_draw","author_centered","middle_template","squared_speed",
       "walk_additive","walk_coupled","walk_plus_template","torque_transfer")
WMAX=3000*np.pi/30
INERTIA=.5*.059**2*.02
def tau(load):
    return .05*(np.maximum(.1,load)**3)*(.27-.166)*(load!=0)
DRAG=tau(1.)/WMAX**2
RPM=30/np.pi
INPUT=["timestamp","load_in","load_out","hatch"]
OUTPUT=["rpm_out","pressure_downwind"]


def panel(member, *, inputs_only=False):
    # The trusted CSV reader decodes complete records, then discards held target suffixes.
    digest="8b7a0e587d3e9a804b380d96f14a1b12"
    if hashlib.md5(Path('impulse.zip').read_bytes()).hexdigest()!=digest:raise ValueError('source archive')
    path=f"{PANEL}/load_out_{member}_osr_downwind_4.csv"
    with ZipFile('impulse.zip') as z:
        with z.open(path) as f:
            frame=pd.read_csv(f,usecols=INPUT+["flag"])
        if not np.array_equal(frame.flag.to_numpy(),np.repeat(np.arange(5000),50)):
            raise ValueError('flags')
        u=frame[INPUT].to_numpy().reshape(-1,50,4)
        if not np.isfinite(u).all() or not (np.diff(u[:,:,0])>0).all():
            raise ValueError('input chronology')
        # Skip every post-onset outcome row before returning a prefix to prediction.
        skip=(lambda row: row>0 and (row-1)%50>=5) if inputs_only else None
        with z.open(path) as f:
            y=pd.read_csv(f,usecols=OUTPUT,skiprows=skip)[OUTPUT].to_numpy()
    return u,y.reshape(5000,5 if inputs_only else 50,2)


def speeds(load,t):
    # Same right-endpoint Euler update and 100 substeps as released A2, across events.
    v=np.empty_like(load);v[:,0]=author.model_a1(load[:,0],.1,WMAX)
    torque=tau(load)
    for j in range(1,load.shape[1]):
        dt=(t[:,j]-t[:,j-1])/100.
        w=v[:,j-1].copy()
        for _ in range(100):w+=(torque[:,j]-DRAG*w**2)*dt/INERTIA
        v[:,j]=w
    return v


def component(w,h):
    return author.model_c3(w,0.,h,0.,74.82473949999999,WMAX,186.7/3600,.75,.15)


def centered(x):
    return x-x[:,:5].mean(1,keepdims=True)


def basis(u,coupled):
    t,li,lo,h=np.moveaxis(u,-1,0)
    i,o=speeds(li,t)/WMAX,speeds(lo,t)/WMAX
    h=h/45.
    # Both additive and interaction regressions can respond to either fan.
    base=[i,i*i,i**3,o,o*o,o**3,h,h*h,i*h,i*i*h,o*h,o*o*h]
    if coupled:base += [i*o,i*i*o,i*o*o,i*o*h,i*i*o*h,i*o*o*h]
    return centered(np.stack(base,-1))


def fit_walks():
    path=Path('walks.zip')
    if hashlib.md5(path.read_bytes()).hexdigest()!='19bb4e92cbe0b8dff49299b9b509ac36':raise ValueError('walk archive')
    xs=[[],[]];ys=[];dev={}
    with ZipFile(path) as z:
        for seed in range(1,17):
            with z.open(f'wt_walks_v1/actuators_random_walk_{seed}.csv') as f:
                a=pd.read_csv(f,usecols=INPUT+OUTPUT)
            n=len(a)//50
            u=a[INPUT].to_numpy()[:n*50].reshape(n,50,4)
            y=a[OUTPUT].to_numpy()[:n*50].reshape(n,50,2)
            # Preserve all acquired records in the roster. A short tail cannot form a 50-row fit window.
            blocks=[basis(u,c)[:,5:].reshape(n*45,-1) for c in (False,True)]
            values=centered(y)[:,5:].reshape(-1,2)
            if seed==16:dev={'x':blocks,'y':values};continue
            valid=np.isfinite(values).all(1)
            for j in range(2):xs[j].append(blocks[j][valid])
            ys.append(values[valid])
    B=[]
    y=np.concatenate(ys)
    for blocks in xs:
        x=np.concatenate(blocks);scale=np.maximum(np.sqrt((x*x).mean(0)),1.e-8)
        z=x/scale
        co=np.linalg.solve(z.T@z+.001*len(z)*np.eye(z.shape[1]),z.T@y)
        B.append(co/scale[:,None])
    return B,[np.sqrt(np.mean((a@b-dev['y'])**2,axis=0)).tolist() for a,b in zip(dev['x'],B)]


def interp_profiles(source_h, profiles, h):
    # Fixed 5-degree bins; all training events contribute. Interpolate between bin centers.
    k=np.minimum((source_h/5).astype(int),8)
    table=np.array([profiles[k==v].mean(0) for v in range(9)])
    q=np.clip(h/5-.5,0,8)
    lo=q.astype(int);hi=np.minimum(lo+1,8)
    f=(q-lo).reshape((-1,)+(1,)*(table.ndim-1))
    return table[lo]*(1-f)+table[hi]*f


def fit():
    u,y=panel('0.5');u=u[:4000];y=y[:4000]
    prefix=y[:,:5].mean(1);s_h=u[:,0,3]
    dy=centered(y)
    coef,dev=fit_walks()
    walk=basis(u,True)@coef[1]
    return {'h':s_h,'dy':dy,'prefix':prefix,'dt':np.diff(u[:,:,0]),'walk_res':dy-walk,
            'coef':coef,'walk_dev':dev}


def forecasts(model,u,prefix):
    t,li,lo,h=np.moveaxis(u,-1,0)
    base=prefix.mean(1);pre=base[:,None,:]
    wi=speeds(li,t);wo=speeds(lo,t)
    auth_pressure=component(wi,h)-component(wo,h)
    deterministic=np.stack([wo*RPM,auth_pressure],axis=-1)
    roles={'persistence':np.broadcast_to(pre,deterministic.shape),
           'author_centered':pre+centered(deterministic)}
    draw=deterministic.copy();draw[:,:,1]+=prefix[:,0,1,None]+np.random.default_rng(3).normal(0,.2,size=50)
    roles['author_draw']=draw
    h0=h[:,0]; hs=model['h']
    tmpl=interp_profiles(hs,model['dy'],h0)
    roles['middle_template']=pre+tmpl
    for j,name in enumerate(('walk_additive','walk_coupled')):roles[name]=pre+basis(u,bool(j))@model['coef'][j]
    roles['walk_plus_template']=roles['walk_coupled']+interp_profiles(hs,model['walk_res'],h0)
    mid=interp_profiles(hs,model['prefix'][:,0,None],h0)[:,0]/RPM
    src=mid[:,None]+tmpl[:,:,0]/RPM
    src0=mid[:,None]
    target0=base[:,0,None]/RPM
    sq=np.sqrt(np.maximum(0,target0**2+src**2-src0**2))
    def correct(w):
        p=tmpl[:,:,1]-(component(w,h)-component(target0,h))+(component(src,h)-component(src0,h))
        return np.stack([w*RPM,np.broadcast_to(base[:,1,None],p.shape)+p],axis=-1)
    roles['squared_speed']=correct(sq)
    # Estimate a torque increment from the training template and propagate with
    # the same quadratic-drag law around the target prefix operating speed.
    # Use the middle panel's mean within-event spacing, not target timing.
    dt_src=interp_profiles(hs,model['dt'],h0)
    torque=INERTIA*np.diff(src,axis=1)/dt_src+DRAG*(src[:,:-1]**2-src0**2)
    w=np.broadcast_to(target0,src.shape).copy()
    for j in range(5,50):
        dt=t[:,j]-t[:,j-1]
        w[:,j]=np.maximum(0,w[:,j-1]+dt/INERTIA*(torque[:,j-1]-DRAG*(w[:,j-1]**2-target0[:,0]**2)))
    roles['torque_transfer']=correct(w)
    if set(roles)!=set(ROLES) or not all(np.isfinite(a).all() for a in roles.values()):raise ValueError('nonfinite or missing role')
    return {k:np.array(roles[k][:,5:,:],dtype='<f4') for k in ROLES}
