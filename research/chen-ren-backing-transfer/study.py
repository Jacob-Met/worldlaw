"""Whole-assembly Chen/Ren development replay. No reserve access."""
import argparse
import csv
import hashlib
import io
import itertools
import json
import pathlib
import zipfile
import numpy as np

ARCHIVE_SHA = '9b93ad7d7dfe8b576c65836f4c884caa0b34b65c599778dac557abffdd950e59'
CAL = ('A1','A4','A6','A7')
DEV = {'A2':'D','A3':'G','A5':'P'}
LOADS = ('0','P','G','D')
F = np.arange(340,1601,2)
METHODS = ('projective','same_load','nearest','additive_z','local_ridge')
FLOOR = 1e-10

def digest(b):
    return hashlib.sha256(b).hexdigest()

def read_trace(z, sheet, load, ledger, permitted, rep=None):
    assert (sheet,load) in permitted and sheet!='A8'
    member = f'data/mean/{sheet}-{load}.csv' if rep is None else f'data/replicates/{sheet}-{load}_r{rep}.csv'
    raw = z.read(member)
    ledger[member] = digest(raw)
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    assert [int(row['frequency_Hz']) for row in rows] == list(range(50,1601,2))
    r = np.array([complex(float(row['R_real']),float(row['R_imag'])) for row in rows if int(row['frequency_Hz'])>=340])
    assert np.all(np.isfinite(r)) and r.size==631
    return r

def clip_disk(z):
    return z/np.maximum(1,np.abs(z))

def chords(a,b,c,d):
    return (a-c)*(b-d), (a-d)*(b-c)

def geometry_distance(a,b):
    return ((int(a[1:])-1)^(int(b[1:])-1)).bit_count()

def predict_shares(donors, sheet, target, inputs):
    anchors = [k for k in LOADS if k!=target]
    a,b,c = [inputs[k] for k in anchors]
    training = list(donors)
    y = np.stack([donors[s][target] for s in training])
    dist = np.array([geometry_distance(s,sheet) for s in training])
    nearest = y[dist==min(dist)].mean(axis=0)
    projectors = np.zeros((len(a),2,2),complex)
    for s in training:
        alpha,beta = chords(*(donors[s][k] for k in [*anchors,target]))
        v = np.stack((alpha,beta),axis=-1)
        size = np.linalg.norm(v,axis=-1)
        v /= np.where(size>0,size,1)[:,None]
        projectors += v[:,:,None]*v[:,None,:].conj()
    eig,V = np.linalg.eigh(projectors)
    alpha,beta = V[:,:,-1].T
    p,q = alpha*(b-c), beta*(a-c)
    denominator = np.abs(p-q)/np.maximum(np.abs(p)+np.abs(q),1e-300)
    use = (denominator>=FLOOR)&(eig[:,-1]>0)
    projective = nearest.copy()
    projective[use] = ((p*a-q*b)[use]/(p-q)[use])
    # Z_target = Z_anchor + Z_donor,target - Z_donor,anchor; each estimate
    # is combined in impedance space, then transformed once into reflection.
    def to_z(r):
        den=1-r
        return np.divide(1+r,den,out=np.zeros_like(r),where=np.abs(den)>1e-14), np.abs(den)>1e-14
    estimates=[]
    masks=[]
    for s in training:
        v,ok=to_z(donors[s][target])
        for k in anchors:
            w,ok1=to_z(inputs[k])
            u,ok2=to_z(donors[s][k])
            estimates.append(w+v-u)
            masks.append(ok & ok1 & ok2)
    valid=np.all(masks,axis=0)
    za=np.mean(estimates,axis=0)
    valid &= np.abs(za+1)>1e-14
    additive=nearest.copy()
    additive[valid]=(za[valid]-1)/(za[valid]+1)
    return {'projective':projective,'same_load':y.mean(axis=0),'nearest':nearest,'additive_z':additive}, {'den_condition':denominator,'eig_gap':eig[:,1]-eig[:,0],'projective_fallback':~use,'z_fallback':~valid}

