"""Read the official archive using its sample identifiers and institution/site split."""
import csv
import hashlib
import io
import math
import pathlib
import shutil
import subprocess
import numpy as np
from scipy.optimize import least_squares

def loc(r):
    try: return tuple(map(float, [r['Lat'],r['Lon']]))
    except ValueError: return None
def distance(r,s):
    la,lo=map(math.radians,loc(r))
    lb,lp=map(math.radians,loc(s))
    return 12742.0176*math.asin(min(1,math.hypot(math.sin((la-lb)/2),math.sqrt(math.cos(la)*math.cos(lb))*math.sin((lo-lp)/2))))

def assignments(metadata):
    eligible=[r for r in metadata if r['KSAT']=='TRUE' and loc(r)]
    dev=[r for r in eligible if r['Sample_ID'].startswith('TUBS_')]
    train=[r for r in eligible if r['Sample_ID'].startswith('KIT_') and min(distance(r,q) for q in dev)>=10.]
    assert len(train)==163 and len(dev)==161
    return train,dev

def member(archive,name,tmp):
    name='DataFiles_v2/'+name
    exe=shutil.which('7zz') or shutil.which('7z')
    if exe:return subprocess.check_output([exe,'x','-so',str(archive),name])
    import py7zr
    with py7zr.SevenZipFile(archive) as z:z.extract(path=tmp,targets=[name])
    return (tmp/name).read_bytes()

def load_cases(archive,tmp,roster,mode):
    assert mode in ('training','forecast','score')
    records={r['Sample_ID']:{'id':r['Sample_ID'],'site':list(loc(r)),'ret':[],'ks':[],'pF':[],'K_HyProp':[]} for r in roster}
    allowed={sid.encode() for sid in records}
    for n in (('CondMeas.csv',) if mode=='score' else ('RetMeas.csv','CondMeas.csv')):
        lines=member(archive,n,tmp).splitlines()
        header=lines[0].decode('utf-8-sig')
        sep=csv.Sniffer().sniff(header,delimiters=';,\t').delimiter.encode()
        assert header.replace('"','').split(sep.decode())==(['Sample_ID','MeasType','pF','theta'] if n=='RetMeas.csv' else ['Sample_ID','MeasType','pF','k'])
        for line in lines[1:]:
            sid,_,rest=line.partition(sep);sid=sid.strip(b'" ')
            if sid not in allowed:continue
            kind,_,rest=rest.partition(sep);kind=kind.strip(b'" ');r=records[sid.decode()]
            if n=='RetMeas.csv' and kind in (b'HyProp',b'AirEntry',b'WP4'):
                p,_,t=rest.partition(sep);r['ret'].append([kind.decode(),float(p.strip(b'" ')),float(t.strip(b'" '))])
            elif n=='CondMeas.csv' and kind==b'KSAT' and mode!='score':
                r['ks'].append(float(rest.partition(sep)[2].strip(b'" ')))
            elif n=='CondMeas.csv' and kind==b'HyProp':
                p,_,k=rest.partition(sep);r['pF'].append(float(p.strip(b'" ')))
                if mode!='forecast':r['K_HyProp'].append(float(k.strip(b'" ')))
    ordered=[records[k] for k in sorted(records)]
    for r in ordered:
        if mode=='score':continue
        assert len(r['ks'])==1 and r['ks'][0]>0 and r['pF'],r['id']
        r['ksat']=r.pop('ks')[0]
        if mode=='forecast':del r['K_HyProp']
        x=fit(r['ret']);r['stock_log10K']=(math.log10(r['ksat'])+rel(x,np.array(r['pF']))).tolist()
    return ordered

def sigmoid_args(x,p):
    th_r,th_s,loga,n=x
    m=1-1/n
    v=n*(math.log(10)*p+loga)
    return -m*np.logaddexp(0,v),m,v
def wr(x,p):
    se,m,v=sigmoid_args(x,p)
    return x[0]+(x[1]-x[0])*np.exp(se)
def rel(x,p):
    se,m,v=sigmoid_args(x,p)
    # (alpha*h)^n / [1+(alpha*h)^n] = exp(-softplus(-v))
    z=m*np.logaddexp(0,-v)
    return (.5*se+2*np.log(-np.expm1(-z)))/math.log(10)
def fit(points):
    arr=np.asarray([[p,t] for k,p,t in points],dtype=float)
    if len(arr)<4 or not np.isfinite(arr).all():raise ValueError('insufficient/undefined retention')
    p,t=arr.T
    groups=np.floor(4*p)
    weights=np.array([1/math.sqrt((groups==g).sum()) for g in groups])
    weights*=np.array([math.sqrt(10) if k=='WP4' else 1 for k,_,_ in points])
    best=None
    for n0 in (1.2,1.8,3.0):
        x0=[max(0,min(.1,.5*t.min())),float(np.clip(t.max(),.2,.9)),-3,n0]
        opt=least_squares(lambda x:(wr(x,p)-t)*weights,x0,bounds=([0,.1,-12,1.01],[.49,.99,3,8]),max_nfev=300)
        if opt.success and opt.x[0]<opt.x[1] and (best is None or opt.cost<best.cost):best=opt
    if best is None: raise ValueError('fit failed')
    return best.x
