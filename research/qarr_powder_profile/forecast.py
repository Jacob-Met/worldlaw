"""Development-only fixed-phase profile map and equal-information controls."""
import hashlib,json,math,os,sys
from decimal import Decimal
from pathlib import Path
import numpy as np
from acquisition import BASE,P,acquire,angles,header,sha,values,source_values
from compact_forecast import profile,packed
from peak_control import calibrate
def wt(c):
    w=np.asarray(P['weighed'][c],float);return w/w.sum()
def unit(x):
    x=x-x.mean(axis=1,keepdims=True);return x/np.linalg.norm(x,axis=1,keepdims=True)
def project(x,w):
    u=unit(x)
    Q=np.eye(len(w))-w@np.linalg.pinv(w)
    H=(u@u.T)*Q
    eig,V=np.linalg.eigh((H+H.T)/2)
    g=V[:,0];g*=1 if sum(g)>=0 else -1
    condition=float(np.linalg.cond(w))
    gap=float(eig[1]-eig[0]);ratio=float(eig[0]/eig[1]);spread=float(min(g)/max(g))
    screen=condition<=10 and gap>=.01 and ratio<=.25 and spread>=.10
    return g,{'eigenvalues':eig.tolist(),'gain':g.tolist(),'condition':condition,'gap':gap,'ratio':ratio,'min_over_max':spread,'screen':bool(screen)}
def main():
    raw,fn=acquire()
    # Native evidence only for authentic source reference and development 1e; template has no target intensities.
    for n in ('corundum','cpd-1e'):header(fn,n)
    development=list(P['dev']);targets=list(P['held']);names=P['phase_order']+['cpd-1'+s for s in development]
    raw_bytes=[raw(n) for n in names];rows=[source_values(n,b,fn) for n,b in zip(names,raw_bytes)];t=np.array(angles(raw_bytes[0]))
    y=np.array(rows);refs,train=y[:3],y[3:];w=np.array([wt(c) for c in development]);Wpinv=np.linalg.pinv(w)
    g,scr=project(train,w);print('SOURCE_SCREEN',json.dumps(scr,sort_keys=True),flush=True)
    assert scr['screen'],'development sufficient conditioning refusal; no target read'
    norm=np.linalg.norm(y-y.mean(axis=1,keepdims=True),axis=1)
    peak,areas=calibrate(t,refs,train,w)
    print('PEAK_CONTROL',len(areas),peak.tolist(),flush=True)
    cv={}
    for i,c in enumerate(development):
        others=np.arange(len(train))!=i;u,gcheck=project(train[others],w[others]);pw=w[i]@np.linalg.pinv(w[others])
        heldcv=profile([r for j,r in enumerate(rows[3:]) if j!=i],pw*u/norm[3:][others])
        actual=profile([rows[i+3]],[1.]);cv[c]={'screen':gcheck,'rms':float(np.sqrt(np.mean((np.array(heldcv)-actual)**2)))}
    roles=['projective','pure_mass','pure_mac','pure_norm','unit_ols','raw_ols','nearest','peak_fit']
    lock={'protocol_sha256':sha((BASE/'protocol.json').read_bytes()),'sources':dict(zip(names,map(sha,raw_bytes))),
          'basis':names,'roles':roles,'coefficients':{},'sha256':{},'source_screen':scr,'cv':cv,'peak_area_records':areas,'peak_gain':peak.tolist()}
    full=bytearray()
    for c in targets:
        v=wt(c);coef=v@Wpinv;where=int(np.argmin(np.linalg.norm(w-v,axis=1)))
        onlyref=lambda a:np.r_[a,np.zeros(len(w))]
        onlydev=lambda a:np.r_[np.zeros(3),a]
        weights=[onlydev(coef*g/norm[3:]),onlyref(v),onlyref(v*np.array(P['mac'])),onlyref(v/norm[:3]),
                 onlydev(coef/norm[3:]),onlydev(coef),onlydev(np.eye(len(w))[where]),onlyref(v*peak)]
        lock['coefficients'][c]={};lock['sha256'][c]={}
        for r,ww in zip(roles,weights):
            ww=[float(vv) for vv in ww];buf=packed(profile(rows,ww))
            lock['coefficients'][c][r]=ww;lock['sha256'][c][r]=sha(buf);full.extend(buf)
    lock['matrix_bytes']=len(full);lock['matrix_sha256']=sha(full)
    name=Path(sys.argv[1]);name.write_text(json.dumps(lock,sort_keys=True,separators=(',',':'),allow_nan=False))
    (name.parent/'prevalue-24-arrays.f64le').write_bytes(full)
    print('FORECAST_LOCK',sha(name.read_bytes()),len(full),sha(full),flush=True)
if __name__=='__main__':main()
