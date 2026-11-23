"""Prospectively specified held-angle forecast. Fitting/scoring freezes use distinct entry points."""
import os,sys,pathlib,json,hashlib,math
import numpy as np,cv2
from scipy.ndimage import map_coordinates
from training import download,image,f,root,feature
from author import run_author
runtime=os.environ['MORIMATSU_AUTHOR_RUNTIME']
names=['stokes','author_complement','affine','local_ridge','EARI','IGRI2','extrapolate_last_ratio','physical_gain','physical_shift','physical_joint','empirical_joint']
def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as fp:
        for b in iter(lambda:fp.read(1<<20),b''):h.update(b)
    return h.hexdigest()
def params(x):
    a,b,c=x;h,w=a.shape;gy=[]
    for t in x:
        gx=cv2.Sobel(t,cv2.CV_32F,1,0,ksize=3)
        gv=cv2.Sobel(t,cv2.CV_32F,0,1,ksize=3)
        gy.append(np.log1p(40*np.hypot(gx,gv)))
    # Three pairwise translations from donor structural edges, no target alignment.
    shifts={(0,1):[],(0,2):[],(1,2):[]}; sl=[]; win=cv2.createHanningWindow((128,128),cv2.CV_32F)
    for cy in range(96,h-64,128):
        for cx in range(96,w-64,128):
            grid=(slice(cy-64,cy+64),slice(cx-64,cx+64))
            g=[v[grid] for v in gy]
            for k in shifts:
                u,v=k
                if np.std(g[u])<.012 or np.std(g[v])<.012:continue
                (dx,dy),resp=cv2.phaseCorrelate(g[u].copy(),g[v].copy(),win)
                if np.isfinite([dx,dy,resp]).all() and resp>=.15 and max(abs(dx),abs(dy))<=5:shifts[k].append((dx,dy))
            z=np.stack([t[grid][::4,::4] for t in x])
            mask=(z.min(axis=0)>.02)&(z.max(axis=0)<.95)
            if mask.sum()<64:continue
            zz=np.log(z[:,mask]); cur=np.abs(zz[0]+zz[2]-2*zz[1]);keep=cur<=np.quantile(cur,.25)
            sl.append(np.median((zz[2,keep]-zz[0,keep])/2))
    # Fix t0=0, least squares among observed pairwise donor shifts, then take geometric harmonic extrapolation.
    rows=[];tv=[]
    for (i,j),v in shifts.items():
        if len(v)>=3:
            d=np.zeros(3);d[j]=1;d[i]=-1;rows.append(d[1:]);tv.append(np.median(v,axis=0))
    tt=np.zeros((3,2))
    if len(rows)>=2 and np.linalg.matrix_rank(rows)==2:tt[1:]=np.linalg.lstsq(np.array(rows),np.array(tv),rcond=None)[0]
    q=(1+np.sqrt(2))*(tt[2]-tt[1]);q=np.clip(q,-6,6);k=float(np.clip(np.median(sl),-np.log(1.25),np.log(1.25))) if sl else 0.
    return {'k':k,'donor_xy':tt.tolist(),'fourth_xy':q.tolist(),'tile_count_gain':len(sl),'tile_counts_shift':[len(v) for v in shifts.values()]}
def physics(data,par):
    k=par['k'];tt=np.array(par['donor_xy']);q=np.array(par['fourth_xy'])
    moved=[]
    for v,delta in zip(data,tt-q):
        mat=np.array([[1,0,delta[0]],[0,1,delta[1]]],dtype='f4')
        moved.append(cv2.warpAffine(v,mat,(v.shape[1],v.shape[0]),flags=cv2.WARP_INVERSE_MAP|cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE))
    def calc(v,k):return np.clip(np.exp(3*k)*v[0]-np.exp(2*k)*v[1]+np.exp(k)*v[2],0,1).astype('f4')
    return calc(data,k),calc(moved,0),calc(moved,k)
