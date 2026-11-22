"""Audit source-defined first-arrival windows over every released calibration recording."""
import argparse,hashlib,io,json,re,zipfile
from pathlib import Path
import numpy as np
from scipy.optimize import brentq
from scipy.signal import butter,detrend,filtfilt,find_peaks

STATIONS=[8,10,12,14,16,16.3,18,20]


def regime(h,u,t):
    x=h/(9.81*t*t);y=u/(9.81*t*t);m=4*np.pi**2*x
    mu=m*(1+m**1.09*np.exp(-(1.55+1.3*m+.216*m*m)))/np.sqrt(np.tanh(m))
    fac=x*np.tanh(mu)/mu;bd=x**3*26*4*np.pi**2/np.tanh(mu)**2
    for i,mult in enumerate([.04,.366,.6215,.837,7*np.pi/25],1):
        if y<=mult*fac and (i<2 or y<=bd) and (i<4 or y<.78*x) and (i!=5 or y<=.14/(2*np.pi)):return i
    if y<=.78*x and y>=bd:return 7
    return 0


def named_condition(n):
    m=re.fullmatch(r'h(\d+)T([\d.]+)H(\d+)(?:P\d+)?',n)
    h,t,u=map(float,m.groups())
    return h/1000,t/100 if t>5 else t,u/1000


def spaced_peaks(y,t,period,prominence,height=None):
    peaks,_=find_peaks(y,prominence=prominence,height=height)
    keep=[]
    for i in sorted(peaks,key=lambda i:(-y[i],i)):
        if all(abs(t[i]-t[j])>=.8*period for j in keep):keep.append(int(i))
    return np.array(sorted(keep),dtype=int)


def generated_stop(t,start,T,x,c,x_paddle):
    first=2*T
    cutoff=t[start]-first+2*(24-x)/c
    i=int(np.searchsorted(t,cutoff,side='right'))
    while i<start:
        first-=T;cutoff=t[start]-first+2*(24-x_paddle-x)/c
        i=int(np.searchsorted(t,cutoff,side='right'))
    return min(i,len(t)-1)


def one_signal(t,y,T,H,x,c,order,x_paddle=1):
    if not np.isfinite(y).all() or np.ptp(y)==0:return {'status':'missing_or_flat_recorded_channel'}
    if not order:return {'status':'unsupported_breaking_class'}
    fs=1/np.mean(np.diff(t))
    freq=np.fft.rfftfreq(len(t),d=1/fs);spec=np.abs(np.fft.rfft(y))/len(t)
    peaks,_=find_peaks(spec,prominence=.1)
    peak_freq=freq[peaks[np.argmax(spec[peaks])]] if len(peaks) else 1/T
    cutoff=peak_freq*min(order,4)*1.5
    if cutoff<1.5:cutoff=2.
    if cutoff>=fs/2:return {'status':'source_filter_beyond_nyquist'}
    ba=butter(4,cutoff/(fs/2))
    smooth=filtfilt(*ba,y,padlen=3*(max(map(len,ba))-1))
    initial=spaced_peaks(smooth,t,T,3)
    if not len(initial):return {'status':'no_offset_peak'}
    usable=t<t[initial[0]]-T
    offset=float(smooth[usable].mean()) if np.any(usable) else smooth-detrend(smooth)
    centered=smooth-offset
    peaks=spaced_peaks(centered,t,T,.7,.25*H*1000)
    if len(peaks)<3:return {'status':'fewer_than_three_height_peaks','peaks':len(peaks)}
    tol=.08 if T>2 or T<.7 else .05
    selected=None
    for i in range(len(peaks)-2):
        vals=centered[peaks[i:i+3]];mu=vals.mean()
        if np.all(np.abs(vals-mu)<tol*mu):selected=i;break
    fallback=selected is None
    if fallback:selected=0
    first=int(np.searchsorted(t,t[peaks[0]]-.25*T));start=int(np.searchsorted(t,t[peaks[selected]]-.25*T))
    stop=generated_stop(t,start,T,x,c,x_paddle)
    early_stop=generated_stop(t,first,T,x,c,x_paddle)
    out={'status':'window','source_start_s':float(t[start]),'source_stop_s':float(t[stop]),'first_threshold_s':float(t[first]),
         'earliest_threshold_return_s':float(t[early_stop]),'first_to_stable_s':float(t[start]-t[first]),'source_fallback_to_first_crest':fallback}
    for label,end in [('source',stop),('first_crest_return',min(stop,early_stop))]:
        cycles=float((t[end]-t[start])/T)
        item={'cycles':cycles,'rows':max(0,end-start+1),'qualified':False}
        if cycles>=1.8:
            tt=t[start:end+1]-t[start];phase=2*np.pi*tt/T
            X=np.column_stack([np.ones(len(tt)),*[f(k*phase) for k in (1,2,3) for f in (np.cos,np.sin)]])
            coef,_,rank,sing=np.linalg.lstsq(X,y[start:end+1],rcond=None)
            item.update(rank=int(rank),cond=float(sing[0]/sing[-1]),qualified=bool(rank==7))
            if rank==7:
                p=np.arange(4096)*2*np.pi/4096;z=sum(coef[2*k-1]*np.cos(k*p)+coef[2*k]*np.sin(k*p) for k in (1,2,3))
                item['harmonic_peak_to_trough_mm']=float(z.max()-z.min())
        out[label]=item
    return out


def audit(path):
    r={}
    with zipfile.ZipFile(path) as source:
        names=sorted(n for n in source.namelist() if n.endswith('.csv'))
        if len(names)!=390:raise ValueError('Incomplete raw calibration file roster')
        for n in names:
            name=Path(n).stem;h,T,H=named_condition(name);order=regime(h,H,T)
            raw=source.read(n);z=np.genfromtxt(io.BytesIO(raw),delimiter='\t',usecols=range(9),invalid_raise=True)
            if z.ndim!=2 or z.shape[1]!=9:raise ValueError('Unexpected nine projected columns '+name)
            ticks=z[:,0];reversals=np.flatnonzero(np.diff(ticks)<0)
            if len(reversals):ticks=ticks.copy();ticks[reversals[0]+1:]+=2**32
            t=(ticks-ticks[0])/1e6;v={'rows':len(t),'ticks_reversals':len(reversals),'raw_sha256':hashlib.sha256(raw).hexdigest(),'stations':{}}
            if np.isfinite(t).all() and np.all(np.diff(t)>0):
                dt=np.diff(t);v.update(rate_hz=float(1/np.mean(dt)),median_dt_s=float(np.median(dt)),max_dt_s=float(max(dt)))
                w=2*np.pi/T;k=brentq(lambda k:9.81*k*np.tanh(k*h)-w*w,1e-8,2000.);c=w/k
                for i,x in enumerate(STATIONS):v['stations'][str(x)]=one_signal(t,z[:,i+1],T,H,x,c,order)
            else:v['clock_refusal']=True
            r[name]=v
    return r


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('training',type=Path);p.add_argument('out',type=Path);a=p.parse_args()
    with a.out.open('x') as f:json.dump(audit(a.training),f,sort_keys=True,allow_nan=False)
