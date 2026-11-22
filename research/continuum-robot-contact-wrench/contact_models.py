"""Predict offline tared contact moments from released disk poses and measured wand wrench."""
from pathlib import Path
import hashlib
import io
import json
import zipfile
import numpy as np
from scipy.signal import butter, filtfilt
from scipy.spatial.transform import Rotation

DATA_SHA='1255612e370d447ef55105c9b843136c891f00a0dd6817da47484f343ab5a29c'
HELD=('push_retract','plane_y_contact_midway','plane_y_poke_x','plane_y_poke_y')
ARMS=('source_adjoint','mount','uniform_102g','uniform_101_27g','component_101_27g','linear','nonlinear')
LAMBDA=(1e-6,1e-4,1e-2,1.,100.)


def original(path):
    with open(path,'rb') as file:
        if hashlib.file_digest(file,'sha256').hexdigest()!=DATA_SHA:
            raise ValueError('Toronto v3 complete measurement archive differs')
    return zipfile.ZipFile(path)


def table(z, run, name, width, expected=None):
    p=f'data/{run}/processed/{name}.csv'
    a=np.loadtxt(io.BytesIO(z.read(p)),delimiter=',',ndmin=2)
    if a.shape[1]!=width+1 or len(a)<102 or not np.isfinite(a).all():
        raise ValueError(f'Invalid required dimensions or finite support in {p}: {a.shape}')
    t=a[:,0]
    if not np.allclose(np.diff(t),.01,rtol=0,atol=2e-10) or (expected is not None and not np.array_equal(t,expected)):
        raise ValueError('Incompatible source sampling clock '+p)
    return t,a[:,1:]


def smooth(t,v):
    # Source inputs are uniform to CSV rounding. Match the explicit preliminary interpolation.
    tt=np.linspace(t[0],t[-1],len(t))
    flat=v.reshape(len(t),-1)
    vals=np.column_stack([np.interp(tt,t,flat[:,i]) for i in range(flat.shape[1])])
    b,a=butter(4,2/(.5*(len(t)-1)/(t[-1]-t[0])))
    return filtfilt(b,a,vals,axis=0,padlen=3*(max(len(a),len(b))-1)).reshape(v.shape)


def disk_series(z,run):
    t,a=table(z,run,'mocap_frames',30)
    p=a.reshape(len(t),5,6)[:,:,3:]
    delta=p-p[:100].mean(axis=0,keepdims=True)
    return t,p,delta


def contact(z,run):
    t,p,delta=disk_series(z,run)
    _,pose=table(z,run,'contact_pose',6,t)
    _,wand=table(z,run,'contact_wrench',6,t)
    rot=Rotation.from_euler('XYZ',pose[:,:3])
    force=-rot.apply(wand[:,:3])
    moment=-rot.apply(wand[:,3:])+np.cross(pose[:,3:],force)
    return t,p,delta,pose,smooth(t,np.column_stack((force,moment)))


def mount_fit(z):
    name='contact_motion/touch_base'
    t,p,delta,pose,adj=contact(z,name)
    y=smooth(t,table(z,name,'base_wrench',6,t)[1])
    basis=np.broadcast_to(np.eye(3),(len(t),3,3))
    cross=np.cross(basis,adj[:,:3,None].transpose(0,2,1)).transpose(0,2,1)
    design=np.concatenate((cross,basis),axis=2).reshape(-1,6)
    fit,_,rank,svalues=np.linalg.lstsq(design,(y[:,3:]-adj[:,3:]).ravel(),rcond=1e-10)
    return fit,{'rank':int(rank),'singular_values':svalues.tolist(),'delta_m':fit[:3].tolist(),'offset_Nm':fit[3:].tolist(),'rows':len(t)}


