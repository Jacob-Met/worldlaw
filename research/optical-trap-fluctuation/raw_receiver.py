"""Independent raw high-amplitude target projection at the 51 locked source phases."""
import math
import numpy as np


def high_target(h,command):
    assert command in (-800,800)
    prefix=f"measurement_datum/planned_displacement_of_trapped_bead/{command}/"
    names=["displacement_y","displacement_x","sum_signal_in_light"]
    ds=[h[prefix+n] for n in names]
    lens=list(map(len,ds))
    assert min(lens)==max(lens)
    cycles,tail=divmod(lens[0],16000)
    # Accumulate independently by channel and cycle, and only over compared phases.
    indices=np.r_[np.arange(1000,3000),np.arange(7000,9000),np.arange(4000,5001,20)]
    vals=[]
    for source in ds:
        total=np.zeros(len(indices))
        for block in range(0,cycles,25):
            size=min(25,cycles-block)
            batch=np.asarray(source[16000*block:16000*(block+size)]).reshape(size,16000)
            total+=batch[:,indices].sum(axis=0)
        vals.append(total/cycles)
    gain=float(h["calibration/gain"][()])
    first,second,intensity=vals
    offsets=[]
    targets=[]
    delta=[]
    for x in (first,second):
        y=-x/(gain*intensity)
        baseline=math.fsum(y[:2000])/2000
        offsets.append(baseline)
        targets.append(y[4000:]-baseline)
        delta.append(math.fsum(y[2000:4000])/2000-baseline)
    return np.asarray(targets).T,np.asarray(delta),cycles,tail
