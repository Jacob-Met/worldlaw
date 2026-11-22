"""Read only the requested signed raw recording and compute source-indexed summaries."""
import numpy as np

PERIOD = 16000
ONSET = 4000
LOW = slice(1000,3000)
HIGH = slice(7000,9000)
STEP = 20
TICKS = np.arange(51)
LAG = 3
SIGNS = (-1,1)
COMPONENTS = ("displacement_y","displacement_x","sum_signal_in_light")
GROUP = "measurement_datum/planned_displacement_of_trapped_bead"


def recording(h, command, gain, quiet):
    group=h[f"{GROUP}/{command}"]
    channels=[group[key] for key in COMPONENTS]
    lengths=[len(c) for c in channels]
    if len(set(lengths))!=1 or lengths[0] < 2*PERIOD:
        raise ValueError(f"noncoindexed or short QPD {command}: {lengths}")
    periods,tail=divmod(lengths[0],PERIOD)
    sums=np.zeros((3,PERIOD))
    quiet_views=[]
    for i in range(0,periods,8):
        count=min(8,periods-i)
        sample=np.stack([c[i*PERIOD:(i+count)*PERIOD].reshape(count,PERIOD) for c in channels],axis=1)
        if not np.isfinite(sample).all():
            raise ValueError(f"nonfinite QPD {command}")
        sums+=sample.sum(axis=0)
        if quiet:
            quiet_views.append(sample[:,:,LOW].copy())
    means=sums/periods
    if not np.isfinite(gain) or gain<=0 or np.any(means[2]==0):
        raise ValueError(f"invalid mean normalizer {command}")
    # Published channel signs/order and gain; these are ratios of ensemble means.
    y=-means[:2].T/(gain*means[2,:,None])
    baseline=y[LOW].mean(axis=0)
    result=dict(command=command,periods=periods,tail=tail,wave=y-baseline,
                delta=y[HIGH].mean(axis=0)-baseline)
    if quiet:
        # Linearize the ratio at the source-defined neutral plateau. Never divide
        # individual noisy QPD samples by their instantaneous sum.
        raw=np.concatenate(quiet_views)
        center=means[:,LOW].mean(axis=1)
        if center[2]==0:
            raise ValueError("zero quiet mean intensity")
        jac=np.array([[-1,0,center[0]/center[2]],[0,-1,center[1]/center[2]]])/(gain*center[2])
        series=np.einsum("ab,nbt->nat",jac,raw,optimize=True)
        # Demean across periods at every registered phase, preserving each cycle boundary.
        series-=series.mean(axis=0,keepdims=True)
        result["cov"]=lag_covariances(series)
    return result


def lag_covariances(series):
    """Unfiltered 5-us samples, evaluated at 0.1-ms multiples without joining cycles."""
    n,_,length=series.shape
    cov=[]
    for j in range(len(TICKS)+LAG):
        lag=j*STEP
        past=series[:,:,:length-lag]
        future=series[:,:,lag:]
        cov.append(np.einsum("nat,nbt->ab",future,past,optimize=False)/(n*(length-lag)))
    return np.array(cov)
