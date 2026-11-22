"""Study a seven-input causal correction with held temperatures closed until forecast lock."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from train_intake import CSV_SHA, INPUTS

DEV=(19,45,52,67)
TEST=(60,62,74)
NAMES=('firmware_float','firmware_int8','temperature_reset','generic_boosting',
       'clock_q','speed_d','speed_q')
TAUS=np.array([30.,120.,600.,1800.])


def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def extract(archive,roster,columns):
    result={p:[] for p in roster}
    with zipfile.ZipFile(archive) as z,z.open('measures_v2.csv') as f:
        h=hashlib.sha256()
        header=f.readline();h.update(header)
        names=header.decode().strip().split(',')
        ix=[names.index(c) for c in columns]
        for raw in f:
            h.update(raw)
            row=raw.rstrip().split(b',')
            pid=int(row[-1])
            if pid in result:result[pid].append([float(row[i]) for i in ix])
        assert h.hexdigest()==CSV_SHA
    return {p:np.asarray(a,np.float64) for p,a in result.items()}


def extract_features(exe,out,p,values):
    n=len(values)
    paths=[out/f'{p}-{name}.f32' for name in ('input','pred','features')]
    x=np.zeros((n,8),dtype='<f4');x[:,1:]=values;x[0,0]=1
    x.tofile(paths[0])
    subprocess.run([exe,*paths],check=True)
    raw=np.fromfile(paths[1],dtype='<f4').reshape(n,4)
    feat=np.fromfile(paths[2],dtype='<f4').reshape(n,50)
    return x,raw,feat


def profile_design(x,raw,feat):
    n=len(x)
    t=np.arange(n,dtype=np.float64)*.5
    theta=np.r_[0,np.cumsum(.5*(1+np.minimum(abs(x[:-1,5].astype(np.float64))/3000,2)))]
    init=x[0,1:].astype(np.float64)
    base=np.column_stack((feat,raw[:,:2],np.minimum(t,3600.),np.broadcast_to(init,(n,7))))
    simple=raw[:,0]+np.exp(-t/600)*(.5*(init[0]+init[1])-raw[0,0])
    blocks=[]
    for time,u in [(t,init[3]),(theta,init[2]),(theta,init[3])]:
        w=init[4]/1000
        proxy=w*u/(w*w+.3**2)
        design=np.array([1,init[0],init[1],raw[0,0],init[5],init[6],init[4],
                         proxy,proxy*init[5]/200,proxy*init[6]/200])
        blocks.append((design,np.exp(-time[:,None]/TAUS)))
    return base,simple,blocks


def train(training):
    record=json.loads((training/'train-receipt.json').read_text())
    shape={'train-input.f32':8,'train-output.f32':4,'train-features.f32':50}
    data=[]
    for name,ncol in shape.items():
        assert sha(training/name)==record['array_hashes'][name]
        data.append(np.memmap(training/name,dtype='<f4',mode='r').reshape(-1,ncol))
    target_path=training/'train-target.f64'
    assert sha(target_path)==record['array_hashes'][target_path.name]
    target=np.memmap(target_path,dtype='<f8',mode='r')
    xs=[];ys=[];weights=[];rows=[];offset=0
    for p,n in record['runs']:
        assert p not in (*DEV,*TEST)
        sl=slice(offset,offset+n)
        base,_,blocks=profile_design(*(a[sl] for a in data))
        ix=np.arange(0,n,16)
        xs.append(base[ix]);ys.append(target[sl][ix]-data[1][sl][ix,0])
        weights.append(np.full(len(ix),1/len(ix)))
        rows.append([(v,decay[ix]) for v,decay in blocks])
        offset+=n
    X=np.vstack(xs);y=np.concatenate(ys);weight=np.concatenate(weights)
    model=HistGradientBoostingRegressor(loss='squared_error',max_iter=100,max_leaf_nodes=15,
        min_samples_leaf=50,l2_regularization=1.,learning_rate=.07,early_stopping=False,random_state=17)
    model.fit(X,y,sample_weight=weight*len(weight)/weight.sum())
    residual=y-model.predict(X)
    fits=[]
    for k in range(3):
        init=np.row_stack([r[k][0] for r in rows])
        mu=init.mean(axis=0);std=init.std(axis=0)
        mu[0]=0.;std[std<1e-8]=1.
        D=np.row_stack([(decay[:,:,None]*((v-mu)/std)).reshape(len(decay),-1)
                       for v,decay in (r[k] for r in rows)])
        ww=weight/weight.sum()
        coef=np.linalg.solve(D.T@(D*ww[:,None])+.001*np.eye(D.shape[1]),D.T@(ww*residual))
        fits.append((mu,std,coef))
    hot=[];offset=0
    for p,n in record['runs']:
        row=data[0][offset,1:]
        temp=float(target[offset]);boundary=.5*(float(row[0])+float(row[1]))
        hot.append({'profile':p,'initial_pm':temp,'mean_boundary_temperature':boundary,'pm_minus_boundary':temp-boundary,'f32':float(data[1][offset,0]),'inputs':row.tolist()})
        offset+=n
    return model,fits,sorted(hot,key=lambda r:r['pm_minus_boundary'])


def forecasts(x,raw,feat,model,fits):
    base,simple,blocks=profile_design(x,raw,feat)
    generic=raw[:,0]+model.predict(base)
    out=[raw[:,0],raw[:,2],simple,generic]
    for (v,decay),(mu,std,coef) in zip(blocks,fits):
        design=(decay[:,:,None]*((v-mu)/std)).reshape(len(decay),-1)
        out.append(generic+np.sum(design*coef,axis=1))
    return np.column_stack(out)


def score(p,data,pred,truth):
    n=len(data);dt=np.arange(n)*.5
    row={'profile':p,'rows':n,'metrics':{}}
    abs_error=abs(pred-truth[:,None])
    masks={'all':np.ones(n,dtype=bool),'first60':dt<60,'60to600':(dt>=60)&(dt<600),
        'after600':dt>=600,'low_speed':abs(data[:,4])<300,'high_speed':abs(data[:,4])>=300}
    for k,mask in masks.items():
        if not mask.any():row['metrics'][k]=None;continue
        e=abs_error[mask];tail=max(1,int(np.ceil(len(e)/100)))
        row['metrics'][k]={'n':int(mask.sum()),'rmse':np.sqrt((e**2).mean(axis=0)).tolist(),
            'mae':e.mean(axis=0).tolist(),'mean_worst_1pct':np.sort(e,axis=0)[-tail:].mean(axis=0).tolist()}
    worst={}
    for i,name in enumerate(NAMES):
        j=int(np.argmax(abs_error[:,i]))
        take=np.arange(max(0,j-10),j+1)
        worst[name]={'row':j,'seconds':j*.5,'actual':float(truth[j]),'prediction':float(pred[j,i]),
                     'abs_error':float(abs_error[j,i]),'initial_inputs':data[0].tolist(),
                     'history_inputs':data[take].tolist(),'history_pm':truth[take].tolist()}
    row['worst']=worst
    return row


def main(base,training,out):
    out.mkdir(exist_ok=True,parents=True)
    model,fits,starts=train(training)
    (out/'training-start-states.json').write_text(json.dumps(starts,indent=2)+'\n')
    print('COLD_HOT_TRAIN',json.dumps(starts[:2]+starts[-3:]),flush=True)
    roster=DEV
    values=extract(base/'publisher.zip',roster,INPUTS)
    assert [len(values[p]) for p in roster]==[10410,17142,3726,11135]
    tables={}
    for p in roster:
        a=values[p]
        xyz=extract_features(training/'mte_host',out,p,a)
        forecasts_full=forecasts(*xyz,model,fits)
        prefix=79
        short=extract_features(training/'mte_host',out,f'{p}-prefix',a[:prefix])
        assert all(np.array_equal(s,l[:prefix]) for s,l in zip(short,xyz))
        prefix_forecasts=forecasts(*short,model,fits)
        # BLAS contraction layouts may differ for differently sized matrices. Use a fixed dot order below.
        assert np.array_equal(prefix_forecasts,forecasts_full[:prefix])
        assert np.isfinite(forecasts_full).all()
        tables[f'p{p}']=forecasts_full
    lock=out/'forecasts.npz'
    np.savez_compressed(lock,**tables)
    info={'sha256':sha(lock),'names':NAMES,'rows':sum(len(v) for v in tables.values()),'shapes':{k:v.shape for k,v in tables.items()}}
    manifest=out/'prelabel-forecast-lock.json';manifest.write_text(json.dumps(info,indent=2)+'\n')
    del tables
    with np.load(lock) as f:tables={p:f[f'p{p}'].copy() for p in roster}
    assert sha(lock)==json.loads(manifest.read_text())['sha256']
    print('PRELABEL_LOCK',json.dumps(info),flush=True)
    truth=extract(base/'publisher.zip',roster,['pm'])
    rows=[score(p,values[p],tables[p],truth[p][:,0]) for p in roster]
    rms=np.array([r['metrics']['all']['rmse'] for r in rows])
    tails=np.array([r['metrics']['all']['mean_worst_1pct'] for r in rows])
    mean=rms.mean(axis=0);tail=tails.mean(axis=0)
    late=np.array([r['metrics']['after600']['rmse'] for r in rows])
    result={'names':NAMES,'rows':rows,'mean_profile_rmse':mean.tolist(),'mean_tail':tail.tolist(),
            'gates':{'primary_mean':bool(mean[-1]<=.95*min(mean[:-1])),'per_profile':bool(np.all(rms[:,-1]<=1.05*rms[:,:-1].min(axis=1))),
                     'late_no_harm':bool(np.all(late[:,-1]<=1.05*late[:,:-1].min(axis=1))),'tail':bool(tail[-1]<=min(tail[:-1]))},'forecast_lock':info}
    np.savez_compressed(out/'development-reference.npz',**{f'y{p}':truth[p][:,0] for p in roster},**{f'x{p}':values[p] for p in roster})
    (out/'development-report.json').write_text(json.dumps(result,indent=2)+'\n')
    print('DEVELOPMENT_RESULT',json.dumps({k:v for k,v in result.items() if k!='rows'}),flush=True)

if __name__=='__main__':main(*(Path(p) for p in sys.argv[1:]))
