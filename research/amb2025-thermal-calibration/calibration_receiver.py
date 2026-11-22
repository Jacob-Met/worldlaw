"""Independent source-temperature receiver using composite Simpson integration in sqrt(lag)."""
import json
import math
import sys
from functools import lru_cache

import numpy as np


class Kernel:
    def __init__(self,n,h,az_scale,eta):
        self.n=n
        self.sigma=18e-6
        self.h=h*1e-6
        self.az=5.19e-6*az_scale**2
        self.kxy=5.19e-6
        self.eta=eta
        self.u=np.linspace(0,1,n+1)
        self.weights=np.ones(n+1)
        self.weights[1:-1:2]=4
        self.weights[2:-1:2]=2
        self.weights/=3*n
        self.scale=2*eta*285/(25.32/5.19e-6)/(2*math.pi)**1.5
    def temperatures(self,t,y,z):
        t=np.atleast_1d(t)
        lo=np.sqrt(np.maximum(t-0.008/0.96,0))[:,None]
        hi=np.sqrt(t)[:,None]
        u=lo+(hi-lo)*self.u
        lag=u*u
        vx=self.sigma**2+2*self.kxy*lag
        vz=self.h**2+2*self.az*lag
        x=0.004-0.96*(t[:,None]-lag)
        if self.h==0:
            # Together the heat kernel's 1/sqrt(lag) and the u^2 substitution have a finite endpoint.
            factor=2/np.sqrt(2*self.az)
            depth=np.ones_like(u) if z==0 else np.exp(-z*z/(2*np.maximum(vz,1e-300)))
        else:
            factor=2*u/np.sqrt(vz)
            depth=np.exp(-z*z/(2*vz))
        f=np.exp(-(x*x+y*y)/(2*vx))*depth/vx*factor
        return 22+self.scale*np.sum(f*(hi-lo)*self.weights,axis=1)
    def peak(self,y,z):
        ts=np.linspace(.00365,.00565,51)
        val=self.temperatures(ts,y,z)
        i=int(np.argmax(val))
        assert 0<i<len(ts)-1
        a,b=ts[i-1],ts[i+1]
        for _ in range(22):
            z1,z2=(2*a+b)/3,(a+2*b)/3
            f,g=self.temperatures([z1,z2],y,z)
            if f<g:a=z1
            else:b=z2
        return float(self.temperatures([(a+b)/2],y,z)[0])
    def area(self,nang):
        radii=[]
        for angle in np.linspace(0,np.pi/2,nang+1):
            co,si=np.cos(angle),np.sin(angle)
            a,b=0.,180e-6
            for _ in range(24):
                mid=(a+b)/2
                if self.peak(co*mid,si*mid)>1260:a=mid
                else:b=mid
            radii.append(1e6*(a+b)/2)
        w=np.ones(nang+1);w[1:-1:2]=4;w[2:-1:2]=2
        return float(np.dot(w,np.asarray(radii)**2)*np.pi/(6*nang)),radii[0],radii[-1]
    def trace(self,y_fraction,dt):
        ts=np.arange(.003,.007+dt/2,dt)
        trace=np.concatenate([self.temperatures(v,y_fraction*68.9e-6,0) for v in np.array_split(ts,16)])
        def crosses(threshold,up):
            indices=np.flatnonzero((trace[:-1]<threshold)&(trace[1:]>=threshold) if up else (trace[:-1]>=threshold)&(trace[1:]<threshold))
            return [float(ts[i]+(threshold-trace[i])*(ts[i+1]-ts[i])/(trace[i+1]-trace[i])) for i in indices]
        ons,offs=crosses(1298,True),crosses(1298,False)
        if not ons:return {"peak_C":float(trace.max()),"TAM_us":None,"SCR_K_per_s":None}
        assert len(ons)==len(offs)
        t_on,t_off=max(zip(ons,offs),key=lambda p:p[1]-p[0])
        first=min(t for t in crosses(1260,False) if t>=t_off)
        last=min(t for t in crosses(1150,False) if t>=first)
        return {"peak_C":float(trace.max()),"TAM_us":(t_off-t_on)*1e6,"SCR_K_per_s":110/(last-first),
                "crossings_s":[t_on,t_off,first,last]}


def main():
    fit=json.loads(sys.argv[1])
    models={"surface":(0.,1.,fit["surface_eta"]),"depth_stretch":(0.,fit["stretch"],fit["stretch_eta"]),
           "normal_volume":(fit["normal_sigma_um"],1.,fit["volume_eta"])}
    areas=[[135.3,9.8,12661],[138.4,11.4,13048],[137.0,10.9,12938],[137.0,10.3,12781],[139.9,10.9,13096],[136.9,10.2,13155]]
    result={}
    for n,angles,dt in [(128,10,1e-6),(256,20,0.5e-6),(512,40,0.25e-6),(1024,80,0.125e-6)]:
        sweep={}
        for role,params in models.items():
            k=Kernel(n,*params)
            area,halfwidth,depth=k.area(angles)
            sweep[role]={"area_under_surface_um2":area,"width_um":2*halfwidth,"depth_um":depth,
                         "within_area_window":[bool(a-w*h<=area<=a) for w,h,a in areas],
                         "traces":{str(f):k.trace(f,dt) for f in (0,.25,.5,.75)}}
        result[str(n)]=sweep
    diffs={r: [abs(result[str(a)][r]["area_under_surface_um2"]-result[str(b)][r]["area_under_surface_um2"]) for a,b in ((128,256),(256,512),(512,1024))] for r in models}
    print(json.dumps({"area_deltas_um2":diffs},sort_keys=True), flush=True)
    for role in models:
        assert diffs[role][-1]<3, (role,diffs[role])
    for f,t in result["1024"]["surface"]["traces"].items():
        for field in ("peak_C","TAM_us","SCR_K_per_s"):
            assert math.isclose(t[field],result["1024"]["depth_stretch"]["traces"][f][field],rel_tol=1e-10)
    print(json.dumps({"source_shape_with_bead_bounds_um2":[[a-w*h,a] for w,h,a in areas],
                      "calibration_only":True,"exposed_shape_check":True,"pad_answers_read":0,"sweep":result},sort_keys=True))
if __name__=="__main__":main()
