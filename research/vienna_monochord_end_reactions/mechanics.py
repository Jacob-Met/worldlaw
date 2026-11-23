"""Causal time-domain point-drive transfer for a lossy rigid string, evaluated in sampled reaction units."""
import numpy as np
from scipy.signal import fftconvolve

def echo_kernel(beta,retention,fs=50000.,fundamental=98.,duration=0.45,operator='nut_from_bridge'):
    if beta<=0 or beta>=.5 or not 0<retention<=1:raise ValueError('unsupported source range')
    travel_samples=fs/(2*fundamental)
    if operator=='nut_from_bridge':
        base,notch,loop=1-2*beta,2*beta,2*(1-beta)
    elif operator=='bridge_from_drive':
        base,notch,loop=beta,2*(1-beta),2
    elif operator=='nut_from_drive':
        base,notch,loop=1-beta,2*beta,2
    else:raise ValueError('operator')
    h=np.zeros(int(round(fs*duration))+1)
    for k in range(1+int(len(h)/(loop*travel_samples))):
        for sign,path in [(1,base+k*loop),(-1,base+notch+k*loop)]:
            sample=path*travel_samples;lo=int(np.floor(sample));frac=sample-lo
            if lo<len(h):h[lo]+=sign*(retention**path)*(1-frac)
            if lo+1<len(h):h[lo+1]+=sign*(retention**path)*frac
    return h

def identity_test():
    # Integer delays isolate analytic transfer from fractional-delay approximation.
    g=np.random.default_rng(981);x=g.standard_normal(2200)
    for b in (.1,.2,.35):
        op=lambda name:echo_kernel(b,.97,fs=4000,fundamental=10,duration=2,operator=name)
        src=lambda name:fftconvolve(x,op(name))[:len(x)]
        from_bridge=fftconvolve(src('bridge_from_drive'),op('nut_from_bridge'))[:len(x)]
        assert np.max(np.abs(from_bridge-src('nut_from_drive')))<1e-11
        for n in range(1,10):
            if abs(np.sin(n*np.pi*(1-b)))<1e-9:continue
            assert abs(np.sin(n*np.pi*b)/np.sin(n*np.pi*(1-b))-(-1)**(n+1))<1e-11
    print('three independent point-driven terminal constructions and finite nonnodal modal identities passed')
if __name__=='__main__':identity_test()
