"""Reproduce the frozen mounted pendulum file-transfer experiment."""
import base64
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile
import numpy as np
from scipy.io import loadmat
from scipy.optimize import nnls
from range_reader import RangeFile

H = {
    1:"2af828048debc0ec33dcd9f46538b747a72a7bfaa3b333852cc474db5ada7633",
    2:"b0f94afdc6f1bb20285ca9fd416ddb249521ac678ac84f45c0881f4d9dcb8ff2",
    3:"8e8369479e135b8bbd3fc292b051b314eec61e1ac98dc56cb871ceb8299978eb",
    4:"2876a0d76708725723bf382dce3e42a1c37327d88775671abb6c9ebd448c77c6"}
NAMES=["author","viscous","quadratic","coulomb"]
HASH=lambda b:hashlib.sha256(b).hexdigest()
def save(path,data):
    b=json.dumps(data,sort_keys=True,allow_nan=False).encode()
    Path(path).write_bytes(b)
    return HASH(b)

def decode(archive,i):
    label=f"Datas/DoublePendulum/DoubleDataFreeSwing_{i}_Dt_0_001.mat"
    b=archive.read(label); assert HASH(b)==H[i]
    src=loadmat(io.BytesIO(b))
    state=np.ascontiguousarray(np.column_stack([src[k].ravel() for k in ("Theta1","Theta2","dTheta1","dTheta2")]))
    time=np.ascontiguousarray(src["Time"].ravel())
    assert np.isfinite(state).all() and time[0]==0 and np.max(abs(np.diff(time)-.001))<3e-14
    return time,state

def energy(par,x):
    m,n,a,b,l,I,J,k,h,g=par
    q,r,u,v=x.T
    return .5*(I+m*a*a+n*l*l)*u*u+.5*(J+n*b*b)*v*v+n*l*b*np.cos(q-r)*u*v+g*((m*a+n*l)*np.cos(q)+n*b*np.cos(r))

def fit(par,t,x):
    u=x[:,2];w=x[:,3]-u
    s=2*np.pi/40
    factors=np.column_stack((u*u,w*w,np.abs(u)**3,np.abs(w)**3,u*np.tanh(u/s),w*np.tanh(w/s)))
    acc=np.cumsum((factors[1:]+factors[:-1])*.5*np.diff(t)[:,None],axis=0)
    acc=np.vstack((np.zeros(6),acc))
    cuts=np.arange(0,len(t),1000)
    work=np.diff(acc[cuts],axis=0)
    e=energy(par,x);target=-np.diff(e[cuts])
    out=[];coeff=[]
    for i,c in enumerate(([0,1],[0,1],[0,1,2,3],[0,1,4,5])):
        A=work[:,c]
        cf=par[7:9].copy() if i==0 else nnls(A,target)[0]
        loss=A@cf-target
        order=np.argsort(-np.abs(loss))[:5]
        padded=np.zeros(4);padded[:len(cf)]=cf;coeff.append(padded)
        out.append(dict(name=NAMES[i],coefficients=padded.tolist(),windows=len(loss),rank=int(np.linalg.matrix_rank(A)),singular=np.linalg.svd(A,compute_uv=False).tolist(),work_rmse=float(np.sqrt(np.mean(loss**2))),worst=[dict(t=float(t[cuts[j]]),target=float(target[j]),prediction=float((A@cf)[j]),observed_start=x[cuts[j]].tolist(),observed_end=x[cuts[j+1]].tolist()) for j in order],complete_residuals=loss.tolist()))
    return coeff,out

def bind():
    subprocess.run(["cc","-O2","-fPIC","-shared","mounted.c","-o","mounted.so","-lm"],check=True)
    so=ctypes.CDLL(str(Path("mounted.so").resolve()))
    arr=np.ctypeslib.ndpointer(np.float64,flags="C_CONTIGUOUS")
    so.forward.argtypes=[arr,arr,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_size_t,arr,arr,arr]
    so.forward.restype=None
    so.derivative.argtypes=[arr,arr,ctypes.c_int,arr,arr];so.derivative.restype=None
    return so

def metrics(par,t,x,y):
    err=y-x
    err[:,:2]=np.arctan2(np.sin(err[:,:2]),np.cos(err[:,:2]))
    er=energy(par,y)-energy(par,x)
    def section(a,b):
        return [float(np.sqrt(np.mean(err[a:b,:2]**2))),float(np.sqrt(np.mean(err[a:b,2:]**2))),float(np.sqrt(np.mean(er[a:b]**2)))]
    worst=int(np.argmax(np.sum(err[:,:2]**2,axis=1)))
    return dict(metric=section(0,len(t)),channels=np.sqrt(np.mean(err**2,axis=0)).tolist(),worst=dict(index=worst,time=float(t[worst]),observation=x[worst].tolist(),prediction=y[worst].tolist(),error=err[worst].tolist(),model_energy_error=float(er[worst])),blocks=[section(a,min(len(t),a+2667)) for a in range(0,len(t),2667)])