def features(a,y,x,physical):
    # Replicate outside-frame boundary, identical availability for all spatial methods.
    h,w=a[0].shape
    values=[np.ones(np.broadcast_shapes(y.shape,x.shape),dtype='f4')]
    for channel in a:
        for dy in (-2,-1,0,1,2):
            for dx in (-2,-1,0,1,2):values.append(channel[np.clip(y+dy,0,h-1),np.clip(x+dx,0,w-1)])
    local=np.stack(values,axis=-1)
    ex=np.stack([p[y,x] for p in physical],axis=-1)
    return local,np.concatenate([local,ex],axis=-1)
def fit():
    agg={};n=0
    for s in f['split']['training']:
        a=[image(s,k) for k in (0,45,90)];tar=image(s,135);par=params(a);ph=physics(a,par)
        y=np.arange(16,tar.shape[0]-16,8)[:,None];x=np.arange(16,tar.shape[1]-16,8)[None,:]
        local,rich=features(a,y,x,ph);af=feature([v[y,x] for v in a])
        z=tar[y,x].ravel().astype('d');n+=len(z)
        for name,arr in [('affine',af),('local_ridge',local),('empirical_joint',rich)]:
            m=arr.reshape(len(z),-1).astype('d')
            if name not in agg:agg[name]=[m.T@m,m.T@z]
            else:agg[name][0]+=m.T@m;agg[name][1]+=m.T@z
    out={}
    for name,(xx,xy) in agg.items():
        add=np.eye(len(xy))*n*(1.e-5 if name!='affine' else 0);add[0,0]=0
        out[name]=np.linalg.lstsq(xx+add,xy,rcond=1e-12)[0]
    return out
def forecast():
    from concurrent.futures import ThreadPoolExecutor
    dev=f['split']['development'];train=f['split']['training'];output=root/'locked';output.mkdir(exist_ok=True)
    coef=fit();rows={};obs={}
    for s in dev:
        with ThreadPoolExecutor(3) as pool: list(pool.map(lambda k:download(s,k,dev),[0,45,90]))
        assert not (root/'images'/s/'135.png').exists(),'unexpected target before lock'
        a=[image(s,k) for k in (0,45,90)];p=params(a);ph=physics(a,p);h,w=a[0].shape
        pred={'stokes':np.clip(a[0]+a[2]-a[1],0,1),'author_complement':np.clip(1-a[1],0,1),'physical_gain':ph[0],'physical_shift':ph[1],'physical_joint':ph[2],'extrapolate_last_ratio':np.clip(a[2]*np.exp(p['k']),0,1)}
        pred['affine']=np.clip(feature(a)@coef['affine'],0,1).astype('f4')
        for n in ('local_ridge','empirical_joint'):pred[n]=np.empty((h,w),dtype='f4')
        for lo in range(0,h,32):
            y=np.arange(lo,min(lo+32,h))[:,None];x=np.arange(w)[None,:];l,r=features(a,y,x,ph)
            for n,t in [('local_ridge',l),('empirical_joint',r)]:pred[n][lo:lo+t.shape[0]]=np.clip(t@coef[n],0,1)
        pred.update(run_author(a,root/'author-dev'/s,runtime))
        assert set(pred)==set(names)
        file=output/(s+'.npz');np.savez(file,**{n:pred[n].astype('<f4') for n in names})
        rows[s]={'forecast_sha':sha(file),'params':p,'bytes':file.stat().st_size,'inputs':{str(k):sha(root/'images'/s/f'{k}.png') for k in (0,45,90)}}
        print('LOCK_MEMBER',s,rows[s]['forecast_sha'],flush=True)
    lock={'train':train,'dev':dev,'reserve':f['split']['reserve'],'controls':names,'fits':{k:v.tolist() for k,v in coef.items()},'rows':rows}
    lockfile=output/'lock.json';lockfile.write_text(json.dumps(lock,sort_keys=True))
    assert all(sha(output/(s+'.npz'))==v['forecast_sha'] for s,v in rows.items())
    assert all(not (root/'images'/s/'135.png').exists() for s in dev)
    print('ALL_FORECASTS_LOCKED',root,sha(lockfile),sum(r['bytes'] for r in rows.values()),json.dumps({s:rows[s]['params'] for s in dev}),flush=True)
if __name__=='__main__':forecast()
