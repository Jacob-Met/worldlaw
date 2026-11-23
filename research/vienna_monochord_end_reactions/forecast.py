"""Fit complete-recording operators on the source position and emit held forecasts before reading nut values."""
import hashlib, json, io, sys, zipfile
from pathlib import Path
from collections import defaultdict
import numpy as np
from scipy.signal import butter,sosfilt,fftconvolve
from numpy.lib.stride_tricks import sliding_window_view
from acquisition import read_raw,parse
from mechanics import echo_kernel

FS=50000
BAND=butter(4,[25,800],btype='bandpass',fs=FS,output='sos')
RHO=(.65,.85,.95,.985)
FREQ=(93.,98.,103.)
RIDGE=(.0001,.01)
HELD=tuple(range(51,57))
DEV=tuple(range(5,51,5))
FIT=tuple(i for i in range(1,51) if i not in DEV)
ROLES=('mechanics_filter','source_geometry','mechanics_gain','direct_fir','long_fir','signed_half_period','zero')

def prep(x):
    return sosfilt(BAND,x-x[0],axis=0)
def causal_matrix(x,length,step=1):
    return sliding_window_view(np.pad(x,(length-1,0)),length)[::step,::-1].copy()
def keyname(k):return '/'.join(map(str,k))
def operators(bridge,beta):
    short=bridge[::10]
    yield ('direct',),short,81
    yield ('long',),short,241
    for f in FREQ:
        dt=FS/(2*f);idx=np.arange(len(short))*10-dt
        prev=-np.interp(idx,np.arange(len(bridge)),bridge,left=0.)
        yield ('delay',f),prev,1
        for rho in RHO:
            kernel=echo_kernel(beta,rho,fs=FS,fundamental=f,duration=(len(bridge)-1)/FS)
            z=fftconvolve(bridge,kernel,mode='full')[:len(bridge):10].copy()
            yield ('point',f,rho),z,31
            yield ('gain',f,rho),z,1

def solve(stats):
    out={}
    for k,(gram,rhs) in stats.items():
        for ridge in RIDGE:
            diagonal=max(1e-20,float(np.trace(gram))/len(gram))*ridge
            out[k+(ridge,)]=np.linalg.solve(gram+np.eye(len(gram))*diagonal,rhs)
    return out
def use(z,w):
    return np.convolve(z,w,mode='full')[:len(z)]
def rms(e):return float(np.sqrt(np.mean(e*e)))

def produce(base,outdir):
    base=Path(base);dest=Path(outdir);dest.mkdir(exist_ok=True)
    roster=json.loads((base/'design-roster.json').read_text()); beta0=float(np.median([roster[i-1]['beta'] for i in FIT]))
    stats={}
    # Every fourth filtered training sample indexes the regression. Zero-history padding at every new stroke.
    for m,raw in read_raw(base,FIT):
        q=parse(raw,usecols=(2,3));assert np.isfinite(q).all()
        inp=prep(q[:,0]);y=prep(q[:,1])[::40]
        for k,z,length in operators(inp,m['beta']):
            x=causal_matrix(z,length,4);g,v=x.T@x,x.T@y
            if k in stats:stats[k][0]+=g;stats[k][1]+=v
            else:stats[k]=[g,v]
    weights=solve(stats);errors=defaultdict(list);dev_worst={}
    for m,raw in read_raw(base,DEV):
        q=parse(raw,usecols=(2,3));inp=prep(q[:,0]);y=prep(q[:,1])[::10]
        for k,z,_ in operators(inp,m['beta']):
            for r in RIDGE:
                kk=k+(r,);pred=use(z,weights[kk]);e=pred-y;errors[kk].append(rms(e))
                imax=int(np.argmax(abs(e)));norm=abs(float(e[imax]))
                if kk not in dev_worst or norm>dev_worst[kk][0]:
                    dev_worst[kk]=[norm,m['index'],imax,float(pred[imax]),float(y[imax])]
    pick=lambda family:min((k for k in weights if k[0]==family),key=lambda k:sum(errors[k])/len(errors[k]))
    selected={role:pick(family) for role,family in [('mechanics_filter','point'),('mechanics_gain','gain'),('direct_fir','direct'),('long_fir','long'),('signed_half_period','delay')]}
    selected['source_geometry']=selected['mechanics_filter']
    meta={'acquisition_identity':'March 27 A string r_v1 (folder legend and measured speed distinguished)','source_position_median':beta0,'roles':ROLES,'development_ids':DEV,'source_fit_ids':FIT,'held_ids':HELD,'selected':{r:list(k) for r,k in selected.items()},'development':{keyname(k):v for k,v in errors.items()},'dev_worst':{keyname(k):v for k,v in dev_worst.items()},'weights':{keyname(k):weights[k].tolist() for k in set(selected.values())},'files':{}}
    for m,raw in read_raw(base,HELD):
        # The archive reader authenticates complete mixed-channel bytes. The predictor selects no nut samples.
        q=parse(raw,usecols=(1,2));assert np.isfinite(q).all()
        x=prep(q[:,1]);n=len(x[::10]);speed=q[::10,0]
        on=np.flatnonzero(np.convolve((abs(speed)>=.02).astype(np.int32),np.ones(50,dtype=np.int32),'valid')==50)
        if not len(on) or int(on[0])+500>n:raise ValueError('predeclared held exogenous onset missing')
        arms={'zero':np.zeros(n,dtype='<f4')}
        for key,z,_ in operators(x,m['beta']):
            for r,k in selected.items():
                if r!='source_geometry' and k[:-1]==key:arms[r]=use(z,weights[k]).astype('<f4')
        k=selected['source_geometry'];_,f,rho,ridge=k
        ker=echo_kernel(beta0,rho,fs=FS,fundamental=f,duration=(len(x)-1)/FS)
        zi=fftconvolve(x,ker)[:len(x):10]
        arms['source_geometry']=use(zi,weights[k]).astype('<f4')
        assert set(arms)==set(ROLES) and all(np.isfinite(a).all() for a in arms.values())
        name=f"stroke-{m['index']:02d}.npz";out=dest/name
        with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
            for r,array in sorted(arms.items()):
                b=io.BytesIO();np.lib.format.write_array(b,array,allow_pickle=False)
                entry=zipfile.ZipInfo(r+'.npy',date_time=(1980,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;z.writestr(entry,b.getvalue())
        meta['files'][name]={'source_member_sha256':m['sha256'],'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'rows_5k':n,'onset_5k':int(on[0]),'beta':m['beta']}
    (dest/'forecast-lock.json').write_text(json.dumps(meta,sort_keys=True,separators=(',',':'))+'\n')
    print(json.dumps({'roles':meta['selected'],'files':meta['files'],'development_mean':{r:float(np.mean(errors[k])) for r,k in selected.items()},'worst':{r:dev_worst[k] for r,k in selected.items()},'lock_sha256':hashlib.sha256((dest/'forecast-lock.json').read_bytes()).hexdigest()},sort_keys=True),flush=True)
if __name__=='__main__':produce(*sys.argv[1:])
