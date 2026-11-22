"""Inspect actual early amplitudes and periodic signal build-up in development extremes."""
import json
import numpy as np
from mode_features import decode,features,setup,PITCH,RATE,onset


def window(y,center,f0):
    n=int(round(12*RATE/f0));start=int(center)
    x=y[start:start+n]
    if len(x)<n:return None
    t=np.arange(n)/RATE;w=np.hamming(n)
    modes=abs(np.exp(-2j*np.pi*f0*np.arange(1,26)[:,None]*t[None,:])@(w*x))*2/w.sum()
    nper=round(RATE/f0);l=x[:-nper];r=x[nper:]
    return {'start':start,'rms_fs':float(np.mean(x*x)**.5),'period_correlation':float(l@r/max(np.linalg.norm(l)*np.linalg.norm(r),1e-24)),
        'h1_fs':float(modes[0]),'h6_fs':float(modes[5]),'h6_dB':float(20*np.log10(max(modes[5]/max(modes),.001)))}


def run():
    src=setup();results={}
    for s,j,p in [(2,1,5),(5,1,5),(6,1,4),(2,5,5)]:
        for pick in [1,2,3,p]:
            y,_=decode(src,f'string-{s}/{j}/{pick:02d}.wav')
            z,m=features(y[None,:],s)
            f=m['f0_Hz'];start=m['onset_sample']
            n=len(y)//256;pow=np.mean(y[:n*256].reshape(n,256)**2,axis=1)
            peak=np.argmax(pow)*256;period=RATE/f
            # Locations are fixed relative to the first detected event or peak.
            points=[start+round(k*period) for k in (0,2,8,20,40,80)]
            points+= [int(peak)]
            out={'native_first_index':start,'f0_Hz':f,'duration':len(y)/RATE,'peak_energy_time':int(peak)/RATE,
                 'native_first_samples':y[start:start+12].tolist(),'rms_first_to_max':float(np.sqrt(np.mean(y[start:start+256]**2)/pow.max())),
                 'windows':[window(y,i,f) for i in points], 'relative_25_dB':(20*np.log10(np.maximum(abs(z[0])/abs(z[0]).max(),.001))).tolist()}
            results[f'{s}/{j}/{pick}']=out
    print(json.dumps(results,sort_keys=True))
if __name__=='__main__':
    run()
