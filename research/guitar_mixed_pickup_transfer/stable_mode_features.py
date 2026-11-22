"""Shared dominant-periodic-frame measurement. The original early extractor remains separate."""
import numpy as np
from mode_features import RATE,N_MODES,PITCH,decode,setup


def rolling_sum(x,n,starts):
    cs=np.r_[0.,np.cumsum(x,dtype=float)]
    return cs[starts+n]-cs[starts]


def subbin(i,p):
    y=np.log(np.maximum(p[i-1:i+2],1e-300));den=y[0]+y[2]-2*y[1]
    return float(np.clip(.5*(y[0]-y[2])/den,-.5,.5)) if den<-1e-12 else 0.


def features(raw,string):
    x=raw-np.median(raw[:,:512],axis=1)[:,None]
    energy=np.sum(x*x,axis=0)
    grid=np.arange(0,len(energy)-int(.25*RATE)+1,64,dtype=int)
    assert len(grid)>0
    start25=grid[np.argmax(rolling_sum(energy,int(.25*RATE),grid))]
    seg=x[:,start25:start25+int(.25*RATE)]*np.hanning(int(.25*RATE));freq=np.fft.rfftfreq(65536,1/RATE)
    power=(abs(np.fft.rfft(seg,65536,axis=1))**2).sum(axis=0);n=PITCH[string-1]
    ids=np.flatnonzero((freq>.955*n)&(freq<1.045*n));i=ids[np.argmax(power[ids])]
    assert i not in (ids[0],ids[-1]),('fundamental outside calibrated band',string,i)
    f0=(i+subbin(i,power))*RATE/65536;period=round(RATE/f0);window=round(12*RATE/f0)
    grid=np.arange(0,len(energy)-window+1,64,dtype=int)
    amp=rolling_sum(energy,window,grid)
    lagprod=np.sum(x[:,:-period]*x[:,period:],axis=0)
    pairs=window-period
    left=rolling_sum(energy,pairs,grid);right=rolling_sum(energy,pairs,grid+period)
    corr=rolling_sum(lagprod,pairs,grid)/np.maximum(np.sqrt(np.maximum(left*right,0)),1e-24)
    # Half-maximum RMS and lag-period correlation are measured in the same
    # 12-cycle frame. Select the greatest energy, breaking exact ties by time.
    eligible=np.flatnonzero((amp>=.25*amp.max())&(corr>=.80))
    if not len(eligible):raise ValueError(('no stable tone',string,float(corr[amp>=.25*amp.max()].max())))
    best=eligible[np.argmax(amp[eligible])];start=int(grid[best]);frame=x[:,start:start+window]
    win=np.hamming(window);nfft=1<<int(np.ceil(np.log2(max(8*window,4096))));freq=np.fft.rfftfreq(nfft,1/RATE)
    p=np.sum(abs(np.fft.rfft(frame*win,nfft,axis=1))**2,axis=0);t=np.arange(window)/RATE
    locations=[];out=[]
    for h in range(1,N_MODES+1):
        center=h*f0;span=min(.38*f0,max(.16*f0,.018*center));band=np.flatnonzero(abs(freq-center)<=span)
        i=band[np.argmax(p[band])];f=(i+subbin(i,p))*RATE/nfft;locations.append(f)
        out.append((frame*win)@np.exp(-2j*np.pi*f*t)*(2/win.sum()))
    return np.array(out).T,{'start':start,'window':window,'f0_Hz':f0,'peak_Hz':locations,'lag_correlation':float(corr[best]),
        'relative_to_greatest_RMS':float(np.sqrt(amp[best]/amp.max())),'eligible_windows':len(eligible),'length':len(energy)}


def single_case(src,s,j):
    data=[decode(src,f'string-{s}/{j}/{p:02d}.wav') for p in (1,2,3)]
    y,clock=zip(*data)
    assert len(set(clock))==1 and len({len(a) for a in y})==1
    z,meta=features(np.stack(y),s);meta['bwf_time_reference']=list(clock);return z,meta


def mixed_case(src,s,j,pick):
    assert pick in (4,5)
    y,c=decode(src,f'string-{s}/{j}/{pick:02d}.wav')
    z,meta=features(y[None,:],s);meta['bwf_time_reference']=c;return abs(z[0]),meta
