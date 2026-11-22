"""Positive release-rate quadrature and finite-capacity updates for scheduled WFC3 stimuli."""
import hashlib
import math
import re
import numpy as np

EXPECTED_SHA = "4fb2c770d8d7eba4f09bb61a3466d1442af9f765b7b72e8d76141f4ec74df27d"
TAU_FAST = 8.0
TAU_SLOW = 7 * 86400.0
N_BINS = 48
edges = np.linspace(np.log(1/TAU_SLOW), np.log(1/TAU_FAST), N_BINS+1)
RATES = np.r_[1/(2*TAU_SLOW), np.exp((edges[:-1]+edges[1:])/2)]
WIDTH = float(edges[1]-edges[0])
FIT_TIMES = (100.0,60000.0)


def read_agamma(payload):
    """Read the literal scalar FITS binary tables. Preserve all signs and table rows."""
    assert hashlib.sha256(payload).hexdigest() == EXPECTED_SHA
    pos = 0
    exposures, rows = [], []
    while pos < len(payload):
        h = {}
        done = False
        while not done:
            block=payload[pos:pos+2880]
            assert len(block)==2880
            pos+=2880
            for i in range(0,2880,80):
                c=block[i:i+80].decode()
                if c[:8].strip()=="END":
                    done=True
                    break
                if c[8:10]=="= ":
                    s=c[10:].lstrip()
                    h[c[:8].strip()]=re.match(r"'((?:[^']|'')*)'",s)[1].strip() if s.startswith("'") else s.split("/")[0].strip()
        if int(h["NAXIS"])==0:
            continue
        assert h["XTENSION"]=="BINTABLE"
        fields=[(h["TTYPE"+str(i)].lower(),h["TFORM"+str(i)].upper()) for i in range(1,int(h["TFIELDS"])+1)]
        assert all(v in {"E","1E"} for _,v in fields)
        dtype=np.dtype([(k,">f4") for k,v in fields])
        assert dtype.itemsize==int(h["NAXIS1"])
        n=int(h["NAXIS2"])
        a=np.frombuffer(payload,dtype=dtype,offset=pos,count=n)
        exposures.append(float(h["EXP"]))
        rows.append(tuple(a[k].astype(np.float64) for k in ("stim","a","gamma")))
        size=n*dtype.itemsize
        pos+=(size+2879)//2880*2880
    assert pos==len(payload) and all(np.array_equal(rows[0][0],r[0]) for r in rows)
    return np.asarray(exposures),rows[0][0],np.asarray([r[1] for r in rows]),np.asarray([r[2] for r in rows])


def exposure_weights(grid,duration):
    if duration<=grid[0]:return [(0,1.)]
    if duration>=grid[-1]:return [(len(grid)-1,1.)]
    hi=int(np.searchsorted(grid,duration))
    w=(duration-grid[hi-1])/(grid[hi]-grid[hi-1])
    return [(hi-1,1-w),(hi,w)]


def exact_curve(params,duration,age,fluence):
    grid,stim,amplitude,gamma=params
    curve=sum(w*amplitude[k]*(age/1000.)**(-gamma[k]) for k,w in exposure_weights(grid,duration))
    return np.interp(fluence,stim,curve,left=0.,right=0.)


def quadrature(amplitude,gamma):
    """A single positive t^-gamma response. Outputs rates at pulse end in electrons/second."""
    if np.any(amplitude < 0) or np.any(gamma <= 0):
        raise ValueError("Signed/increasing table slice lacks the stipulated positive representation")
    lg=np.array([math.lgamma(float(g)) for g in gamma])
    slow=amplitude*np.exp(gamma*np.log(1000./TAU_SLOW)-lg-np.log(gamma))
    terms=amplitude[None,:]*np.exp(gamma[None,:]*np.log(1000.*RATES[1:,None])-lg[None,:])*WIDTH
    return np.vstack((slow,terms))


def knot_weights(params,duration):
    grid,stim,amplitude,gamma=params
    return sum(w*quadrature(amplitude[k],gamma[k]) for k,w in exposure_weights(grid,duration))


def stimulus_rates(params,duration,fluence):
    knots=knot_weights(params,duration)
    return np.stack([np.interp(fluence,params[1],r,left=0.,right=0.) for r in knots])


def elapsed(state,seconds):
    if seconds < 0: raise ValueError("Nonchronological exposure endpoint")
    return state*np.exp(-RATES[:,None]*seconds)


def charge(state):
    return (state/RATES[:,None]).sum(axis=0)


def write_pulse(state,pulse,cap):
    """State and pulse are release rates. Per-mode charge capacities are cap/rate."""
    cap=np.asarray(cap,dtype=np.float64).reshape(-1,1)
    if np.any(cap<=0) or np.any(pulse<0) or np.any(pulse>cap*(1+1e-12)) or np.any(state<0) or np.any(state>cap*(1+1e-12)):
        raise ValueError("Capacity or signed-state contract violated")
    return state+pulse*(1-state/cap)


def mass_released(state,dt):
    return (state*(-np.expm1(-RATES[:,None]*dt))/RATES[:,None]).sum(axis=0)
