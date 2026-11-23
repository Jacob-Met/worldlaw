"""Thresholds are specified in protocol.json. This program never accesses the plotted oracle."""
import hashlib
import json
import os
from pathlib import Path
import numpy as np
from scipy.io import loadmat

import author_pattern
import comlas_author

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def peak_frequency(freq, amp, window):
    ids=np.flatnonzero((freq>=window[0])&(freq<=window[1]))
    k=ids[np.argmax(amp[ids])]
    if k==ids[0] or k==ids[-1] or not np.isfinite(amp[k]) or amp[k]<=0:
        raise ValueError('No interior finite positive band maximum')
    y=np.log(np.maximum(amp[k-1:k+2],np.finfo(float).tiny))
    d=y[0]-2*y[1]+y[2]
    offset=0.5*(y[0]-y[2])/d if d<0 else 0
    return float(freq[k]+offset*(freq[k+1]-freq[k]))

def centered_unit(a):
    a=a-a.mean(axis=-1,keepdims=True)
    n=np.linalg.norm(a,axis=-1,keepdims=True)
    if not np.all(n>0):raise ValueError('constant spectral shape')
    return a/n

def maxima_info(scores, shifts):
    k=np.argmax(scores)
    others=np.flatnonzero((scores[1:-1]>=scores[:-2])&(scores[1:-1]>scores[2:]))+1
    others=others[others!=k]
    return dict(shift=float(shifts[k]),score=float(scores[k]),boundary=bool(k in [0,len(shifts)-1]),
                competing_lobe_gap=float(scores[k]-scores[others].max()) if len(others) else None)

def calculate(t,x,y,w_early,w_late):
    assert y.shape==(len(x),len(t)) and np.isfinite(y).all()
    assert np.allclose(x,np.linspace(-.03,.03,301),rtol=0,atol=1.e-12)
    indexes=[np.flatnonzero((t>=lo)&(t<=hi)) for lo,hi in [(2e-8,8.172554347826087e-7),(1e-5,4.5e-5)]]
    assert [len(i) for i in indexes]==[len(w_early),len(w_late)]==[160,7000]
    dt=(t[-1]-t[0])/(len(t)-1)
    freq=np.fft.rfftfreq(131072,dt)
    bands=[(10.5e6,18.5e6),(1.05e6,1.85e6),(3.7e6,5.6e6)]
    subset=(freq>=.6e6)&(freq<6.5e6)
    freqs=freq[subset]
    peaks=[];late_spectra=[]
    for row in y:
        early,late=[abs(np.fft.rfft(row[ix]*w,131072)) for ix,w in zip(indexes,[w_early,w_late])]
        peaks.append([peak_frequency(freq,a,b) for a,b in zip([early,late,late],bands)])
        late_spectra.append(late[subset])
    peaks=np.array(peaks);late_spectra=np.array(late_spectra)
    u=np.arange(len(x))/300
    core=(u>=.42)&(u<=.58)
    center=np.median(peaks[core,1:],axis=0)
    axes=center[:,None]*np.exp(np.linspace(-.025,.025,161))
    templates=[];shift=np.arange(-500,501)*.00005
    grids=axes[:,None,:]*np.exp(shift)[None,:,None]
    for ax in axes:
        a=np.array([np.interp(ax,freqs,z) for z in late_spectra[core]])
        a=a/np.linalg.norm(a,axis=1,keepdims=True)
        templates.append(centered_unit(np.median(a,axis=0)))
    hvals=[]
    for i,(fr,f1,f2) in enumerate(peaks):
        by_mode=[]
        for g,tmp in zip(grids,templates):
            aligned=centered_unit(np.interp(g,freqs,late_spectra[i]))
            by_mode.append(aligned@tmp)
        fits=[maxima_info(z,shift) for z in [by_mode[0],by_mode[1],np.mean(by_mode,axis=0)]]
        formulas={key:comlas_author.invert(fr,f1,f2,key) for key in ['eq8','exact']}
        log=dict(constant=0.,peak1=-np.log(f1),peak2=-np.log(f2),peak_mean=-(np.log(f1)+np.log(f2))/2,
                 saw_peak1=np.log(fr/f1),saw_peak2=np.log(fr/f2),saw_peak_mean=np.log(fr)-(np.log(f1)+np.log(f2))/2,
                 line1=-fits[0]['shift'],line2=-fits[1]['shift'],line_mean=-(fits[0]['shift']+fits[1]['shift'])/2,
                 joint=-fits[2]['shift'])
        for k,v in formulas.items():log[k]=np.log(v[0]['h']) if len(v)==1 else None
        hvals.append(dict(i=i,x_m=float(x[i]),peaks_Hz=[fr,f1,f2],templates=fits,CoMLAS=formulas,log_h=log))
    return dict(grid_freq_centers_Hz=center.tolist(),n_reference=int(core.sum()),dt_s=float(dt),rows=hvals)

if __name__=='__main__':
    expected=json.loads((Path(__file__).parent/'protocol.json').read_text())['frozen_sources']
    root=Path(os.environ['WATZL_DATA'])
    raw=root/'AA7075_steps_demonstration.mat'
    assert digest(raw)==expected['scan'] and digest(Path(__file__).parent/'protocol.json')=='51fbc9e035df9f3de2e9a13b1a64dd2c5c8aac7cfbf2ee81d050355c18eb188d'
    pattern=author_pattern.inventory()[14]
    data=loadmat(raw,variable_names=['traces','t_vec','x_vec'],squeeze_me=True)
    forecast=calculate(data['t_vec'],data['x_vec'],data['traces'],*[author_pattern.read_numeric(pattern[k]) for k in ['win_saw','win_S1S2']])
    forecast['inputs']={k:v for k,v in expected.items() if k not in ('paper','source_parity')}
    p=Path('wave-forecast.json');p.write_text(json.dumps(forecast,separators=(',',':'),allow_nan=False)+'\n')
    print('FORECAST_LOCK',p.resolve(),p.stat().st_size,digest(p),flush=True)
