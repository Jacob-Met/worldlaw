"""Conditional dimensionless held-camera shape forecasts."""
import csv, io, json, math, struct, sys, zipfile, hashlib
from collections import Counter, defaultdict
from pathlib import Path
from urllib.request import Request,urlopen
URL='https://zenodo.org/records/18896271/files/Data_Corrected.zip?download=1'
PROTOCOL=Path(__file__).with_name('normalized-protocol.json')
NAMES=['common_support','ellipse','chord','horizontal_sham','constant','condition','affine','multifeature']
def digest(b):return hashlib.sha256(b).hexdigest()
def canon(o):return json.dumps(o,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def data(p):
    with urlopen(Request(URL,headers={'User-Agent':'Rible paired-camera scientific original'}),timeout=90) as f:b=f.read(p['archive']['bytes']+1)
    assert len(b)==p['archive']['bytes'] and digest(b)==p['archive']['sha256']
    return zipfile.ZipFile(io.BytesIO(b))
def group(s):return tuple(s.split('_')[2:4])
def shape(v):
    v=sorted(v);n=len(v);median=v[(n-1)//2]
    return [math.log(v[(k*n+19)//20-1]/median) for k in range(1,20)]
def rows(z,cam,s):
    with z.open('Data_Corrected/Camera%d/TimeData/%s.csv'%(cam,s)) as f:
        yield from csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig'))
def describe(z,cam,s):
    box=[];chord=[];width=[];ellipse=[];prev=None;repeat=0
    for i,r in enumerate(rows(z,cam,s),1):
        assert int(r['frame_no'])==i
        stamp=tuple(r[k] for k in r if k!='frame_no');repeat+=int(stamp==prev);prev=stamp
        h=float(r['bbox_heigth']);assert math.isfinite(h) and h>0;box.append(h)
        if cam==1:
            a,b,t,c,w=[float(r[k]) for k in ('majorAxis','minorAxis','cantingAngle','verticalAxis','bbox_width')]
            assert all(map(math.isfinite,[a,b,t,c,w])) and min(a,b,c,w)>0
            theta=math.radians(t);ellipse.append(math.hypot(a*math.sin(theta),b*math.cos(theta)))
            chord.append(c);width.append(w)
    assert box
    o={'n':len(box),'repeat':repeat,'counts':sorted(Counter(box).items()),'box':shape(box)}
    if cam==1:o['features']=[o['box'],shape(ellipse),shape(chord),shape(width)]
    return o
def condition(train,name,exclude=None):
    ids=[s for s in train if group(s)==group(name) and s!=exclude]
    if not ids:ids=[s for s in train if s!=exclude]
    return [sum(train[s][j] for s in ids)/len(ids) for j in range(19)]
def vect(src,con,j):return [q[j] for q in src['features']]+[con[j]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def rms(a,b):return math.sqrt(sum((x-y)**2 for x,y in zip(a,b))/len(a))
def solve(train,src,lam):
    g=[[0.]*5 for _ in range(5)];cross=[0.]*5
    for s,y in train.items():
        con=condition(train,s,exclude=s)
        for j,v in enumerate(y):
            x=vect(src[s],con,j)
            for i in range(5):
                cross[i]+=x[i]*v
                for k in range(5):g[i][k]+=x[i]*x[k]
    for k in range(5):g[k][k]+=len(train)*19*lam
    a=[row+[v] for row,v in zip(g,cross)]
    for j in range(5):
        piv=max(range(j,5),key=lambda i:abs(a[i][j]));a[j],a[piv]=a[piv],a[j]
        d=a[j][j];assert abs(d)>1e-14;a[j]=[v/d for v in a[j]]
        for i in range(5):
            if i!=j:
                e=a[i][j];a[i]=[u-e*v for u,v in zip(a[i],a[j])]
    return [r[-1] for r in a]
def multi(src,con,co):return [dot(vect(src,con,j),co) for j in range(19)]
def fit(z,p):
    dev,held=p['dev'],p['held']
    assert len(dev)==48 and len(held)==24 and not set(dev)&set(held)
    src={s:describe(z,1,s) for s in dev+held};devobs={s:describe(z,2,s) for s in dev}
    train={s:v['box'] for s,v in devobs.items()};groups=defaultdict(list)
    for s in dev:groups[group(s)].append(s)
    assert len(groups)==24 and all(len(v)==2 for v in groups.values())
    cv={}
    for lam in (1e-6,1e-4,.01,1.):
        errors=[]
        for q in (0,1):
            cal={sorted(ss)[q]:train[sorted(ss)[q]] for ss in groups.values()}
            co=solve(cal,src,lam)
            errors.extend(rms(y,multi(src[s],condition(cal,s),co)) for s,y in train.items() if s not in cal)
        cv[lam]=sum(errors)/len(errors)
    lam=min(cv,key=cv.get);co=solve(train,src,lam)
    beta=sum(dot(src[s]['box'],train[s]) for s in train)/sum(dot(src[s]['box'],src[s]['box']) for s in train)
    pred={};sha={}
    for s in held:
        con=condition(train,s);d=src[s]
        arr=d['features']+[[0.]*19,con,[beta*x for x in d['box']],multi(d,con,co)]
        assert len(arr)==8 and all(len(v)==19 and v[9]==0. for v in arr)
        pred[s]=dict(zip(NAMES,arr));sha[s]={r:digest(struct.pack('<19d',*v)) for r,v in pred[s].items()}
    return {'protocol_sha256':digest(PROTOCOL.read_bytes()),'archive_sha256':p['archive']['sha256'],
            'held_source':{s:{k:src[s][k] for k in ('n','repeat','counts')} for s in held},
            'development_counts':{s:[src[s]['n'],devobs[s]['n'],src[s]['repeat'],devobs[s]['repeat']] for s in dev},
            'ridge_cv':cv,'ridge_lambda':lam,'ridge_coefficients':co,'affine_beta':beta,'forecasts':pred,'float64_sha256':sha}
if __name__=='__main__':
    p=json.loads(PROTOCOL.read_bytes());lock=fit(data(p),p);out=canon(lock);Path(sys.argv[1]).write_bytes(out)
    print('FORECAST_LOCK',len(out),digest(out),len(lock['forecasts']),sum(len(v) for v in lock['forecasts'].values()),flush=True)
