"""Retain the raw 32 donor phasors at the worst preselected-estimator row per held source."""
import cmath
import itertools
import math
import numpy as np
import h5py

def read_neighborhood(path,xyz,frequency):
    first=list(itertools.product((-1,0,1),repeat=3)); first.remove((0,0,0))
    more=[tuple(2*x for x in p) for p in first if sum(x*x for x in p)==1]
    phase=np.array([cmath.exp(-2j*math.pi*frequency*i/48000) for i in range(4800)])
    with h5py.File(path) as f:
        grid=f["grid"][:].T
        keys={tuple(round(float(t)*50) for t in v):i for i,v in enumerate(grid)}
        result=[]
        for p in [(0,0,0)]+first+more:
            pos=tuple(a+2*b for a,b in zip(xyz,p)); idx=keys[pos]
            signal=f["rir"][idx,:].astype(float)
            z=complex(np.dot(signal,phase))
            result.append(dict(offset=list(p),grid_row=idx,value=[z.real,z.imag],
                               first_sample=float(signal[0]),last_sample=float(signal[-1]),
                               full_rms=float(np.sqrt(np.mean(signal**2))),
                               tail_48_rms=float(np.sqrt(np.mean(signal[-48:]**2)))))
    return result
