"""Scalar replay of all forcing-to-pole trajectories from the frozen source fit and public files."""
import array
import ast
import base64
import cmath
from concurrent.futures import ThreadPoolExecutor
from datetime import date,timedelta
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import sys
import urllib.request
import zipfile
import zlib
ROOT=Path(__file__).resolve().parent
read=lambda n:json.loads((ROOT/n).read_text())
def obtain(spec):
    label,year,url,size,sha,*_=spec
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Independent public angular momentum receiver"}),timeout=60) as response:
        b=response.read(size+1)
    assert len(b)==size and hashlib.sha256(b).hexdigest()==sha
    if label=="C04":
        points={}; retained=[]
        for line in b.splitlines():
            q=line.split()
            if len(q)!=21 or not q[0].isdigit():continue
            y,m,d,h=map(int,q[:4])
            if 2003<=y<=2024:
                points[date(y,m,d)]=1000*complex(float(q[5]),-float(q[6]))
                if y>=2015 and (m,d)!=(1,1):retained.append(b" ".join(q[:7]))
        return (label,year),(points,b"\n".join(retained)+b"\n")
    grouped={}
    for line in b.splitlines():
        q=line.split()
        if len(q) not in (8,11) or not q[0].isdigit():continue
        y,m,d,h=map(int,q[:4]);key=date(y,m,d)
        assert y==year
        mass=complex(float(q[5]),float(q[6]));motion=0j
        if len(q)==11:motion=complex(float(q[8]),float(q[9]))
        grouped.setdefault(key,[]).append(mass+motion)
    factor=180*3600*1000/math.pi
    return (label,year),{day:complex(math.fsum(v.real for v in seq),math.fsum(v.imag for v in seq))*factor/len(seq) for day,seq in grouped.items()}
def archive():
    raw=base64.b64decode((ROOT/"forecast_bytes.txt").read_bytes(),validate=False)
    spec=read("prediction_lock.json"); assert len(raw)==spec["bytes"] and hashlib.sha256(raw).hexdigest()==spec["sha256"]
    found={}
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert len(z.namelist())==10
        for name in z.namelist():
            y=int(name[4:8]);b=z.read(name)
            assert b[:8]==b"\x93NUMPY\x01\x00" and sys.byteorder=="little"
            n=struct.unpack_from("<H",b,8)[0];h=ast.literal_eval(b[10:10+n].decode().strip())
            days=(date(y+1,1,1)-date(y,1,1)).days-1
            assert h==dict(descr="<f8",fortran_order=False,shape=(days,8,2))
            v=array.array("d");v.frombytes(b[10+n:])
            found[y]=[[complex(v[i+k],v[i+k+1]) for k in range(0,16,2)] for i in range(0,len(v),16)]
    return found
def ph(day):
    t=(day-date(2009,1,1)).days/365.2425
    return (1.0,t,math.cos(2*math.pi*t),math.sin(2*math.pi*t))
def receiver():
    p=read("file_pins.json")
    with ThreadPoolExecutor(4) as pool:parts=dict(pool.map(obtain,p))
    points,raw=parts["C04",0]
    original=archive(); pars=read("development.json")["fit"]; result=read("scores.json")
    dt=cmath.exp((1j-1/(2*179))*2*math.pi/434.2)
    r=math.sqrt(8.0100829*(8.0364807-8.0100829)/(8.0102594*(8.0364807-8.0102594)))
    worst_fore=0;worst_score=0;metrics=[];ncoords=0
    for y,days in sorted(original.items()):
        d0=date(y,1,1);start=points[d0];states=[start]*5
        errs=[[] for _ in range(8)]
        for i,locked in enumerate(days):
            d=d0+timedelta(days=i);obsday=d+timedelta(days=1)
            mix=sum(parts[k,y][d] for k in ("AAM","OAM","HAM","SLAM"))
            for role,(angle,ratio) in enumerate([(-14.928509,r),(0,1),(75.071491,r),(0,1),(0,1)]):
                co=pars[role]["coef"];m=len(co)//2
                nuisance=sum(complex(co[k],co[k+m])*ph(d)[k] for k in range(m))
                chi=nuisance+(mix if role<4 else 0j)
                orient=cmath.exp(1j*math.radians(angle))
                u=(states[role]-chi)/orient
                q=dt*complex(u.real,u.imag/ratio)
                states[role]=chi+orient*complex(q.real,ratio*q.imag)
            fit=pars[5]["coef"]
            planned=states+[start+sum(complex(*coeff)*(after-before) for coeff,after,before in zip(fit,ph(obsday)[1:],ph(d0)[1:])),start,states[1]+pars[6]["gain"]*(states[0]-states[1])]
            worst_fore=max(worst_fore,max(abs(x-z) for x,z in zip(planned,locked)))
            ncoords+=16
            for j,z in enumerate(locked):errs[j].append(z-points[obsday])
        s=result["years"][str(y)];rm=[]
        for k,e in enumerate(errs):
            rms=math.sqrt(math.fsum(z.real*z.real+z.imag*z.imag for z in e)/len(e));rm.append(rms)
            bias=sum(e)/len(e);w=max(range(len(e)),key=lambda j:abs(e[j]))
            assert s["worst_indices"][k]==w
            worst_score=max(worst_score,abs(rms-s["rmse"][k]),abs(abs(e[w])-s["maximum"][k]),abs(bias-complex(*s["bias"][k])),abs(math.fsum(map(abs,e))/len(e)-s["mean_radial"][k]))
        metrics.append(rm);print("YEAR",y,ncoords,worst_fore,worst_score,flush=True)
    mean=[math.fsum(v)/10 for v in zip(*metrics)]; wins=[sum(row[0]<row[k] for row in metrics) for k in range(8)]
    assert ncoords==58288 and worst_fore<1e-8 and worst_score<1e-9 and wins==result["wins"]
    assert (mean[0]<min(mean[1:]) and min(wins[1:3])>=7)==result["gate"]
    print("RECOUNT",json.dumps(dict(observed_coordinates=7286,forecast_coordinates=ncoords,max_trajectory_difference_mas=worst_fore,max_score_difference_mas=worst_score,mean=mean,wins=wins,gate=result["gate"])))
    print("GEODETIC",len(raw),hashlib.sha256(raw).hexdigest(),base64.b64encode(zlib.compress(raw,9)).decode())
if __name__=="__main__":receiver()
