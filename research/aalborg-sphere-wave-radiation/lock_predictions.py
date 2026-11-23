"""Build and lock all gauge forecasts with held experimental heave as conditional input."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
from itertools import combinations
from urllib.request import urlopen
import zipfile
import numpy as np
from lower_release_native_clock import URL, SHA, GRID, read_source
from radiation_fit import MODEL_FAMILIES, basis_cache, matrix

VENDORS=("RANS2","RANS3","RANS4","RANS5")
ARCHIVE_NAMES=("zero","height_pooled","height_latest","height_quadratic","height_cubic")


def columns(z,name,usecols):
    """The named raw files use a one-line field header and whitespace numeric rows."""
    with z.open(name) as stream:
        fields=stream.readline().decode('utf-8-sig').strip()
        assert all(key in fields for key in ('t','x3','WG1','WG2','WG3'))
        return np.loadtxt(stream,usecols=usecols,ndmin=2)


def prepare_paths(directory):
    directory.mkdir(parents=True,exist_ok=True)
    path=directory/'forecast-lock.npz'
    if path.exists() or (directory/'forecast-registry.json').exists():
        raise RuntimeError('Existing forecast lock; refusing to reexecute')
    return path


def train(panels,params):
    runs=np.concatenate([panels['01'],panels['03']])
    target=np.vstack(runs[:,:,1:])
    models={}
    for step in sorted(set(cfg[0] for cfg in params.values())):
        cache=[basis_cache(r[:,0],step) for r in runs]
        for f in MODEL_FAMILIES:
            if params[f][0]!=step:
                continue
            ridge=params[f][1]
            x=np.vstack([matrix(b,f) for b in cache])
            mu=x.mean(axis=0)
            x-=mu
            scale=np.sqrt(np.mean(x**2,axis=0))
            scale[scale<1e-12]=1
            x/=scale
            ybar=target.mean(axis=0)
            gram=x.T@x/len(x)+ridge*np.eye(x.shape[1])
            rhs=x.T@(target-ybar)/len(x)
            beta=np.linalg.solve(gram,rhs)/scale[:,None]
            models[f]=(ybar-mu@beta,beta,step)
    return models


def predict(models,z):
    by_step={}
    out={}
    for f,(intercept,beta,step) in models.items():
        if step not in by_step:
            by_step[step]=basis_cache(z,step)
        out[f]=matrix(by_step[step],f)@beta+intercept
    return out


def dev_mixture(lower,params):
    """Gauge-specific convex weights from the 0.1D -> 0.3D development predictions."""
    models=train({'01':lower['01'],'03':lower['01'][:0]},params)
    outputs=[predict(models,trial[:,0]) for trial in lower['03']]
    stack=np.stack([np.stack([p[f] for p in outputs]) for f in MODEL_FAMILIES],axis=-1)
    y=lower['03'][:,:,1:]
    weights=[]
    for g in range(3):
        x=stack[:,:,g,:].reshape(-1,len(MODEL_FAMILIES))
        target=y[:,:,g].ravel()
        best=None
        for count in range(1,len(MODEL_FAMILIES)+1):
            for support in combinations(range(len(MODEL_FAMILIES)),count):
                xp=x[:,support]
                candidate=np.ones(1)
                if count>1:
                    gains=np.linalg.lstsq(xp[:,:-1]-xp[:,-1,None], target-xp[:,-1],rcond=None)[0]
                    candidate=np.r_[gains,1-gains.sum()]
                if candidate.min() < -1e-10:
                    continue
                w=np.zeros(len(MODEL_FAMILIES));w[list(support)]=np.maximum(candidate,0)
                w/=w.sum()
                error=float(np.mean((x@w-target)**2))
                if best is None or error < best[0]:
                    best=(error,w)
        weights.append(best[1])
    return np.array(weights)


def blend(pred,weights):
    stack=np.stack([pred[f] for f in MODEL_FAMILIES],axis=-1)
    return np.sum(stack*weights,axis=-1)


def release_templates(panels):
    y=np.stack([panels[d][:,:,1:].mean(axis=0) for d in ('01','03')])
    h=np.array([.03,.09]); q=.15
    out={'zero':np.zeros_like(y[0]),'height_latest':(q/h[1])*y[1],
         'height_pooled':np.tensordot(q*h/(h@h),y,axes=1)}
    for name,power in [('height_quadratic',2),('height_cubic',3)]:
        weights=np.linalg.solve(np.array([h,h**power]),[q,q**power])
        out[name]=np.tensordot(weights,y,axes=1)
    return out


def canonical_archive(path,arrays):
    """Sorted stable NPY members, with deterministic ZIP metadata."""
    tmp=path.with_suffix('.part')
    roster={}
    with zipfile.ZipFile(tmp,'w') as z:
        for name in sorted(arrays):
            value=np.asarray(arrays[name],dtype='<f8')
            assert np.isfinite(value).all()
            buffer=io.BytesIO();np.save(buffer,value,allow_pickle=False)
            data=buffer.getvalue();info=zipfile.ZipInfo(name+'.npy',(1980,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,data)
            roster[name]=[list(value.shape),hashlib.sha256(data).hexdigest()]
    os.replace(tmp,path)
    return roster


def run(params,directory):
    assert set(params)==set(MODEL_FAMILIES)
    path=prepare_paths(directory)
    with urlopen(URL,timeout=45) as response: data=response.read(17549046)
    assert hashlib.sha256(data).hexdigest()==SHA
    arrays={}
    vendor_meta={}
    conditions={}
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        lower=read_source(z)
        models=train(lower,params)
        weights=dev_mixture(lower,params)
        held=[]
        for i in range(1,5):
            name=f'Datafile/Experimental results/05D_Measured{i}_Raw.txt'
            # Trusted text extractor reads source bytes. Only clock and body motion become
            # floating-point values; the three gauge columns never reach the predictor.
            a=columns(z,name,(0,1)); assert np.isfinite(a).all()
            assert np.array_equal(a[a[:,0]>=0,0],GRID)
            held.append(a[a[:,0]>=0,1])
            conditions[str(i)]=hashlib.sha256(np.asarray(held[-1],dtype='<f8').tobytes()).hexdigest()
        predictions=[predict(models,row) for row in held]
        for f in MODEL_FAMILIES:
            arrays['motion_'+f]=np.stack([p[f] for p in predictions])
        arrays['motion_dev_convex']=np.stack([blend(p,weights) for p in predictions])
        arrays['motion_other_repeat_cap']=np.roll(arrays['motion_cap_tied'],-1,axis=0)
        for k,v in release_templates(lower).items():
            arrays['release_'+k]=v
        for vendor in VENDORS:
            name=f'Datafile/Numerical results/{vendor}/05D_{vendor}.txt'
            a=columns(z,name,(0,1,2,3,4))
            assert np.isfinite(a).all() and (np.diff(a[:,0])>0).all(), vendor
            support=(GRID>=a[0,0])&(GRID<=a[-1,0])
            assert support.any(),vendor
            ts=GRID[support]
            arrays['solver_'+vendor+'_clock']=ts
            arrays['solver_'+vendor+'_submitted']=np.column_stack([np.interp(ts,a[:,0],a[:,k]) for k in (2,3,4)])
            vendor_meta[vendor]={'native_rows':len(a),'native_t':[float(a[0,0]),float(a[-1,0])],'matched_rows':len(ts)}
            # The physics map needs a model's motion from t=0, and no fabricated prehistory.
            if ts[0]==0:
                zhat=np.interp(ts,a[:,0],a[:,1])
                fitted=predict(models,zhat)
                for k in ('constant_area','cap_tied','free_pair'):
                    arrays['solver_'+vendor+'_'+k]=fitted[k]
                arrays['solver_'+vendor+'_dev_convex']=blend(fitted,weights)
                vendor_meta[vendor]['paired_heave_roles']=True
            else: vendor_meta[vendor]['paired_heave_roles']='missing release sample'
    roster=canonical_archive(path,arrays)
    record={'archive_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'archive_bytes':path.stat().st_size,'members':roster,'archive_path':str(path),
        'high_experimental_gauge_columns_parsed':0,'motion_condition_sha256':conditions,
        'source_sha256':SHA,'training_choices':params,'vendors':vendor_meta,'dev_convex_weights':weights.tolist(),'family_order':list(MODEL_FAMILIES)}
    (directory/'forecast-registry.json').write_text(json.dumps(record,sort_keys=True)+'\n')
    print(json.dumps(record,sort_keys=True),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('params');parser.add_argument('directory',type=Path)
    args=parser.parse_args();run(json.loads(args.params),args.directory)
