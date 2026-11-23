"""Independent disk receiver for full physical maps after the scoring lock has been opened."""
import hashlib,json,pathlib,sys,zlib,struct
import numpy as np
from scipy import ndimage
def digest(p):
    with open(p,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def verify(root,lock_sha,result_sha):
    import cv2
    root=pathlib.Path(root)
    assert digest(root/'score.json')==result_sha and digest(root/'locked/lock.json')==lock_sha
    score=json.loads((root/'score.json').read_text()); lock=json.loads((root/'locked/lock.json').read_text())
    assert score['lock_sha']==lock_sha;assert len(lock['rows'])==15
    methods=lock['controls']; assert len(set(methods))==11
    rr={};worst=0;maximum=0.;cells=0;coords=0
    for scene,info in lock['rows'].items():
        rec=score['rows'][scene];p=root/'locked'/(scene+'.npz');assert digest(p)==info['forecast_sha']
        imgs=[]
        for angle in [0,45,90,135]:
            pf=root/'images'/scene/f'{angle}.png'
            assert digest(pf)==(info['inputs'][str(angle)] if angle!=135 else rec['target_sha'])
            # Uint16 green, independently rescale through the producer's float32 acquisition convention.
            ar=cv2.imdecode(np.frombuffer(pf.read_bytes(),dtype=np.uint8),cv2.IMREAD_UNCHANGED)
            assert ar.shape==(768,1024,3) and ar.dtype==np.uint16
            imgs.append(ar[:,:,1])
        fs=[v.astype(np.float32)/np.float32(65535) for v in imgs];y=fs[3].astype(float)
        val=(fs[0]+fs[2])/np.float32(2)
        # Reimplement finite differences explicitly instead of np.gradient.
        v=np.empty_like(val);h=np.empty_like(val)
        v[1:-1,:]=(val[2:,:]-val[:-2,:])/2;v[0,:]=val[1,:]-val[0,:];v[-1,:]=val[-1,:]-val[-2,:]
        h[:,1:-1]=(val[:,2:]-val[:,:-2])/2;h[:,0]=val[:,1]-val[:,0];h[:,-1]=val[:,-1]-val[:,-2]
        gr=np.hypot(v,h);ii,jj=np.indices(y.shape);region=(ii>=16)&(ii<752)&(jj>=16)&(jj<1008);ones=np.full(y.shape,True)
        masks={'interior':region,'full':ones,'border':~region,'high_gradient':region&(gr>=np.percentile(gr[region],90)),'low_donor':region&((fs[0]<=.02)|(fs[1]<=.02)|(fs[2]<=.02)),'high_donor':region&((fs[0]>=.95)|(fs[1]>=.95)|(fs[2]>=.95))}
        rr[scene]={}
        with np.load(p) as f:
            for name in methods:
                pred=f[name];res=pred.astype(float)-y;rr[scene][name]={}
                for key,mask in masks.items():
                    n,ss,tot=rec['methods'][name][key];dx=res[mask]
                    assert n==len(dx)
                    sq=float(np.sum(np.square(dx),dtype=np.float64));sm=float(np.sum(dx,dtype=np.float64));delta=max(abs(sq-ss),abs(sm-tot));maximum=max(maximum,delta);cells+=1
                    assert abs(sq-ss)<=3e-10*max(1.,abs(sq)) and abs(sm-tot)<=3e-10*max(1.,abs(sm))
                    if n:rr[scene][name][key]=(sq/n)**.5
                for a in rec['worst'][name]:
                    i,j=a['row'],a['column']
                    assert a['observed_0_45_90_135_DN']==[int(t[i,j]) for t in imgs]
                    assert a['prediction']==float(pred[i,j]) and a['error']==res[i,j];coords+=1
                extreme=np.max(np.abs(res[region]));assert abs(abs(rec['worst'][name][0]['error'])-extreme)<1e-14;worst+=1
    mean=lambda name,key:float(np.mean([rr[s][name][key] for s in rr]))
    cand='physical_joint';other=[x for x in methods if x!=cand]
    best=min(other,key=lambda x:mean(x,'interior'));ew=min(other,key=lambda x:mean(x,'high_gradient'))
    wins=sum(rr[s][cand]['interior']<rr[s][best]['interior'] for s in rr)
    max_scene=lambda m:max(rr[s][m]['interior'] for s in rr)
    gates=[cells==990,mean(cand,'interior')<=.95*mean(best,'interior'),wins>=10,max_scene(cand)<=1.10*max_scene(best),mean(cand,'high_gradient')<=1.05*mean(ew,'high_gradient')]
    assert gates==score['gates'] and best==score['best'] and wins==score['wins']
    print(json.dumps({'scenes':len(rr),'methods':len(methods),'scored_cells':cells,'interior_worst_maps':worst,'raw_witnesses':coords,'max_abs_sum_delta':maximum,'gates':gates,'best':best,'wins':wins,'original_score_sha':result_sha,'preoutcome_lock':lock_sha}),flush=True)
if __name__=='__main__':verify(*sys.argv[1:])
