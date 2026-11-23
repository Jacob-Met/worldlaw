"""Forecast published concentration profiles on a cumulative-volume coordinate."""
import csv, io, re, sys, json, hashlib, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np

STATIONS=(7.08,8.92,13.06)
GRID=np.arange(2048)/16.-32.
# Zero padding around the finite concentration profile prevents circular wrap on its measured support.
PAD=512
NFFT=4096
K=2*np.pi*np.fft.rfftfreq(NFFT,1/16.)
RADIUS=.012
REQUIRED=('Hart_from_268','Hart_from_489','Hart_blend','fitted_Gaussian','two_input_ridge')
CANDIDATE='two_mode'
ARMS=REQUIRED+(CANDIDATE,'single_fast')
assertions={'unsteady.zip':'e16a71d2c8b867f71508f6a929849da9c417eba913db5129ed7ebeb4c776434c','index.xlsx':'2d9e4e2ee78deed8a5c32ba0f9e07fe0889ee31780b04c850c759829d3a81861'}

def checked(root,name):
    p=Path(root)/name
    assert hashlib.sha256(p.read_bytes()).hexdigest()==assertions[name]
    return p

def roster(path):
    with zipfile.ZipFile(path) as z:
        ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        strings=[''.join(t.text or '' for t in a.findall('.//m:t',ns)) for a in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        out={}
        for row in ET.fromstring(z.read('xl/worksheets/sheet2.xml')).findall('.//m:row',ns)[1:]:
            rr={}
            for c in row.findall('m:c',ns):
                k=re.match(r'[A-Z]+',c.attrib['r'])[0];v=c.findtext('m:v',None,ns)
                if v is not None:rr[k]=strings[int(v)] if c.attrib.get('t')=='s' else v
            key=(int(re.fullmatch(r'(?:Test)?(\d+)',rr['A'])[1]),int(re.fullmatch(r'(?:R)?(\d+)',rr['B'])[1]))
            assert key not in out;out[key]=(int(rr['C']),rr['J'],int(rr['K']))
    assert len(out)==265
    return out

def read(z,name,cols):
    with z.open(name) as f:
        line=f.readline().decode('utf-8-sig').strip().split(',')
        assert len(line)==13 and '2.68 m' in line[7] and '4.89 m' in line[8]
        assert all(str(v)+' m' in line[j] for j,v in [(9,7.08),(10,8.92),(12,13.06)])
        return np.loadtxt(f,delimiter=',',usecols=cols,ndmin=2).T

def keys(z,index):
    result={}
    for name in z.namelist():
        if not name.endswith('.csv'):continue
        m=re.search(r'Test(\d+)_R(\d+)\.csv$',name);key=tuple(map(int,m.groups()))
        assert key not in result;result[key]=name
    assert set(result)==set(index)
    return result

def integrate(y,s):
    return np.trapezoid(y,s,axis=-1)

def fft(y):
    a=np.zeros(NFFT);a[PAD:PAD+len(GRID)]=y
    return np.fft.rfft(a)

def physical(z):
    return np.maximum(0.,np.fft.irfft(z,n=NFFT)[...,PAD:PAD+len(GRID)])

def sample(z,name,key,cond,train):
    cols=(0,1,2,3,5,7,8)+( (9,10,12) if train else () )
    t,q,u,re_,cum,c1,c2,*targets=read(z,name,cols)
    assert np.isfinite([t,q,u,re_,cum,c1,c2]).all() and np.all(np.diff(t)>0)
    s=cum/(np.pi*RADIUS**2)
    assert np.all(np.diff(s)>=0) and np.min(re_)>0 and s[-1]>s[0]
    def center(c):
        pos=np.maximum(c,0)
        if integrate(pos,s)<=0:raise ValueError(('empty upstream concentration',key))
        return integrate(s*pos,s)/integrate(pos,s)
    o=center(c1);b=center(c2)
    g=o+GRID
    dy=[np.interp(g,s,c,left=0,right=0) for c in (c1,c2)]
    y=np.array([np.interp(g,s,v,left=0,right=0) for v in targets]) if train else None
    def mean_re(a,b):
        v=s[(s>a)&(s<b)];coords=np.r_[a,v,b]
        return integrate(np.interp(coords,s,re_),coords)/(b-a)
    reaches=(4.89-2.68,)+tuple(v-4.89 for v in STATIONS)
    rh=np.array([mean_re(o,o+reaches[0])]+[mean_re(b,b+d) for d in reaches[1:]])
    ra=np.array([mean_re(o,o+v-2.68) for v in STATIONS])
    feat=np.array([1.,np.clip(np.log(mean_re(o,b+8.17)/16000.),-2.,2.),
                   np.clip((np.interp(b+8.17,s,re_)-np.interp(o,s,re_))/47000.,-1.,1.)])
    # Input relative concentration scale only; no target norm in any predictor.
    scale=max(np.max(np.abs(dy)),1e-8)
    return dict(key=key,cell=(key[0],)+cond,o=o,f1=fft(dy[0]),f2=fft(dy[1]),y=y,
                r=rh,ra=ra,feature=feat,scale=scale,uptime=(t[0],t[-1]),spatial=(s[0],s[-1]))

def transfer(re_,d,slowness,disp):
    diffusivity=(1.17e9*re_**(-2.5)+.41)*.024
    return np.exp(-1j*K*d*slowness - K*K*diffusivity*d*disp)

def routed(r,slowness=1.,disp=1.,donor=2):
    if donor==2:
        return np.stack([physical(r['f2']*transfer(re_,x-4.89,slowness,disp)) for x,re_ in zip(STATIONS,r['r'][1:])])
    return np.stack([physical(r['f1']*transfer(re_,x-2.68,slowness,disp)) for x,re_ in zip(STATIONS,r['ra'])])

def modes(r,params):
    fast,slow,disp,lam=params;re_=r['r'][0]
    d=4.89-2.68
    f=transfer(re_,d,fast,disp);s=transfer(re_,d,slow,disp)
    sep=s-f
    s2=s*(r['f2']-f*r['f1'])*sep.conj()/(abs(sep)**2+lam)
    out=[];single=[]
    for x,re_ in zip(STATIONS,r['r'][1:]):
        h=transfer(re_,x-4.89,fast,disp);j=transfer(re_,x-4.89,slow,disp)
        out.append(physical(h*r['f2']+(j-h)*s2));single.append(physical(h*r['f2']))
    return np.stack(out),np.stack(single)

def gridloss(y,p):
    den=np.sum(abs(y),axis=-1)
    if np.any(den<=0):raise ValueError('no calibration target mass on fixed grid')
    return np.mean(np.sum(abs(y-p),axis=-1)/den)

def weights(train):
    from collections import Counter
    counts=Counter(r['cell'] for r in train)
    return np.array([1/(len(counts)*counts[r['cell']]) for r in train])

def gridpick(train,options,func):
    ww=weights(train);loss=[]
    for cfg in options:
        loss.append(sum(w*gridloss(r['y'],func(r,cfg)) for r,w in zip(train,ww)))
    return options[int(np.argmin(loss))],list(map(float,loss))

def design(r):
    a=np.stack([r['f1'],r['f2']],axis=-1)/r['scale']
    return (a[:,:,None]*r['feature'][None,None,:]).reshape(len(K),6)

def fit_ridge(train,lam):
    n=6
    cov=np.zeros((len(K),n,n),complex);cross=np.zeros((len(K),n,3),complex)
    for r,w in zip(train,weights(train)):
        xx=design(r);yy=np.stack([fft(y)/r['scale'] for y in r['y']],axis=-1)
        cov+=w*xx.conj()[:,:,None]*xx[:,None,:];cross+=w*xx.conj()[:,:,None]*yy[:,None,:]
    v=cov.diagonal(axis1=1,axis2=2).real.mean(axis=1)
    cov+=np.eye(n)[None,:,:]*(lam*(v+1e-5))[:,None,None]
    return np.linalg.solve(cov,cross)

def ridge_predict(r,coef):
    return physical(np.einsum('kn,kns->sk',design(r),coef)*r['scale'])

def fit(train):
    blend,lb=gridpick(train,[i/10 for i in range(11)],lambda r,x:x*routed(r,donor=1)+(1-x)*routed(r))
    gau,lg=gridpick(train,[(v,d) for v in (.9,1.,1.1) for d in (.25,.5,1.,2.,4.)],lambda r,c:routed(r,*c))
    pairs=[(a,b,d,l) for a in (.80,.92,.98) for b in (1.03,1.15,1.35) for d in (.25,1.,2.) for l in (.001,.03,.15)]
    mix,lm=gridpick(train,pairs,lambda r,c:modes(r,c)[0])
    opts=(.001,.01,.1,1.);cv=[]
    for lam in opts:
        folds=[]
        for prog in (1,2,4):
            fitset=[r for r in train if r['key'][0]!=prog];vset=[r for r in train if r['key'][0]==prog]
            coef=fit_ridge(fitset,lam)
            folds.append(sum(w*gridloss(r['y'],ridge_predict(r,coef)) for r,w in zip(vset,weights(vset))))
        cv.append(float(np.mean(folds)))
    lam=opts[int(np.argmin(cv))]
    return dict(blend=blend,gaussian=gau,two_mode=mix,ridge=lam,train_criterion=[min(lb),min(lg),min(lm)],ridge_folds_mean=cv),fit_ridge(train,lam)

def predict(r,p,coef):
    f1=routed(r,donor=1);f2=routed(r);mode,single=modes(r,p['two_mode'])
    return np.stack([f1,f2,p['blend']*f1+(1-p['blend'])*f2,routed(r,*p['gaussian']),ridge_predict(r,coef),mode,single])

def forecast(root,archive,metadata):
    idx=roster(checked(root,'index.xlsx'));train=[];pending=[]
    with zipfile.ZipFile(checked(root,'unsteady.zip')) as z:
        for key,name in sorted(keys(z,idx).items()):
            calibration=key[0]!=3
            r=sample(z,name,key,idx[key],calibration)
            (train if calibration else pending).append(r)
    assert len(train)==215 and len(pending)==50
    p,coef=fit(train)
    bank={};info={}
    for r in pending:
        k=str(r['key'][1]);result=predict(r,p,coef);assert np.isfinite(result).all()
        bank['run'+k]=result;info[k]=dict(center=r['o'],cell=r['cell'],time_span=r['uptime'],volume_distance=r['spatial'])
    np.savez_compressed(archive,**bank)
    Path(metadata).write_text(json.dumps(dict(parameters=p,arms=ARMS,stations=STATIONS,runs=info),sort_keys=True,allow_nan=False)+'\n')
    print('FIT',p,'TRAIN',len(train),'HELD INPUT ONLY',len(pending),'bank',len(bank))

if __name__=='__main__':forecast(*sys.argv[1:4])