def gravity(t,dp):
    # Five marker sets sit at the tracked stations. The untracked disk centers interpolate spatially.
    mean=np.tensordot(dp,np.array([.125,.25,.25,.25,.125]),axes=([1],[0]))
    inter=np.stack([dp[:,i//2] if i%2==0 else (dp[:,i//2]+dp[:,i//2+1])/2
                    for i in range(1,8)],axis=1)
    discrete=(5.90*mean+41.22*dp[:,0]+8.90*dp[:,-1]+5.25*inter.sum(axis=1)+1.70*dp.sum(axis=1))/1000
    return [smooth(t,np.cross(mm,[0,0,9.81])) for mm in (mean*.102,mean*.10127,discrete)]


def input_features(t,dp):
    p=smooth(t,dp).reshape(len(t),15)
    v=np.gradient(p,t,axis=0)
    return np.column_stack((p,v,np.gradient(v,t,axis=0)))


def training(z):
    runs=sorted({str(Path(n).parent.parent).split('data/',1)[1] for n in z.namelist()
                 if n.endswith('/processed/base_wrench.csv') and n.startswith(('data/dynamic_motion/','data/quasi_static/'))})
    if len(runs)!=26:
        raise ValueError('Expected 26 complete independent noncontact training paths')
    items=[]
    for n in runs:
        t,p,delta=disk_series(z,n)
        x=input_features(t,delta)
        y=smooth(t,table(z,n,'base_wrench',6,t)[1])[:,3:]
        items.append((x,y,t))
    return runs,items


def design(x,m,scale,weights,phase):
    standardized=(x-m)/scale
    if weights is not None:
        return np.column_stack((standardized,np.sqrt(2/96)*np.cos(standardized@weights+phase)))
    return standardized


def fit(items,ids,lam,nonlinear):
    xs=[items[i][0][::4] for i in ids]
    ys=[items[i][1][::4] for i in ids]
    m=np.mean([x.mean(axis=0) for x in xs],axis=0)
    scale=np.sqrt(np.mean([((x-m)**2).mean(axis=0) for x in xs],axis=0))
    scale[scale<1e-8]=1.
    rng=np.random.default_rng(823120)
    weights=rng.normal(0,1/np.sqrt(len(m)),(len(m),96)) if nonlinear else None
    phase=rng.uniform(0,2*np.pi,96) if nonlinear else None
    features=[design(x,m,scale,weights,phase) for x in xs]
    fx=np.mean([x.mean(axis=0) for x in features],axis=0)
    fy=np.mean([y.mean(axis=0) for y in ys],axis=0)
    gram=np.mean([(x-fx).T@(x-fx)/len(x) for x in features],axis=0)
    xy=np.mean([(x-fx).T@(y-fy)/len(x) for x,y in zip(features,ys)],axis=0)
    coef=np.linalg.solve(gram+lam*np.eye(len(fx)),xy)
    return m,scale,weights,phase,fx,fy,coef


def estimate(x,model):
    m,s,w,ph,fx,fy,coef=model
    return (design(x,m,s,w,ph)-fx)@coef+fy


def learn(items):
    models={};census={}
    for arm in ('linear','nonlinear'):
        validation={}
        for lam in LAMBDA:
            errors=[]
            for fold in range(4):
                ids=[i for i in range(len(items)) if i%4!=fold]
                model=fit(items,ids,lam,arm=='nonlinear')
                for i,(x,y,t) in enumerate(items):
                    if i%4==fold:
                        e=smooth(t,estimate(x,model))[:,:2]-y[:,:2]
                        errors.append(float((e**2).sum(axis=1).mean()))
            validation[lam]=float(np.mean(errors))
        lam=min(LAMBDA,key=lambda k:(validation[k],-k))
        models[arm]=fit(items,range(len(items)),lam,arm=='nonlinear')
        census[arm]={'lambda':lam,'cross_validation_mse':validation}
    return models,census


def forecast(path,output):
    if output.exists():
        raise FileExistsError(output)
    output.mkdir()
    with original(path) as z:
        mount,cal=mount_fit(z)
        runs,items=training(z)
        models,selection=learn(items)
        params={}
        for arm,model in models.items():
            for j,arr in enumerate(model):
                if arr is not None:params[f'{arm}_{j}']=arr
        np.savez_compressed(output/'models.npz',mount=mount,**params)
        payload={}
        for run in HELD:
            t,p,dp,pose,adj=contact(z,'contact_motion/'+run)
            ms=adj.copy()
            ms[:,3:]+=np.cross(mount[:3],adj[:,:3])+mount[3:]
            models_on_run={'source_adjoint':adj.copy(),'mount':ms.copy()}
            for label,g in zip(ARMS[2:5],gravity(t,dp)):
                tmp=ms.copy();tmp[:,3:]+=g;models_on_run[label]=tmp
            x=input_features(t,dp)
            for label,model in models.items():
                tmp=ms.copy()
                # Target is already 2 Hz passed. Apply the same comparison operator to the nonlinear prediction.
                tmp[:,3:]+=smooth(t,estimate(x,model))
                models_on_run[label]=tmp
            payload[run+'_t']=t
            payload[run+'_forecasts']=np.stack([models_on_run[label] for label in ARMS],axis=1)
            if run=='push_retract':
                payload[run+'_mask']=np.linalg.norm(p[:,-1]-pose[:,3:],axis=1)<.05
            payload[run+'_positions']=p
            payload[run+'_wand_pose']=pose
    np.savez_compressed(output/'locked.npz',**payload)
    hashed={n:hashlib.sha256((output/n).read_bytes()).hexdigest() for n in ('models.npz','locked.npz')}
    ledger={'source_sha256':DATA_SHA,'arms':ARMS,'held':HELD,'mount':cal,'training_runs':runs,
            'rows':[len(x) for x,y,t in items],'selection':selection,'sha256':hashed,
            'held_ATI_arrays_opened':0}
    (output/'lock.json').write_text(json.dumps(ledger,sort_keys=True,indent=2)+'\n')
    return ledger
