"""Source-only implementation of Schwab et al.'s released force-to-angle FIR.

Lags and taper indices follow RiderID/firestimation.m. The implicit Gram
routine reproduces the zero extension in the author's markovparm2.m.
"""
import numpy as np
from scipy import signal
from scipy.linalg import solve

def force_sign(run_id):
    return -1.0 if int(run_id) == 184 else 1.0

def author_prefilter(force, angles):
    force = np.asarray(force, dtype=float)
    angles = np.asarray(angles, dtype=float)
    n = len(force)
    indices = np.flatnonzero(np.abs(force) > 50)
    if not len(indices):
        raise ValueError('the released prefilter requires at least one >50 N event')
    # Translate inclusive MATLAB indices to a Python half-open slice.
    first, last = int(indices[0] + 1), int(indices[-1] + 1)
    low = first + 100 if first - 1024 <= 1 else 1
    high = last - 100 if last + 1024 >= n else n
    u = force[low-1:high].copy()
    y = angles[low-1:high].copy()
    if len(u) < 1025: raise ValueError('too few samples for the released drift fit')
    y -= y.mean(axis=0)
    w1 = u[:1024].mean()
    w2 = u[-1025:].mean()
    u -= np.linspace(w1,w2,len(u))
    return u,y

def markov_sufficient(u, y, lags):
    u = np.asarray(u,dtype=float)
    y = np.asarray(y,dtype=float)
    lags = np.asarray(lags,dtype=int)
    if y.ndim != 2 or len(y) != len(u) or not np.all(np.diff(lags)==1):
        raise ValueError('expected one force trace, matching angles, contiguous lags')
    n, m = len(u), len(lags)
    if m >= n: raise ValueError('design must contain more rows than lags')
    mat = np.empty((m,m))
    ii = np.arange(m)
    for d in range(m):
        i = ii[:m-d]
        j = i+d
        pref = np.r_[0.,np.cumsum(u[:n-d]*u[d:])]
        lo = np.maximum(0,-lags[j])
        end = np.minimum(n-d,n-lags[j])
        val = pref[end]-pref[lo]
        mat[i,j]=val
        mat[j,i]=val
    rhs = np.column_stack([signal.correlate(y[:,k],u,mode='full',method='fft')[n-1+lags] for k in range(y.shape[1])])
    return mat,rhs

def author_kernel(u,y,fs):
    lags = np.arange(-256,769,dtype=int)
    gram,rhs = markov_sufficient(u,y,lags)
    # A linear solve returns the released MATLAB normal-equation solution.
    unfiltered=solve(gram,rhs,assume_a='sym')*fs
    b,a=signal.butter(4,.05)
    # MATLAB filtfilt uses reflection padding by 3*(max(len(a),len(b))-1).
    smoothed=signal.filtfilt(b,a,unfiltered,axis=0,padlen=3*(max(len(a),len(b))-1))
    taper=(lags>0).astype(float)
    taper[-65:]=0
    # MATLAB win((m2+1:end)-64) writes indices 705:961.
    taper[704:961]=.5*(1+np.cos(np.arange(257)*np.pi/256))
    return smoothed[256:]*taper[256:,None]/fs

def replay_kernel(u, kernel):
    return np.column_stack([signal.oaconvolve(u,kernel[:,i])[:len(u)] for i in range(kernel.shape[1])])

def synthetic_check():
    rng=np.random.default_rng(4215)
    worst=0.
    for n,a,b in ((79,-9,16),(431,-31,48),(1097,-80,126)):
        lags=np.arange(a,b+1)
        u=rng.normal(size=n)
        y=rng.normal(size=(n,2))
        idx=np.arange(n)[:,None]-lags[None,:]
        X=np.where((idx>=0)&(idx<n),u[np.clip(idx,0,n-1)],0.)
        mat,rhs=markov_sufficient(u,y,lags)
        eps=max(np.max(np.abs(mat-X.T@X)),np.max(np.abs(rhs-X.T@y)))
        worst=max(worst,float(eps))
        assert np.allclose(mat,X.T@X,atol=2e-10,rtol=1e-12)
        assert np.allclose(rhs,X.T@y,atol=2e-10,rtol=1e-12)
    return worst

if __name__=='__main__':print('literal synthetic normal-matrix maximum absolute error', synthetic_check())
