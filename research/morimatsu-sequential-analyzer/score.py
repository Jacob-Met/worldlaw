"""Independently reopen all locked forecast bytes before acquiring any developer targets."""
from pathlib import Path
import sys,hashlib,json,zipfile
import numpy as np
from training import image,download,root,f
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as fp:
        while b:=fp.read(1<<20):h.update(b)
    return h.hexdigest()
def main(expected):
    dev=f['split']['development'];locked=root/'locked';lf=locked/'lock.json'
    assert sha(lf)==expected
    lock=json.loads(lf.read_text());methods=lock['controls'];assert lock['dev']==dev and set(dev)==set(lock['rows'])
    for s,v in lock['rows'].items():
        assert sha(locked/(s+'.npz'))==v['forecast_sha']
        assert all(sha(root/'images'/s/f'{k}.png')==v['inputs'][str(k)] for k in (0,45,90))
        with np.load(locked/(s+'.npz')) as held:
            assert set(held.files)==set(methods)
            assert all(held[m].shape==(768,1024) and held[m].dtype==np.dtype('<f4') and np.isfinite(held[m]).all() for m in methods)
    print('VERIFIED_PRELABEL',expected,len(dev),len(methods),flush=True)
    out={};rng=np.random.default_rng(20261123)
    for s in dev:
        a=[image(s,k) for k in (0,45,90)]
        tar=download(s,135,dev);y=image(s,135).astype('d')
        h,w=y.shape;inter=np.zeros(y.shape,bool);inter[16:-16,16:-16]=True
        grad=np.hypot(*np.gradient(.5*(a[0]+a[2])));lo=np.minimum.reduce(a);hi=np.maximum.reduce(a)
        masks={'interior':inter,'full':np.ones(y.shape,bool),'border':~inter,'high_gradient':inter&(grad>=np.quantile(grad[inter],.9)),'low_donor':inter&(lo<=.02),'high_donor':inter&(hi>=.95)}
        data={};raw={}
        with np.load(locked/(s+'.npz')) as held:
            for m in methods:
                pred=held[m].astype('d');delta=pred-y;data[m]={}
                for key,mask in masks.items():
                    v=delta[mask];data[m][key]=[v.size,float(v@v),float(v.sum())]
                ids=np.argsort(np.where(inter,abs(delta),-1).ravel())[-3:][::-1]
                raw[m]=[]
                for id in ids:
                    i,j=map(int,np.unravel_index(id,y.shape))
                    raw[m].append({'row':i,'column':j,'observed_0_45_90_135_DN':[int(round(float(z[i,j])*65535)) for z in a+[y]],'prediction':pred[i,j],'error':delta[i,j],'high_gradient':bool(masks['high_gradient'][i,j])})
            for wr in raw['physical_joint']:wr['all_methods']={m:float(held[m][wr['row'],wr['column']]) for m in methods}
        out[s]={'target_sha':sha(tar),'methods':data,'worst':raw,'params':lock['rows'][s]['params']}
        print('SCORED',s,flush=True)
    def metric(s,m,k):
        n,ss,err=out[s]['methods'][m][k];return float(np.sqrt(ss/n)) if n else None
    means={k:{m:float(np.mean([metric(s,m,k) for s in dev if metric(s,m,k) is not None])) for m in methods} for k in ('interior','full','border','high_gradient')}
    cand='physical_joint';other=[m for m in methods if m!=cand];best=min(other,key=means['interior'].get);bestedge=min(other,key=means['high_gradient'].get)
    wins=sum(metric(s,cand,'interior')<metric(s,best,'interior') for s in dev);maxima={m:max(metric(s,m,'interior') for s in dev) for m in methods}
    gates=[len(out)==15 and all(out[s]['methods'][m]['interior'][0]==(768-32)*(1024-32) for m in methods for s in dev),means['interior'][cand]<=.95*means['interior'][best],wins>=10,maxima[cand]<=1.1*maxima[best],means['high_gradient'][cand]<=1.05*means['high_gradient'][bestedge]]
    result={'lock_sha':expected,'rows':out,'means':means,'maxima':maxima,'best':best,'best_edge':bestedge,'wins':wins,'gates':gates}
    file=root/'score.json';file.write_text(json.dumps(result,sort_keys=True))
    worst=max(dev,key=lambda s:metric(s,cand,'interior'))
    print('SCORES',json.dumps({'means':means,'maxima':maxima,'gates':gates,'wins':wins,'best':best,'worst_scene':worst,'worst_witness':out[worst]['worst'][cand][0],'scenes':{s:[metric(s,cand,'interior'),metric(s,best,'interior')] for s in dev},'score_sha':sha(file),'bytes':file.stat().st_size}),flush=True)
if __name__=='__main__':main(sys.argv[1])
