"""Signed-flow boundary transport in physical time; all fitting uses programmes 1, 2 and 4."""
import ctypes as ct, hashlib, itertools, json, sys, zipfile
from pathlib import Path
import numpy as np
from transport import STATIONS,GRID,K,physical,fft,checked,roster,keys,read,RADIUS,fit_ridge,weights,ridge_predict

SPEED=(.80,.92,1.,1.08,1.35)
DISP=(.5,1.,2.)
SINGLES=[(s,d) for s in SPEED for d in DISP]
PAIRS=[(f,s,d) for f,s in ((.80,1.35),(.92,1.08),(.80,1.08),(.92,1.35)) for d in DISP]
ARMS=('author_time','author_volume_projection','author_volume_command','one_mode','constant_mix','two_input_ridge','two_mode')
REQUIRED=ARMS[:-1]
TG=np.arange(2048)/8.-32.
DLL=ct.CDLL(str(Path(__file__).resolve().with_name('libtransport.so')))
PTR=np.ctypeslib.ndpointer(dtype=np.float64,flags='C_CONTIGUOUS')
DLL.propagate.argtypes=[ct.c_int,PTR,PTR,PTR,PTR,ct.c_int,PTR,ct.c_double,ct.c_double,ct.c_double,ct.c_double,PTR]
DLL.propagate.restype=ct.c_int
def integral(y,t):return np.trapezoid(y,t,axis=-1)
def contiguous(x):return np.ascontiguousarray(x,dtype=np.float64)
def route(r,c,dist,s,d,dx=.025,margin=2.):
    pos=contiguous(dist);t=r['t'];y=np.zeros((len(t),len(pos)))
    status=DLL.propagate(len(t),t,r['u'],r['re'],contiguous(c),len(pos),pos,s,d,dx,margin,y)
    if status:raise ValueError(('transport domain',status,r['key']))
    return y.T
def loadrun(z,name,key,cell,train):
    cols=(0,2,3,5,7,8)+((9,10,12) if train else ())
    t,u,re,cv,c1,c2,*yy=map(contiguous,read(z,name,cols))
    assert np.all(np.diff(t)>0) and np.all(np.isfinite([t,u,re,cv,c1,c2]))
    s=cv/(np.pi*RADIUS**2);projected=.5*(np.maximum.accumulate(s)+np.minimum.accumulate(s[::-1])[::-1])
    duration,label,inj=cell
    tstart={1:130,2:130,3:205,4:80}[key[0]]
    phase=np.clip((t-tstart)/duration,0.,1.);design=np.stack([1-phase,phase],axis=1)
    ends=np.linalg.lstsq(design,u,rcond=None)[0];assert min(ends)>0
    nominal=design@ends;command=np.r_[0,np.cumsum(.5*(nominal[1:]+nominal[:-1])*np.diff(t))]
    def ctmean(c):
        v=np.maximum(c,0.);m=integral(v,t)
        assert m>0;return integral(v*t,t)/m
    t1,t2=ctmean(c1),ctmean(c2);g=t1+TG
    ds=[np.interp(g,t,v,left=0.,right=0.) for v in (c1,c2)]
    rr=max(1.,np.interp(t2,t,re));dr=(np.interp(t2+10,t,re)-np.interp(t1,t,re))/47000.
    yf=np.stack([np.interp(g,t,y,left=0,right=0) for y in yy]) if train else None
    return dict(t=t,u=u,re=re,c1=c1,c2=c2,yfull=np.array(yy) if train else None,
                yp=yf,y=yf,f1=fft(ds[0]),f2=fft(ds[1]),scale=max(1e-8,np.max(abs(np.array(ds)))),
                feature=np.array([1.,np.clip(np.log(rr/16000.),-2,2),np.clip(dr,-1,1)]),cell=(key[0],)+cell,key=key,
                t1=t1,t2=t2,projected=projected,command=command,ends=ends)
def error(r,p):
    y=r['yfull'];m=integral(abs(y),r['t']);assert min(m)>0
    return integral(abs(p-y),r['t'])/m
def native_ridge(r,coef):
    g=r['t1']+TG
    return np.stack([np.interp(r['t'],g,y,left=0.,right=0.) for y in ridge_predict(r,coef)])
def authors(r):
    t,u,re,c2=r['t'],r['u'],r['re'],r['c2'];ans=[]
    for kind in ('time','projected','command'):
        coord=r['projected' if kind=='time' else kind]
        s0=np.interp(r['t2'],t,coord);positions=[];unique,starts,count=np.unique(coord,return_index=True,return_counts=True)
        cc=np.add.reduceat(c2,starts)/count
        for x in STATIONS:
            d=x-4.89;arrival=np.interp(s0+d,unique,np.add.reduceat(t,starts)/count)
            assert arrival>r['t2']
            ix=(t>=r['t2'])&(t<=arrival);umean=d/(arrival-r['t2'])
            rn=max(3000.,np.mean(np.abs(re[ix])))
            D_over_u=.024*(.41+1.17e9*rn**-2.5)
            if kind=='time':
                dt=np.median(np.diff(t));n=int(np.ceil((t[-1]-t[0])/dt))+1;fine=t[0]+dt*np.arange(n)
                a=np.interp(fine,t,c2,left=0,right=0);ln=1<<(2*n-1).bit_length();k=2*np.pi*np.fft.rfftfreq(ln,dt)
                v=np.fft.irfft(np.fft.rfft(a,ln)*np.exp(-1j*k*d/umean-k*k*D_over_u*d/umean**2),ln)[:n]
                out=np.interp(t,fine,v)
            else:
                g=s0+GRID;ins=np.interp(g,unique,cc,left=0,right=0)
                out=np.interp(coord,g,physical(fft(ins)*np.exp(-1j*K*d-K*K*D_over_u*d)),left=0,right=0)
            positions.append(np.maximum(out,0.))
        ans.append(np.stack(positions))
    return ans