def main():
    subprocess.run([sys.executable,"exact_mounted.py","code-and-schema.json"],check=True)
    so=bind()
    with urllib.request.urlopen("https://zenodo.org/api/records/6633719",timeout=60) as fp:rec=json.load(fp)
    f=next(f for f in rec["files"] if f["key"]=="MultiArm-Pendulum.zip");assert f["checksum"]=="md5:b7ef285267d3ebb7f31370ad1df55b99"
    pbytes=Path("published-parameters.mat").read_bytes()
    with zipfile.ZipFile(RangeFile(f["links"]["self"],f["size"])) as archive:
        assert pbytes==archive.read("ParameterEstimation/DoublePendulum/EstimatedParameters_DoublePendulum.mat")
        par=np.ascontiguousarray(loadmat(io.BytesIO(pbytes))["EstimatedParameters"].ravel())
        assert par.shape==(10,) and min(par)>0
        q=np.array([np.pi/2,np.pi/2,0.,0.]);d=np.zeros(4)
        so.derivative(np.ones(10),np.ones(4),0,q,d)
        assert np.allclose(d,[0,0,.6,.2],rtol=0,atol=2e-15)
        coeff,train=fit(par,*decode(archive,3))
        for mode,c in enumerate(coeff):
            for x in [np.array([.9,-.2,.3,-.917]),np.array([-.7,.9,-.4,1.1])]:
                q=x[:2];u,v=x[2:];w=v-u;so.derivative(par,c,mode,x,d)
                A=par[5]+par[0]*par[2]**2+par[1]*par[4]**2;B=par[6]+par[1]*par[3]**2;C=par[1]*par[4]*par[3];m,n,a,b,l,I,J,k,h,g=par
                gradient=np.array([-C*np.sin(q[0]-q[1])*u*v-g*(m*a+n*l)*np.sin(q[0]),C*np.sin(q[0]-q[1])*u*v-g*n*b*np.sin(q[1]),A*u+C*np.cos(q[0]-q[1])*v,B*v+C*np.cos(q[0]-q[1])*u])
                power=c[0]*u*u+c[1]*w*w
                if mode==2:power+=c[2]*abs(u)**3+c[3]*abs(w)**3
                if mode==3:power+=c[2]*u*np.tanh(u/(2*np.pi/40))+c[3]*w*np.tanh(w/(2*np.pi/40))
                assert abs(gradient@d+power)<5e-12 and power>=0
        lock=save("calibration-lock.json",dict(protocol=HASH(Path("protocol.txt").read_bytes()),source=H[3],params=par.tolist(),parameter_sha=HASH(pbytes),methods=train))
        assert HASH(Path("calibration-lock.json").read_bytes())==lock
        print("PRETEST_LOCK",lock,[(r["name"],r["coefficients"],r["work_rmse"]) for r in train],flush=True)
        allrows={};sizes={}
        for i in (1,2,4):
            t,x=decode(archive,i);sizes[i]=len(t);results={};allrows[i]=results
            folder=Path(f"record-{i}");folder.mkdir(exist_ok=True);np.save(folder/"time.npy",t);np.save(folder/"observed.npy",x)
            for mode,c in enumerate(coeff):
                for name,block in (("full",0),("restart",2667)):
                    for halves in ((1,2) if mode in (0,3) else (1,)):
                        y=np.empty_like(x);so.forward(par,c,mode,block,halves,len(t),t,x,y)
                        assert np.isfinite(y).all()
                        key=f"{NAMES[mode]}-{name}-{halves}"
                        np.save(folder/(key+".npy"),y)
                        results[key]=metrics(par,t,x,y)
                        print("CELL",i,key,results[key]["metric"],flush=True)
            save(folder/"metrics.json",results)
        avg=lambda tag,col:float(np.mean([z[tag]["metric"][col] for z in allrows.values()]))
        base=lambda channel,col:min(avg(n+"-"+channel+"-1",col) for n in NAMES[:3])
        primary=avg("coulomb-restart-1",0);best=base("restart",0)
        guards=dict(mean=primary<=.95*best,each=all(z["coulomb-restart-1"]["metric"][0]<=min(z[n+"-restart-1"]["metric"][0] for n in NAMES[:3]) for z in allrows.values()),velocity=avg("coulomb-restart-1",1)<=1.05*base("restart",1),energy=avg("coulomb-full-1",2)<=1.05*base("full",2),step=all(abs(z[n+"-restart-1"]["metric"][0]-z[n+"-restart-2"]["metric"][0])<=.002 for n in ("author","coulomb") for z in allrows.values()))
        summary=dict(lock=lock,rows=sizes,guards=guards,success=all(guards.values()),primary=primary,best=best,mean_restart={n:[avg(n+"-restart-1",k) for k in range(3)] for n in NAMES},mean_full={n:[avg(n+"-full-1",k) for k in range(3)] for n in NAMES})
        sha=save("result.json",summary);print("RESULT",sha,json.dumps(summary,sort_keys=True),"ROOT",Path.cwd(),flush=True)
if __name__=="__main__":
    main()
