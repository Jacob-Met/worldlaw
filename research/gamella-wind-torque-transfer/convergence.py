"""Train-only integration check for the original row-indexed inferred forcing.

The two held runs contribute timestamps, commanded duty and hatch setting only.
No outcome columns or measured RPM prefixes are selected from either.
"""
from pathlib import Path
import hashlib
import json
from zipfile import ZipFile
import numpy as np
import pandas as pd
import wind_transfer as w

B=w.DRAG/w.INERTIA

from torque_flow import flow

def load_inputs(member):
    with ZipFile('impulse.zip') as z,z.open(f'{w.PANEL}/load_out_{member}_osr_downwind_4.csv') as f:
        q=pd.read_csv(f,usecols=w.INPUT)
    return q[w.INPUT].to_numpy().reshape(-1,50,4)

def original(model,u,base,n):
    t,li,lo,h=np.moveaxis(u,-1,0)
    mid=w.interp_profiles(model['h'],model['prefix'][:,0,None],h[:,0])/w.RPM
    tmpl=w.interp_profiles(model['h'],model['dy'],h[:,0])[:,:,0]/w.RPM
    src=mid+tmpl;dt=w.interp_profiles(model['h'],model['dt'],h[:,0])
    drive=np.diff(src,axis=1)/dt+B*(src[:,:-1]**2-mid**2)+B*base[:,None]**2
    v=np.broadcast_to(base[:,None],(len(base),50)).copy();clips=0
    for j in range(5,50):
        d=t[:,j]-t[:,j-1];old=v[:,j-1].copy();a=drive[:,j-1]
        if n==0:new=flow(old,a,d,B)
        else:
            new=old
            for _ in range(n):
                new=new+(a-B*new**2)*d/n
                clips+=int((new<0).sum())
                new=np.maximum(0,new)
        v[:,j]=new
    return v[:,5:]*w.RPM,clips

def run():
    u,y=w.panel('0.5')
    train=u[:4000];ys=y[:4000]
    model={'h':train[:,0,3],'dy':w.centered(ys),'prefix':ys[:,:5].mean(1),'dt':np.diff(train[:,:,0])}
    report={}
    for key,r,base,truth in [('middle-dev',u[4000:],y[4000:,:5,0].mean(1)/w.RPM,y[4000:,5:,0]),
            ('low-clock-nominal',load_inputs('0.01'),None,None),('high-clock-nominal',load_inputs('1'),None,None)]:
        if base is None:base=np.full(len(r),.1*w.WMAX if key.startswith('low') else w.WMAX)
        ref,_=original(model,r,base,0)
        info={'events':len(r),'prefix_kind':'measured training only' if truth is not None else 'fixed nominal A1 speed',
              'exact_rmse_rpm':float(np.sqrt(np.mean((ref-truth)**2))) if truth is not None else None,'substeps':{}}
        for n in (1,4,16,64):
            estimated,clamps=original(model,r,base,n)
            delta=estimated-ref;f,j=np.unravel_index(np.abs(delta).argmax(),delta.shape)
            m={'rms_vs_exact':float(np.sqrt(np.mean(delta**2))),'max_abs_vs_exact':float(abs(delta[f,j])),
               'p95_event_max':float(np.quantile(np.abs(delta).max(1),.95)),'zero_clamps':clamps,
               'worst':{'flag':int(f)+(4000 if truth is not None else 0),'row':int(j+5),'interval_s':float(r[f,j+5,0]-r[f,j+4,0]),
                        'euler_rpm':float(estimated[f,j]),'exact_rpm':float(ref[f,j])}}
            if truth is not None:m['rmse_rpm']=float(np.sqrt(np.mean((estimated-truth)**2)))
            info['substeps'][n]=m
        report[key]=info
    return report
if __name__=='__main__':print(json.dumps(run(),indent=2))