def physics(r,one=None,pair=None,const=None,dx=.025,margin=2.):
    d2=[x-4.89 for x in STATIONS]
    sim=lambda y,d,s,k:route(r,y,d,s,k,dx,margin)
    combos=SINGLES if one is None else sorted(set([one,(pair[0],pair[2]),(pair[1],pair[2]),(const[0],const[2]),(const[1],const[2])]))
    y2={c:sim(r['c2'],d2,*c) for c in combos};h1={}
    mix=[];fixed=[];allpairs=PAIRS if pair is None else [pair]
    for f,s,k in allpairs:
        for vel in (f,s):
            if (vel,k) not in h1:h1[vel,k]=np.maximum(0.,sim(r['c1'],[4.89-2.68],vel,k)[0])
        a=h1[f,k];b=h1[s,k];den=a+b;tiny=1e-7*r['scale']
        fraction=(a+.5*tiny)/(den+tiny)
        # Split the actual observed second boundary. A fixed 1/2 split is an independently optimized, required control.
        via=sim(r['c2']*fraction,d2,f,k)+sim(r['c2']*(1.-fraction),d2,s,k)
        mix.append(np.maximum(0.,via));fixed.append(np.maximum(0.,.5*(y2[f,k]+y2[s,k])))
    if one is None:return [np.maximum(0.,y2[c]) for c in combos],fixed,mix
    return np.maximum(0.,y2[one]),np.maximum(0.,.5*(y2[const[0],const[2]]+y2[const[1],const[2]])),mix[0]
def fit(train,root):
    w=weights(train);ss=np.zeros(len(SINGLES));cc=np.zeros(len(PAIRS));pp=cc.copy()
    shards={k:json.loads((Path(root)/f'train-{k}.json').read_text()) for k in (1,2,4)}
    assert all(len(shards[k])==sum(r['key'][0]==k for r in train) for k in shards)
    for r,wt in zip(train,w):
        g,i=r['key'];record=shards[g][str(i)]
        assert tuple(record['cell'])==r['cell'] and record['calibration_sha']==hashlib.sha256(r['yfull'].tobytes()).hexdigest()
        for vals,acc in zip(record['losses'],(ss,cc,pp)):
            values=np.asarray(vals);assert values.shape==acc.shape and np.isfinite(values).all()
            acc+=wt*values
    opts=(.001,.01,.1,1.);cv=[]
    for lam in opts:
        scores=[]
        for group in (1,2,4):
            tr=[r for r in train if r['key'][0]!=group];va=[r for r in train if r['key'][0]==group];coef=fit_ridge(tr,lam)
            scores.append(sum(v*np.mean(error(r,native_ridge(r,coef))) for r,v in zip(va,weights(va))))
        cv.append(float(np.mean(scores)))
    lam=opts[np.argmin(cv)]
    return {'one':SINGLES[np.argmin(ss)],'const':PAIRS[np.argmin(cc)],'pair':PAIRS[np.argmin(pp)],'ridge':lam,'one_losses':ss.tolist(),'constant_losses':cc.tolist(),'two_mode_losses':pp.tolist(),'ridge_cv':cv},fit_ridge(train,lam)
def forecast(root,bankpath,infopath):
    idx=roster(checked(root,'index.xlsx'));train=[];test=[]
    with zipfile.ZipFile(checked(root,'unsteady.zip')) as z:
        for key,name in sorted(keys(z,idx).items()):
            tr=key[0]!=3;r=loadrun(z,name,key,idx[key],tr);(train if tr else test).append(r)
    assert len(train)==215 and len(test)==50
    par,coef=fit(train,root);runs={};bank={};convergence=[]
    for r in test:
        p=par
        a=physics(r,p['one'],p['pair'],p['const'],.025,2.)
        fine=physics(r,p['one'],p['pair'],p['const'],.0125,4.)
        for i in (0,1,2):
            for j in range(3):
                den=integral(abs(fine[i][j]),r['t']);assert den>0
                convergence.append(float(integral(abs(fine[i][j]-a[i][j]),r['t'])/den))
        y=np.stack([*authors(r),fine[0],fine[1],native_ridge(r,coef),fine[2]])
        assert np.isfinite(y).all()
        bank['run'+str(r['key'][1])]=y
        runs[str(r['key'][1])]=dict(cell=r['cell'],n=len(r['t']),hydraulic_sha=hashlib.sha256(r['u'].tobytes()+r['t'].tobytes()).hexdigest())
    assert np.median(convergence)<=.10 and max(convergence)<=.30,('grid-margin sensitivity',np.median(convergence),max(convergence))
    np.savez_compressed(bankpath,**bank)
    obs=dict(parameters=par,runs=runs,arms=ARMS,stations=STATIONS,convergence={'median':float(np.median(convergence)),'max':max(convergence)})
    Path(infopath).write_text(json.dumps(obs,sort_keys=True,allow_nan=False)+'\n')
    print('LOCK',len(runs),len(convergence),'grid',obs['convergence'],'selected',par['one'],par['const'],par['pair'],par['ridge'])
if __name__=='__main__':forecast(*sys.argv[1:4])
