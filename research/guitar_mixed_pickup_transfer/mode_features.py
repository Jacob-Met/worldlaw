"""Read source-bound DI PCM and measure normalized partials; no inter-take phase matching."""
import hashlib
import io
import json
import struct
import time
import urllib.request
from pathlib import Path

import numpy as np

ROOT=Path(__file__).resolve().parent
PITCH=np.array([329.627557,246.941651,195.997718,146.832384,110.,82.406889])
N_MODES=25
RATE=44100
SETUP_SHA='73c68dbd7dfa41a1f9ce7b43846aa7de068cf0d1ce38b4e71751b695f33a897b'


def setup():
    b=(ROOT/'source-registration.json').read_bytes()
    assert hashlib.sha256(b).hexdigest()==SETUP_SHA
    return json.loads(b)['source']


def decode(record,path):
    expected,n=record['roster'][path]
    url=f"https://media.githubusercontent.com/media/ZulfadhliM/electric-guitar-samples/{record['commit']}/{path}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url+'?whole='+expected,timeout=45) as response:
                data=response.read(n+1)
            assert len(data)==n and hashlib.sha256(data).hexdigest()==expected
            break
        except (TimeoutError,urllib.error.URLError):
            if attempt==2:raise
            time.sleep(1+attempt)
    assert data[:4]==b'RIFF' and data[8:12]==b'WAVE' and struct.unpack_from('<I',data,4)[0]+8==n
    at=12;clock=None;fmt=None;sound=None
    while at+8<=n:
        tag,size=struct.unpack_from('<4sI',data,at);start=at+8
        assert start+size<=n
        if tag==b'bext':
            assert size>=346
            clock=struct.unpack_from('<Q',data,start+338)[0]
        elif tag==b'fmt ':
            fmt=struct.unpack_from('<HHIIHH',data,start)
        elif tag==b'data':
            assert sound is None
            sound=memoryview(data)[start:start+size]
        at=start+size+(size%2)
    assert fmt==(1,1,RATE,3*RATE,3,24) and sound is not None and len(sound)%3==0 and clock is not None
    p=np.frombuffer(sound,dtype=np.uint8).reshape(-1,3).astype(np.int32)
    u=p[:,0]+(p[:,1]<<8)+(p[:,2]<<16)
    x=((u^0x800000)-0x800000).astype(np.float64)/(1<<23)
    return x,clock


def onset(signal):
    # Use one common origin for all synchronized single pickups. The target
    # mixed take has its own physical event and its own measurement origin.
    block=64
    n=signal.shape[1]//block
    power=np.mean(signal[:,:n*block].reshape(len(signal),n,block)**2,axis=(0,2))
    assert np.isfinite(power).all() and power.max()>1e-14
    active=power>=.0016*power.max()
    return int(np.argmax(active))*block


def features(signal,string):
    assert signal.ndim==2 and np.isfinite(signal).all()
    signal=signal-np.median(signal[:,:min(signal.shape[1],512)],axis=1)[:,None]
    first=onset(signal);nominal=PITCH[string-1]
    segment=signal[:,first+int(.015*RATE):first+int(.265*RATE)]
    assert segment.shape[1]==int(.265*RATE)-int(.015*RATE)
    nfft=65536
    freq=np.fft.rfftfreq(nfft,1/RATE)
    spec=(abs(np.fft.rfft(segment*np.hanning(segment.shape[1]),nfft,axis=1))**2).sum(axis=0)
    eligible=np.flatnonzero((freq>.955*nominal)&(freq<1.045*nominal));k=eligible[np.argmax(spec[eligible])]
    def frac(idx,p):
        y=np.log(np.maximum(p[idx-1:idx+2],1e-300));den=y[0]+y[2]-2*y[1]
        return float(np.clip(.5*(y[0]-y[2])/den,-.5,.5)) if den<-1e-12 else 0.
    f0=(k+frac(k,spec))*RATE/nfft
    half=int(round(12*RATE/f0));start=first+int(round(2*RATE/f0))
    frame=signal[:,start:start+half]
    assert frame.shape[1]==half
    win=np.hamming(half);nfft=1<<int(np.ceil(np.log2(max(8*half,4096))))
    freq=np.fft.rfftfreq(nfft,1/RATE)
    p=np.sum(abs(np.fft.rfft(frame*win,n=nfft,axis=1))**2,axis=0)
    modes=[];values=[];t=np.arange(half)/RATE
    for h in range(1,N_MODES+1):
        center=h*f0;span=min(.38*f0,max(.16*f0,.018*center))
        band=np.flatnonzero(abs(freq-center)<=span);k=band[np.argmax(p[band])]
        loc=(k+frac(k,p))*RATE/nfft;modes.append(loc)
        values.append((frame*win)@np.exp(-2j*np.pi*t*loc)*(2/win.sum()))
    out=np.array(values).T
    return out,{'f0_Hz':f0,'onset_sample':first,'start':start,'window':half,'peak_Hz':modes,'length':signal.shape[1],'count_channels':len(signal),'abs_peak_fullscale':abs(signal).max(axis=1).tolist()}


def single_case(src,s,j):
    arrays=[];clocks=[]
    for pick in (1,2,3):
        y,b=decode(src,f'string-{s}/{j}/{pick:02d}.wav');arrays.append(y);clocks.append(b)
    assert len(set(clocks))==1 and len({len(y) for y in arrays})==1,(s,j,clocks)
    z,meta=features(np.stack(arrays),s);meta['bwf_time_reference']=clocks
    return z,meta


def mixed_case(src,s,j,pick):
    assert pick in (4,5)
    y,clock=decode(src,f'string-{s}/{j}/{pick:02d}.wav')
    z,meta=features(y[None,:],s);meta['bwf_time_reference']=clock
    return abs(z[0]),meta
