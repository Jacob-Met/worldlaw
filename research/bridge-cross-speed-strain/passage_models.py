"""Passage-conditioned quasi-static, modal and empirical histories of axle loading."""
import numpy as np
from scipy.signal import cont2discrete, lfilter
from bridge_source import WEIGHTS

# Signed position increases to the east, opposite the vehicle motion.
DX=2.0
CENTRES=np.arange(-7.,83.+DX,DX)
AXLES=np.array([.96,5.46,6.81])
DT=.005
MODES=((3.00348,.0206537),(3.845675,.0443589))  # Pre-test median frequency (Hz), damping (fraction).


def cubic_bumps(station):
    r=np.abs((station[:,None]-CENTRES)/DX)
    return (np.maximum(2-r,0)**3-4*np.maximum(1-r,0)**3)/6


def point_load_shape(t,clock,load):
    position=clock['range_intercept']-25.-clock['speed']*t
    mass=np.array(WEIGHTS[load])/10000.
    return sum(m*cubic_bumps(position+a) for m,a in zip(mass,AXLES))


def shift_samples(x,k):
    out=np.zeros_like(x)
    if k<len(out):
        out[k:]=x[:-k] if k else x
    return out


def oscillator_response(x,hz,damping):
    omega=2*np.pi*hz
    b,a,_=cont2discrete(([omega**2],[1,2*damping*omega,omega**2]),DT,method='zoh')
    return lfilter(b.ravel(),a,x,axis=0)


def design(grid,clock,load,family):
    x=point_load_shape(grid,clock,load)
    if family=='static_axles':
        return x
    if family=='modal_axles':
        return np.column_stack([x]+[oscillator_response(x,f,damping)-x for f,damping in MODES])
    velocity=clock['speed']/5.6
    if family=='speed_axles':
        return np.column_stack((x,velocity*x,velocity**2*x))
    if family=='empirical_history':
        lags=(.025,.05,.1,.15,.20,.25,.325,.4,.5,.625,.8,1.0,1.25,1.5)
        return np.column_stack([x]+[shift_samples(x,round(s/DT))-x for s in lags])
    if family=='empirical_modes':
        # An empirical spatial curve for each load with the same two temporal poles.
        pos=clock['range_intercept']-25.-clock['speed']*grid
        basis=cubic_bumps(pos)
        basis=np.column_stack((basis,np.zeros_like(basis))) if load=='loaded' else np.column_stack((np.zeros_like(basis),basis))
        return np.column_stack([basis]+[oscillator_response(basis,f,damping)-basis for f,damping in MODES])
    if family=='own_load_profile':
        pos=clock['range_intercept']-25.-clock['speed']*grid
        basis=cubic_bumps(pos)
        return np.column_stack((basis,np.zeros_like(basis))) if load=='loaded' else np.column_stack((np.zeros_like(basis),basis))
    raise ValueError('Unregistered model family')


def whole_grid(clock):
    # Zero-input prehistory begins ahead of every spatial basis support, independent of whether
    # the recorded signals contain the full approach. Tail covers the declared endpoint +2 s.
    start=min(clock['optical_trace_start_s'],(clock['range_intercept']-25.-(CENTRES[-1]+7*DX))/clock['speed'])-2.
    stop=max(clock['optical_trace_end_s'],clock['last_axle_west_s']+2.0)+DT
    return np.arange(np.floor(start/DT),np.ceil(stop/DT)+1,dtype=np.float64)*DT


def lerp_rows(grid,bank,t):
    index=np.clip((t-grid[0])/DT,0,len(grid)-1)
    lo=np.minimum(index.astype(np.int64),len(grid)-2)
    a=index-lo
    return bank[lo]*(1-a[:,None])+bank[lo+1]*a[:,None]


def target_slices(t,clock):
    # A passage may start late. Use the common recorded optical interval. Baseline is temporal
    # change relative to the same fixed first 0.5 s of this interval for truth and prediction.
    lo=max(clock['optical_trace_start_s'],clock['first_axle_east_s']-2.)
    hi=min(clock['optical_trace_end_s'],clock['last_axle_west_s']+2.)
    if hi-lo<.5:raise ValueError('Insufficient observed interval')
    valid=(t>=lo)&(t<=hi)
    base=valid&(t<lo+.5)
    if valid.sum()<10 or base.sum()<2:raise ValueError('Insufficient observed strain on fixed interval')
    return valid,base,(lo,hi)


def independent_case_norm(x,y):
    # Every acquisition case contributes one mean squared loss regardless of duration.
    n=len(y)
    return x.T@x/n,x.T@y/n


def ridge_fit(gram,cross,lam):
    positive=np.diag(gram)>1e-14
    if not np.any(positive):raise ValueError('No excited features')
    scale=np.sqrt(np.diag(gram)[positive])
    g=gram[np.ix_(positive,positive)]/np.outer(scale,scale)
    b=cross[positive]/scale
    coef=np.zeros(len(cross))
    coef[positive]=np.linalg.solve(g+lam*np.eye(len(b)),b)/scale
    return coef


def profile_predictor(data,clocks,training,channel,weight,mode):
    """Average aligned observed training curves, following the authors' station-profile check."""
    selected=[case for case in training if case.startswith(weight+'/') and
              (('Crawling_' in case) if mode=='mean_crawl' else ('/5.6_' in case))]
    station_grid=np.arange(-20.,91.,.5)
    curves=[]
    for label in selected:
        times,values=observed_channel(data,clocks[label],label,channel)
        valid,ref,_=target_slices(times,clocks[label])
        position=clocks[label]['range_intercept']-25.-clocks[label]['speed']*times[valid]
        value=values[valid]-np.mean(values[ref])
        curves.append(np.interp(station_grid,position[::-1],value[::-1],left=np.nan,right=np.nan))
    stack=np.asarray(curves)
    n=np.isfinite(stack).sum(0)
    present=n>0
    if not np.any(present):raise ValueError('No mean-profile support')
    mean=np.nansum(stack,axis=0)[present]/n[present]
    return station_grid[present],mean


def observed_channel(archive,clock,label,channel):
    key=f'{label}/{channel}/'
    t=(archive[key+'utc_ns']-clock['utc_origin_ns'])*1e-9
    return t,archive[key+'value']
