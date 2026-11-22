"""Predict only from the two independently acquired 500-nm calibration recordings."""
import argparse
import json
import h5py
import numpy as np
from recording import LAG, ONSET, SIGNS, STEP, TICKS, recording

ARMS = ("quiet_positive_lag","quiet_zero_lag","author_log_slope","scaled_small_wave","instantaneous_step")
INDEX = ONSET+STEP*TICKS


def conditions(cov):
    result={}
    for name,anchor in (("quiet_positive_lag",LAG),("quiet_zero_lag",0)):
        base=cov[anchor]
        cond=float(np.linalg.cond(base))
        if not np.isfinite(cond) or cond>10000:
            raise ValueError(f"{name} condition {cond} exceeds 10000")
        # Solve X B = C without explicitly inverting B.
        prop=np.stack([np.linalg.solve(base.T,cov[j+anchor].T).T for j in TICKS])
        result[name]=(prop,cond)
    return result


def author_rate(rec):
    # The author's scalar projected waveform is proportional to the first normalized
    # component. The scalar cancels when divided by its own plateau amplitude.
    # The same fixed window is given independently to both small-drive recordings.
    x=rec["wave"][:,0]
    reference=np.mean(x[7000:9000])-np.mean(x[1000:3000])
    if reference==0:
        raise ValueError("zero signed plateau for author rate")
    values=np.abs(1-x[4100:4600]/reference)
    if np.any(values==0):
        raise ValueError("zero log residual in fixed author window")
    slope=float(np.polyfit(np.arange(len(values))*5e-6,np.log(values),1)[0])
    if not np.isfinite(slope):
        raise ValueError("nonfinite fixed-window author rate")
    return slope


def issue(h):
    gain=float(h["calibration/gain"][()])
    small={sign:recording(h,500*sign,gain,quiet=True) for sign in SIGNS}
    # Each lower-amplitude acquisition has equal weight in the neutral-state estimate.
    cov=(small[-1]["cov"]+small[1]["cov"])/2
    props=conditions(cov)
    out={}
    for sign in SIGNS:
        rec=small[sign]
        delta=rec["delta"]*(800/500)
        # A non-decaying estimated author slope remains as fitted, with no clamp.
        original_rate=author_rate(rec)
        times=TICKS*STEP*5e-6
        arms={name:((np.eye(2)-p)@delta).tolist() for name,(p,_) in props.items()}
        arms["author_log_slope"]=((1-np.exp(original_rate*times))[:,None]*delta).tolist()
        arms["scaled_small_wave"]=(1.6*rec["wave"][INDEX]).tolist()
        arms["instantaneous_step"]=np.broadcast_to(delta,(len(times),2)).tolist()
        if set(arms)!=set(ARMS) or not np.isfinite(np.array(list(arms.values()))).all():
            raise ValueError("missing or nonfinite arm")
        out[str(800*sign)]={"arms":arms,"small_delta":rec["delta"].tolist(),
                            "author_rate_per_s":original_rate,
                            "periods":rec["periods"],"discarded_final_partial_samples":rec["tail"]}
    return {"predictions":out,"condition":{k:c for k,(_,c) in props.items()},
            "index":INDEX.tolist(),"period":16000,"timebase_s":5e-6,
            "inputs":["-500 raw","500 raw","gain","planned command label"],
            "units":"signed detector voltage / (gain * summed detector voltage)"}


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("out")
    args=parser.parse_args()
    with h5py.File(args.source,"r") as h:
        result=issue(h)
    with open(args.out,"w") as f:
        json.dump(result,f,sort_keys=True,allow_nan=False)
