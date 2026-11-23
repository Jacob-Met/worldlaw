"""Freeze each whole-spectrum forecast from source SLE, all ambient spectra and optical constants."""
import base64,hashlib,io,json,pathlib,subprocess,time,zipfile
import numpy as np
from chamber_inputs import data,optics
from mie_source import coefficients,mix
P=pathlib.Path(".");reg=json.loads((P/"protocol.json").read_text());start=time.monotonic()
rseed=int(__import__("sys").argv[1])
assert rseed in reg["transport"]["seeds"]
def sha(b):return hashlib.sha256(b).hexdigest()
def seed(label):return 1+int.from_bytes(hashlib.sha256(f"{rseed}:{label}".encode()).digest()[:8],"big")%(2**64-2)
def simulate(wave,sga,angle,nphot,label):
    buf=io.StringIO();np.savetxt(buf,np.column_stack((wave,sga)),fmt="%.17g")
    t=subprocess.run(["./adjoint","100","10",str(nphot),"hemisphere" if angle=="hemisphere" else "cone",str(90 if angle=="hemisphere" else angle),str(seed(label))],input=buf.getvalue().encode(),capture_output=True,check=True)
    rows=np.loadtxt(io.BytesIO(t.stdout),dtype=np.int64).reshape(len(wave),102,3)
    assert (rows[:,:,0]==np.arange(len(wave))[:,None]).all() and (rows[:,:,1]==np.arange(102)).all()
    counts=rows[:,:,2];assert (counts>=0).all() and (counts.sum(1)==nphot).all()
    return counts[:,:101]/nphot
H=6.626e-34*3e8/(1.38e-23*1e-6)
def normalize(wave,intensity):
    q=H/wave
    tb=q/np.log1p(1/intensity)
    smooth=(np.r_[tb[0],tb[:-1]]+tb+np.r_[tb[1:],tb[-1]])/3
    return np.expm1(q/np.max(smooth))/np.expm1(q/smooth)
def em(wave,k,bot,drop,depth):
    levels=bot-drop*np.maximum(0.,1-np.r_[np.arange(100)*10.,990.]/depth)
    return normalize(wave,np.sum(k/np.expm1(H/(wave[:,None]*levels[None,:])),axis=1))
def pred(grid,k,base,params,scale=1):
    t,dt,dz=params
    return base*em(grid,k,t,dt,dz*scale)/em(grid,k,t,0,dz)
def rm(x,y):return float(np.sqrt(np.mean((x-y)**2)))
def calibrate(k,grid,base,truth,params):
    errors=[rm(pred(grid,k,base,p),truth) for p in params]
    i=int(np.argmin(errors));return params[i],errors[i]
raw=data(reg);wave=raw["A"]
assert np.all(np.diff(wave)>0) and all(np.max(abs(raw[c]-wave))<=1e-6 for c in ("E","I"))
nr=optics(reg,wave);diam=[47.5,76.5,16.];amb=[raw[c] for c in ("B","F","J")];truth=raw["C"];assert min(np.min(v) for v in amb)>0
subprocess.run(["cc","-O3","adjoint.c","-lm","-o","adjoint"],check=True)
K={};orient=[];cost=[]
for j,d in enumerate(diam):
    tic=time.monotonic()
    sga=np.array([[coefficients(n,w,d) for n,w in zip(ns,wave)] for ns in nr])
    iso=[]
    for i,x in enumerate([*sga,mix(sga,[1/3]*3)]):
        k=simulate(wave,x,"hemisphere",8192,f"orient:{d}:{i}")
        iso.append(em(wave,k,400,0,100))
    xyz=np.array(iso[:3]);factor=iso[3]/xyz.mean(0);u,v,w=xyz*factor
    best=(float("inf"),None)
    for aa in range(101):
        for bb in range(101-aa):
            weights=(aa,bb,100-aa-bb);err=rm((aa*u+bb*v+(100-aa-bb)*w)/100,amb[j])
            if err<best[0]:best=(err,weights)
    orient.append({"diameter":d,"integer_weights":best[1],"ambient_rmse":best[0]})
    x=mix(sga,np.asarray(best[1])/100)
    for ang in ["hemisphere",0,15]:
        K[j,ang]=simulate(wave,x,ang,24576,f"final:{d}:{ang}")
    cost.append(time.monotonic()-tic)
    print("FINITE_OPTICAL_INPUT",json.dumps({"seed":rseed,"geometry":d,"elapsed_s":cost[-1],"orientation":orient[-1]}),flush=True)
params=[(t,v,z) for t in [350,400] for v in [0,10,20,30,40,50,60,75,100] for z in [40,80,160,320,640,1000]]
ph,eh=calibrate(K[0,"hemisphere"],wave,amb[0],truth,params)
pn,en=calibrate(K[0,0],wave,amb[0],truth,params)
pa,ea=calibrate(K[0,"hemisphere"],wave,amb[0],truth,[p for p in params if p[0]==400])
allroles=[]
for j in [1,2]:
    make=lambda ang,p,scale=1:pred(wave,K[j,ang],amb[j],p,scale)
    allroles.append([make(0,ph),make("hemisphere",ph),make(0,pn),make("hemisphere",pn),make(15,ph),make("hemisphere",pa),amb[j],amb[j]+truth-amb[0],amb[j]*truth/amb[0],make(0,ph,diam[j]/diam[0]),make("hemisphere",ph,diam[j]/diam[0])])
A=np.asarray(allroles,dtype="<f8");assert A.shape==(2,11,568) and np.isfinite(A).all()
out=io.BytesIO();np.save(out,A,allow_pickle=False);arr=out.getvalue()
summary={"seed":rseed,"protocol_sha":sha((P/"protocol.json").read_bytes()),"shape":list(A.shape),"npy_sha":sha(arr),"npy_bytes":len(arr),"digest":[[sha(a.tobytes()) for a in slab] for slab in A],"roles":reg["roles"],"diameters_um":diam,"fit":{"hemisphere":[ph,eh],"normal":[pn,en],"author400":[pa,ea]},"orientations":orient,"cost_per_preparation_seconds":cost,"total_wall_seconds":time.monotonic()-start,"held_sle_read":0}
print("FORECAST",json.dumps(summary,sort_keys=True),flush=True)
print("NPY",base64.b64encode(arr).decode(),flush=True)