def ridge(training, inputs, target, width, penalty):
    anchors=[k for k in LOADS if k!=target]
    X=np.stack([np.stack([row[k] for k in anchors],axis=-1) for row in training.values()])
    Y=np.stack([row[target] for row in training.values()])
    # Uniform local window with unpenalized, centered intercept.
    idx=np.arange(len(F))
    lo=np.maximum(0,idx-width//2)
    hi=np.minimum(len(F),idx+width//2+1)
    n=(hi-lo)*len(Y)
    def local(values):
        summed=np.sum(values,axis=0)
        cumulative=np.concatenate([np.zeros_like(summed[:1]),np.cumsum(summed,axis=0)])
        return (cumulative[hi]-cumulative[lo])/n.reshape((-1,)+(1,)*(summed.ndim-1))
    mx,my=local(X),local(Y)
    xx=local(X.conj()[:,:,:,None]*X[:,:,None,:])-mx.conj()[:,:,None]*mx[:,None,:]
    xy=local(X.conj()*Y[:,:,None])-mx.conj()*my[:,None]
    scale=np.trace(xx,axis1=1,axis2=2).real/len(anchors)
    beta=np.linalg.solve(xx+np.eye(len(anchors))[None,:,:]*(penalty*np.maximum(scale,1e-12))[:,None,None],xy[:,:,None])[:,:,0]
    query=np.stack([inputs[k] for k in anchors],axis=-1)
    return my+np.sum((query-mx)*beta,axis=-1)

def rmse(x,y):
    return float(np.sqrt(np.mean(np.abs(x-y)**2)))

def controls():
    t=np.linspace(.1,.45,len(F)); inputs={k:(i+.2)*t+1j*.1*t for i,k in enumerate(LOADS)}
    coeff=[(.5,.1,.3),(.7,-.1,.15),(.9,.1,-.1),(1,.2,.35),(.6,-.2,.12)]
    field=[{k:(a*v+b)/(c*v+1) for k,v in inputs.items()} for a,b,c in coeff]
    donors=dict(zip(CAL,field[:4]))
    truth=field[4]
    err={}
    for target in LOADS:
        pred,diag=predict_shares(donors,'A2',target,{k:v for k,v in truth.items() if k!=target})
        err[target]=float(np.max(abs(pred['projective']-truth[target])))
        assert err[target]<1e-11 and not diag['projective_fallback'].any()
        assert rmse(pred['projective'],truth[target]+.03j)>.029
    flat={k:0j*np.ones(len(F)) for k in LOADS}
    _,diag=predict_shares({s:flat for s in CAL},'A2','D',flat)
    assert diag['projective_fallback'].all()
    return err

def worst(pred,actual):
    j=int(np.argmax(abs(pred-actual)))
    def pair(a): return [float(a.real),float(a.imag)]
    return {'frequency':int(F[j]),'absolute':float(abs((pred-actual)[j])),'prediction':pair(pred[j]),'observed':pair(actual[j])}

def train(z, work):
    ledger={}
    allowed=set(itertools.product(CAL,LOADS))
    donors={s:{k:read_trace(z,s,k,ledger,allowed) for k in LOADS} for s in CAL}
    cv={(w,l):[] for w in [16,64,160] for l in [.0001,.01,1.]}
    tails=[]
    for s,row in donors.items():
        others={name:value for name,value in donors.items() if name!=s}
        for k in LOADS:
            anchors={l:v for l,v in row.items() if l!=k}
            truth=row[k]
            pred,diag=predict_shares(others,s,k,anchors)
            for name,p in pred.items():
                tails.append({'sheet':s,'load':k,'method':name,'rmse':rmse(clip_disk(p),truth),'worst':worst(clip_disk(p),truth),'min_den':float(np.min(diag['den_condition']))})
            for key in cv:
                p=ridge(others,anchors,k,*key)
                cv[key].append(rmse(clip_disk(p),truth))
    best=min(cv,key=lambda key:(np.mean(cv[key]),key))
    summary={'hash':ARCHIVE_SHA,'ledger':ledger,'synthetic':controls(),'ridge':list(best),'cv':{str(k):v for k,v in cv.items()},'tails':tails}
    (work/'training.json').write_text(json.dumps(summary,sort_keys=True))
    print('TRAIN',best,[(m, max((r for r in tails if r['method']==m),key=lambda r:r['worst']['absolute'])) for m in ['projective','additive_z']],flush=True)
    return donors,best

def lock(z,work):
    donors,best=train(z,work)
    ledger={}
    allowed={(s,k) for s,target in DEV.items() for k in LOADS if k!=target}
    arrays={}
    for s,target in DEV.items():
        inputs={k:read_trace(z,s,k,ledger,allowed) for k in LOADS if k!=target}
        pred,diag=predict_shares(donors,s,target,inputs)
        pred['local_ridge']=ridge(donors,inputs,target,*best)
        for m in METHODS:
            assert np.isfinite(pred[m]).all()
            arrays[s+'_'+m]=clip_disk(pred[m])
            arrays[s+'_raw_'+m]=pred[m]
        arrays.update({s+'_'+k:v for k,v in diag.items()})
    np.savez_compressed(work/'forecast.npz',**arrays)
    index={'sha256':digest((work/'forecast.npz').read_bytes()),'inputs':ledger,'training_sha':digest((work/'training.json').read_bytes())}
    (work/'lock.json').write_text(json.dumps(index,sort_keys=True))
    print('LOCK',json.dumps(index),flush=True)

def score(z,work,pin):
    lock_sha=digest((work/'lock.json').read_bytes())
    assert lock_sha==pin
    lock_record=json.loads((work/'lock.json').read_text())
    assert digest((work/'forecast.npz').read_bytes())==lock_record['sha256']
    arrays=np.load(work/'forecast.npz',allow_pickle=False)
    rows=[]; ledger={}; obs={}; allowed=set(DEV.items())
    for s,k in DEV.items():
        y=read_trace(z,s,k,ledger,allowed)
        reps=np.stack([read_trace(z,s,k,ledger,allowed,i) for i in range(1,4)])
        obs[s]=y; obs[s+'_reps']=reps
        for m in METHODS:
            p=arrays[s+'_'+m]
            raw=arrays[s+'_raw_'+m]
            rows.append({'sheet':s,'load':k,'method':m,'rmse':rmse(p,y),'bands':[rmse(p[b],y[b]) for b in [F<700,(F>=700)&(F<1100),F>=1100]],'worst':worst(p,y),'raw_worst':worst(raw,y),'repeat_rmse':[rmse(p,yr) for yr in reps],'repeat_mean_agreement':rmse(reps.mean(axis=0),y)})
    def extract(name,key='rmse'):
        return np.array([r[key] for r in rows if r['method']==name])
    mean={m:float(np.mean(extract(m))) for m in METHODS}
    best=np.min([extract(m) for m in METHODS[1:]],axis=0)
    best_b=np.min([extract(m,'bands').mean(axis=0) for m in METHODS[1:]],axis=0)
    gates={'mean':mean['projective']<=.95*min(mean[m] for m in METHODS[1:]),'per_unit':list(map(bool,extract('projective')<=1.05*best)),'bands':list(map(bool,extract('projective','bands').mean(axis=0)<=1.10*best_b))}
    report={'rows':rows,'means':mean,'gates':gates,'raw_ledger':ledger,'lock_sha256':lock_sha}
    np.savez_compressed(work/'observed-development.npz',**obs)
    (work/'scores.json').write_text(json.dumps(report,sort_keys=True))
    print('SCORED',json.dumps({'means':mean,'gates':gates,'worst':max((r for r in rows if r['method']=='projective'),key=lambda r:r['worst']['absolute'])}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['train','lock','score'])
    parser.add_argument('archive',type=pathlib.Path)
    parser.add_argument('work',type=pathlib.Path)
    parser.add_argument('--pin')
    a=parser.parse_args()
    assert digest(a.archive.read_bytes())==ARCHIVE_SHA
    a.work.mkdir(exist_ok=True)
    with zipfile.ZipFile(a.archive) as z:
        if a.mode=='train': train(z,a.work)
        elif a.mode=='lock': lock(z,a.work)
        else: score(z,a.work,a.pin)
