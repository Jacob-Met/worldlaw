"""Read authenticated retrospective forcing and isolate the declared geodetic response subset."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import numpy as np
from source_clocks import download
RAD_TO_MAS=180*3600*1000/np.pi
ROOT=Path(__file__).resolve().parent

def files():
    p=json.loads((ROOT/"file_pins.json").read_text())
    assert len(p)==89 and len({(x[0],x[1]) for x in p})==89
    return {(x[0],x[1]):x for x in p}

def verified(row):
    _,_,url,sz,sha,*_=row
    blob=download(url,sz)
    assert len(blob)==sz and hashlib.sha256(blob).hexdigest()==sha
    return blob

def positions(mode):
    """Hash whole fixed C04 text. Convert x,y only after admitting its date under mode."""
    blob=verified(files()["C04",0]);d={}
    for line in blob.splitlines():
        q=line.split(maxsplit=5)
        if len(q)<6 or not q[0].isdigit() or len(q[0])!=4:continue
        y,m,day,hr=map(int,q[:4])
        is_source=2003<=y<=2014
        is_target=2015<=y<=2024
        first_day=m==day==1
        permitted=(mode=="forecast" and (is_source or (is_target and first_day))) or (mode=="score" and is_target and not first_day)
        if not permitted:continue
        assert hr==0
        vals=q[5].split(maxsplit=2)
        d[date(y,m,day)]=np.array([1000*float(vals[0]),-1000*float(vals[1])])
    expect=sum((date(y+1,1,1)-date(y,1,1)).days for y in range(2003,2015))+10 if mode=="forecast" else sum((date(y+1,1,1)-date(y,1,1)).days-1 for y in range(2015,2025))
    assert len(d)==expect
    return d

def block(d,y):
    return np.stack([d[date(y,1,1)+timedelta(days=i)] for i in range(1,(date(y+1,1,1)-date(y,1,1)).days)])

def forcing(row):
    k,y=row[:2]
    cols=8 if k=="SLAM" else 11
    rr=[]
    for line in verified(row).splitlines():
        q=line.split()
        if not q or not q[0].isdigit() or len(q[0])!=4:continue
        assert len(q)==cols
        vals=np.array([float(v) for v in q[5:]])
        rr.append(vals[:2]+(vals[3:5] if cols==11 else np.zeros(2)))
    a=np.array(rr)
    daily=np.mean(a.reshape(-1,8,2),axis=1) if k in ("AAM","OAM") else a
    assert daily.shape==((date(y+1,1,1)-date(y,1,1)).days,2) and np.isfinite(daily).all()
    print("FORCING_OK",k,y,len(daily),flush=True)
    return (k,y),daily*RAD_TO_MAS

def build():
    p=files();d=positions("forecast")
    print("SOURCE_PLUS_BOUNDARY",len(d),flush=True)
    with ThreadPoolExecutor(4) as pool:
        ff=dict(pool.map(forcing,[v for (k,y),v in p.items() if k!="C04"]))
    u={y:(d[date(y,1,1)],sum(ff[k,y] for k in ("AAM","OAM","HAM","SLAM"))[:-1]) for y in range(2003,2025)}
    return u,{y:block(d,y) for y in range(2003,2015)}
