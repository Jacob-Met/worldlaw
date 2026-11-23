"""Receive the forecast while preserving every held source, cube, frequency and gate."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
from projection import CENTER,HELD,FREQ,PRIMARY
from forecast import LAYOUTS,per_frequency,read_stage

def score(directory,lock,wanted,output):
    raw=Path(lock).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=wanted:raise ValueError("Forecast digest")
    b=json.loads(raw)
    assert b["centers"]==CENTER.tolist() and b["frequencies"]==FREQ.tolist() and b["held"]==list(HELD)
    paths={s:read_stage(Path(directory)/f"truth{s}.npz") for s in HELD}
    metrics={};truth={};witness={}
    for s in HELD:
        d=paths[s]
        assert int(d["speaker"])==s and str(d["forecast_sha256"])==wanted and "donors" not in d
        y=d["targets"];truth[s]=np.stack((y.real,y.imag),axis=-1).tolist()
        for layout in LAYOUTS:
            key=f"{s}/{layout}";metrics[key]={}
            for name,stack in b["forecasts"][key].items():
                p=np.array(stack);pred=p[...,0]+1j*p[...,1];r=pred-y
                assert r.shape==(50,7) and np.all(np.isfinite(r))
                nrm=per_frequency(pred,y)
                i,j=np.unravel_index(abs(r[:,PRIMARY]).argmax(),(50,3));j=PRIMARY[j]
                witness[key+"/"+name]=dict(row=int(i),center=CENTER[i].tolist(),hz=int(FREQ[j]),
                    measured=truth[s][i][j],predicted=stack[i][j],absolute=float(abs(r[i,j])))
                metrics[key][name]=dict(per_frequency=nrm.tolist(),stress_mean=float(nrm[PRIMARY].mean()),
                                       all_mean=float(nrm.mean()))
    gates={f"{s}/{method}/vs_{other}":metrics[f"{s}/relocated"][method]["stress_mean"]<
          metrics[f"{s}/{other}"][method]["stress_mean"]
          for s in HELD for method in ("selected","author_directional") for other in ("original","equal_aperture_optimal")}
    result=dict(forecast_sha256=wanted,metrics=metrics,truth=truth,worst_stress_rows=witness,
                gates=gates,joint=all(gates.values()))
    data=json.dumps(result,separators=(",",":"),sort_keys=True,allow_nan=False).encode()
    Path(output).write_bytes(data)
    print("SCORE",len(data),hashlib.sha256(data).hexdigest(),gates)

if __name__=="__main__":score(*sys.argv[1:])
