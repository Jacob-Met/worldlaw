"""Paired KIT quartz source-domain forward maps. No optimizer uses an HT2 trace."""
import hashlib, io, json, math, pathlib, tarfile, urllib.request, zipfile
import numpy as np
from scipy.optimize import least_squares
from scipy.signal import lfilter
from scipy.special import erfc

GRID=np.arange(801,dtype=float)*10
ROOT=pathlib.Path(__file__).resolve().parent
def read_json(n):return json.loads((ROOT/n).read_bytes())
def sha(b):return hashlib.sha256(b).hexdigest()
def archive():
    p=read_json('protocol.json')['source_archive']
    q=urllib.request.Request('https://www.radar-service.eu/radar/api/datasets/UTBafcXGwtpmQxvG/download',headers={'User-Agent':'public-KIT-quartz-shape-study/1.0'})
    with urllib.request.urlopen(q,timeout=120) as f:b=f.read(p['size']+1)
    assert len(b)==p['size'] and sha(b)==p['sha256']
    return tarfile.open(fileobj=io.BytesIO(b),mode='r:*')
def measurements():
    # RADAR supplies BagIt TAR containing one dataset ZIP plus metadata and manifests.
    with archive() as outer:
        b=outer.extractfile('10.35097-1215/data/dataset/Quartz_thermaldiffusivity_low_high_T.zip').read()
    assert len(b)==40309964 and sha(b)=='3a7c6a447cad4d7eea0f28934c90dd682e12ba1cb60708bba782ff5c9d5a5eb2'
    return zipfile.ZipFile(io.BytesIO(b))
def filedata(a,path):
    assert a.namelist().count(path)==1
    return a.read(path)
def split(b):
    if b.startswith((b'\xff\xfe',b'\xfe\xff')): b=b.decode('utf-16').encode('latin1','replace')
    l=b.splitlines();k={}
    for i,v in enumerate(l):
        x,_,y=v.partition(b';'); key=x.strip().lstrip(b'#').strip().lower()
        if key.replace(b' ',b'')==b'time/ms' and y.strip():return k,l[i+1:]
        if key in {b'laser_voltage/v',b'laser_filter/mm',b'sensor'}:k[key]=y.strip()
    raise ValueError('time header missing')
def trace(lines):
    t=[];y=[]
    for line in lines:
        if not line.strip():continue
        a,b,*_=line.split(b';')
        t.append(float(a.replace(b',',b'.')));y.append(float(b.replace(b',',b'.')))
    t=np.array(t);y=np.array(y)
    assert len(t)>2 and np.all(np.diff(t)>0) and np.isfinite(t).all() and np.isfinite(y).all()
    return t,y
def normal(x):
    x=np.asarray(x,dtype=float);scale=float(np.sqrt(np.mean(x*x)))
    assert scale>1e-12 and np.isfinite(x).all()
    return x/scale
def waveform(a,row,kind):
    path=row['path'];assert '/'+kind+'_' in path
    b=filedata(a,path);assert sha(b)==row['sha256']
    t,y=trace(split(b)[1])
    assert len(t)==row['samples'] and t[0]<=-300 and t[-1]>=8000 and abs(t[0]-row['start_ms'])<1e-8 and abs(t[-1]-row['end_ms'])<1e-8
    base=np.median(y[(t>=-300)&(t<=-10)]); raw=np.interp(GRID,t,y)
    return normal(raw-base),raw,float(base)
def pulse(a):
    rows=[]
    for m in a.namelist():
        if '/Laserpulse/' not in m or not m.endswith('.csv'):continue
        b=a.read(m);h,lines=split(b)
        if (h.get(b'laser_voltage/v'),h.get(b'laser_filter/mm'),h.get(b'sensor'))==(b'1538,0',b'100,0',b'InSb'):
            t,y=trace(lines);rows.append((t,y,m,sha(b)))
    assert len(rows)==1 and rows[0][3]=='f3cd94a332d9dc40ae93ed3126b0e24a20a717b2f2cb497d09e365504d150586'
    t,y,path,h=rows[0];assert t.min()>=0 and t.max()<1
    w=np.maximum(y,0)*np.gradient(t)
    assert w.sum()>0
    mask=np.minimum(15,np.floor(t/t.max()*16).astype(int))
    weights=np.bincount(mask,weights=w,minlength=16)
    times=np.divide(np.bincount(mask,weights=w*t,minlength=16),weights,out=np.zeros(16),where=weights>0)
    return times,weights/weights.sum(),{'path':path,'sha256':h,'duration_ms':float(t.max()),'samples':len(t),'weighted_mean_ms':float(np.sum(w*t)/np.sum(w))}
