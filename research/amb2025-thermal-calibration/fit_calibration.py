"""Fit three heat-deposition models to six calibration cross sections from three repeated tracks."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from numpy.polynomial.legendre import leggauss

POWER=285.0
SPEED=0.960
LENGTH=0.008
SIGMA=72e-6/4
DIFF=5.19e-6
HEAT_CAPACITY=25.32/DIFF
THRESHOLD=1260.0-22.0
HALF_WIDTH=137.8e-6/2
DEPTH=125.1e-6


class Integration:
    def __init__(self,order,samples):
        xi,w=leggauss(order)
        self.nodes=(xi+1)/2
        self.weights=w/2
        self.times=np.linspace(0,LENGTH/SPEED+0.006,samples)
    def rise(self,times,y,z,normal_sigma=0,depth_factor=1.0):
        times=np.asarray(times,dtype=float)
        a=np.sqrt(np.maximum(0,times-LENGTH/SPEED))[:,None]
        b=np.sqrt(times)[:,None]
        u=a+(b-a)*self.nodes
        s=u*u
        vxy=SIGMA**2+2*DIFF*s
        vz=normal_sigma**2+2*DIFF*depth_factor**2*s
        dx=LENGTH/2-SPEED*(times[:,None]-s)
        vz=np.maximum(vz,np.finfo(float).tiny)
        exponent=-(dx*dx+y*y)/(2*vxy)-(z*z)/(2*vz)
        gaussian=np.exp(exponent)/(vxy*np.sqrt(vz))
        return 2*POWER/HEAT_CAPACITY/(2*np.pi)**1.5*np.sum(gaussian*2*u*(b-a)*self.weights,axis=1)
    def peak(self,y,z,h=0,lam=1):
        vals=self.rise(self.times,y,z,h,lam)
        idx=int(np.argmax(vals))
        if idx in (0,len(vals)-1):raise ValueError("Peak at time boundary")
        a,b=self.times[idx-1],self.times[idx+1]
        for _ in range(34):
            mid1=(2*a+b)/3
            mid2=(a+2*b)/3
            v1,v2=self.rise([mid1,mid2],y,z,h,lam)
            if v1<v2:a=mid1
            else:b=mid2
        t=(a+b)/2
        return float(self.rise([t],y,z,h,lam)[0]),float(t)
    def root(self,fn,lo,hi):
        f0=fn(lo);f1=fn(hi)
        if f0*f1>=0:raise ValueError(("No sign bracket",f0,f1))
        for _ in range(35):
            mid=(lo+hi)/2
            if fn(mid)*f0>0:lo=mid
            else:hi=mid
        return (lo+hi)/2
    def fit(self):
        surface,t_width=self.peak(HALF_WIDTH,0)
        eta=THRESHOLD/surface
        d0=self.root(lambda z:self.peak(0,z)[0]-surface,0,0.0004)
        stretch=DEPTH/d0
        h=self.root(lambda h:self.peak(0,DEPTH,h)[0]-self.peak(HALF_WIDTH,0,h)[0],0,0.0004)
        vs,ts=self.peak(HALF_WIDTH,0,h)
        vd,td=self.peak(0,DEPTH,h)
        eta_v=THRESHOLD/vs
        def admiss(x):return bool(0<x<=1)
        return {"surface_eta":eta,"surface_depth_um":d0*1e6,"surface_admissible":admiss(eta),
                "stretch":stretch,"stretch_eta":eta*stretch,"stretch_admissible":admiss(eta*stretch),
                "normal_sigma_um":h*1e6,"volume_eta":eta_v,"volume_admissible":admiss(eta_v),
                "volume_surface_temp_C":22+eta_v*vs,"volume_depth_temp_C":22+eta_v*vd,
                "peak_time_s":[t_width,ts,td],"surface_arb_gauge_error_K":float(np.max(np.abs(eta*self.rise(self.times,0,0)-
                eta*stretch*self.rise(self.times,0,0,0,stretch))))}


def main():
    results={str(n):Integration(n,nt).fit() for n,nt in [(96,401),(192,801),(384,1201)]}
    last=results["384"];before=results["192"]
    assert max(abs(last[k]-before[k]) for k in ("surface_eta","stretch_eta","volume_eta"))<2e-5
    assert abs(last["normal_sigma_um"]-before["normal_sigma_um"])<0.005
    assert last["surface_arb_gauge_error_K"]<1e-8
    record={"calibration":"NIST AMB2025-06/07 descriptions Table 5 six hand-measured cross sections",
            "property_source":"Agazhanov et al. 2019 10.1088/1742-6596/1382/1/012175 Table 2 at 1400 kelvin",
            "property_scope":"fixed effective comparison, independent IN718 specimen; no claim of fitted plate properties",
            "convergence":results,"registered_eta_interval":[0,1],"held_pad_arrays_opened":0}
    print(json.dumps(record,sort_keys=True,allow_nan=False))


if __name__=="__main__":
    main()
