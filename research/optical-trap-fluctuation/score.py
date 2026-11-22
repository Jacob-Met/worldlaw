"""Score both components of complete held-amplitude recordings against locked forecasts."""
import json
import argparse
import numpy as np
import h5py
from recording import SIGNS, recording
from forecast import ARMS, INDEX


def score(h,forecast):
    assert forecast["index"]==INDEX.tolist()
    gain=float(h["calibration/gain"][()])
    results={}
    for sign in SIGNS:
        command=800*sign
        obs=recording(h,command,gain,quiet=False)
        target=obs["wave"][INDEX]
        rec=forecast["predictions"][str(command)]
        arms={}
        for name in ARMS:
            pred=np.array(rec["arms"][name],dtype=float)
            if pred.shape!=target.shape:
                raise ValueError("incomplete predicted trace")
            per_tick=np.linalg.norm(pred-target,axis=1)
            worst=int(np.argmax(per_tick))
            arms[name]={"rmse_vector":float(np.sqrt(np.mean(per_tick**2))),
                        "max_norm":float(per_tick[worst]),"max_index":int(INDEX[worst]),
                        "worst_prediction":pred[worst].tolist(),"worst_truth":target[worst].tolist()}
        results[str(command)]={"target":target.tolist(),"arms":arms,"periods":obs["periods"],
                               "held_plateau":obs["delta"].tolist(),
                               "discarded_final_partial_samples":obs["tail"]}
    return results


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("source")
    p.add_argument("locked")
    p.add_argument("out")
    args=p.parse_args()
    with open(args.locked) as r:
        pred=json.load(r)
    with h5py.File(args.source,"r") as h:
        result=score(h,pred)
    with open(args.out,"w") as f:
        json.dump(result,f,sort_keys=True,allow_nan=False)