def parker(u):
    out=np.zeros_like(u);small=(u>0)&(u<.1);large=u>=.1
    v=u[small];out[small]=2/np.sqrt(np.pi*v)*sum(np.exp(-(n+.5)**2/v) for n in range(4))
    v=u[large];out[large]=1+2*sum((-1)**n*np.exp(-np.pi**2*n*n*v) for n in range(1,13))
    return out
def ideal(alpha,length,pt,pw):
    u=alpha*(GRID[:,None]-pt[None,:])/length**2
    return np.sum(parker(u)*pw,axis=1)
def loss(signal,h):
    z=np.exp(-10*h); weight=-np.expm1(-10*h)/(10*h) if h else 1
    return lfilter([weight],[1,-z],np.diff(signal,prepend=0))
def undoloss(signal,h):
    z=np.exp(-10*h);weight=-np.expm1(-10*h)/(10*h) if h else 1
    return np.cumsum((signal-z*np.r_[0,signal[:-1]])/weight)
def fit(signal,length,pt,pw,free):
    def residual(x):
        h=x[1]/1000 if free else 0.
        return normal(loss(ideal(math.exp(x[0]),length,pt,pw),h))-signal
    best=None
    for alpha0 in (.001,.006,.03):
        x=np.array([math.log(alpha0),.06] if free else [math.log(alpha0)])
        lo=[math.log(.0001),0] if free else [math.log(.0001)]
        hi=[math.log(.1),2] if free else [math.log(.1)]
        z=least_squares(residual,x,bounds=(lo,hi),max_nfev=200,ftol=1e-10,xtol=1e-10,gtol=1e-10)
        assert z.success
        c=(float(np.dot(z.fun,z.fun)),math.exp(z.x[0]),z.x[1]/1000 if free else 0.)
        if best is None or c<best:best=c
    return best
def kernel(alpha,a,b):
    assert b>a>0 and alpha>0
    # First-passage CDF from the image expansion. Bin centers use integrated CDF at half-grid boundaries.
    t=GRID+5
    r=np.zeros_like(t)
    for n in range(800):
        lo=(b-a+2*b*n)/np.sqrt(4*alpha*t)
        hi=(b+a+2*b*n)/np.sqrt(4*alpha*t)
        term=(b/a)*(erfc(lo)-erfc(hi));r+=term
        if lo[-1]>12:break
    assert lo[-1]>12 and r.min()>-1e-12 and r.max()<1+1e-12 and np.all(np.diff(r)>-1e-12)
    return np.diff(r,prepend=0)
def convolve(x,k):
    return np.convolve(x,k)[:len(x)]
def predict(source,a,b,pt,pw):
    _,alpha,h=fit(source,a,pt,pw,True);_,alpha0,_=fit(source,a,pt,pw,False)
    r=b/a;k=kernel(alpha,a,b);sl=undoloss(source,h)
    warp=lambda x,p:np.interp(GRID/r**p,GRID,x)
    roles=[convolve(source,k),source,warp(source,1),warp(source,2),ideal(alpha0,b,pt,pw),loss(ideal(alpha,b,pt,pw),h),loss(ideal(alpha,b,pt,pw),h/r),loss(warp(sl,2),h/r),loss(convolve(sl,k),h/r)]
    return np.stack(list(map(normal,roles))),{'alpha_mm2_ms':alpha,'h_per_ms':h,'zero_loss_alpha_mm2_ms':alpha0,'ratio':r,'kernel_mass_8000ms':float(k.sum())}
