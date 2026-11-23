"""Score the locked complex forecasts on all 98 position-disjoint centers."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from geometry import Geometry, HZ

EXPECTED=("direction_minimax","radial_mean","author_isotropic","author_directional",
          "empirical_shell_ridge","empirical_26_ridge","equal_26","zero")

def evaluation(archive, bank_path, expected_hash, output):
    data=Path(bank_path).read_bytes()
    if hashlib.sha256(data).hexdigest()!=expected_hash:
        raise ValueError("Unmatched frozen forecast")
    bank=json.loads(data); geom=Geometry(archive)
    held=[v for v in geom.cubes if v[0][2]!=4]
    assert [list(x[0]) for x in held]==bank["held_centers"]
    assert [x[1] for x in held]==bank["held_member_ids"]
    assert len(held)==98 and bank["arms"]==list(EXPECTED) and bank["frequencies"]==HZ.tolist()
    obs=np.array([geom.response(mid) for _,mid,_ in held])
    layer=np.array([q[0][2] for q in held])
    metrics={}; witnesses={}
    for name in EXPECTED:
        a=np.array(bank["forecasts"][name]); pred=a[...,0]+1j*a[...,1]
        assert pred.shape==(98,7) and np.isfinite(pred).all()
        loss=np.abs(pred-obs)**2
        slices={}
        for label,mask in (("all",np.ones(98,bool)),("lower",layer==1),("upper",layer==7)):
            energy=(np.abs(obs[mask])**2).sum(axis=0)
            if np.any(energy<=0):
                raise ValueError("An entire frozen frequency-group has zero measured energy")
            nmse=np.sqrt(loss[mask].sum(axis=0)/energy)
            slices[label]=dict(energy=energy.tolist(),per_frequency=nmse.tolist(),
                               mean=float(nmse.mean()),worst_frequency=float(nmse.max()))
        i,j=np.unravel_index(loss.argmax(),loss.shape)
        witnesses[name]=dict(center=bank["held_centers"][i],id=bank["held_member_ids"][i],hz=float(HZ[j]),
                             response=[obs[i,j].real,obs[i,j].imag],prediction=[pred[i,j].real,pred[i,j].imag],
                             residual=[(pred[i,j]-obs[i,j]).real,(pred[i,j]-obs[i,j]).imag],absolute=float(np.sqrt(loss[i,j])))
        metrics[name]=slices
    candidate=metrics["direction_minimax"]["all"]
    gates={metric:{name:bool(candidate[metric]<metrics[name]["all"][metric]) for name in EXPECTED[1:]}
           for metric in ("mean","worst_frequency")}
    result=dict(bank_sha256=expected_hash,metrics=metrics,witnesses=witnesses,gates=gates,
                joint=all(v for row in gates.values() for v in row.values()),
                held=np.stack((obs.real,obs.imag),axis=-1).tolist())
    raw=json.dumps(result,separators=(",",":"),sort_keys=True,allow_nan=False).encode()
    Path(output).write_bytes(raw)
    print("SCORE",len(raw),hashlib.sha256(raw).hexdigest(),gates)
    print("CANDIDATE",metrics["direction_minimax"]["all"],witnesses["direction_minimax"])

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    for a in ("archive","bank","bank_sha256","output"):parser.add_argument(a)
    args=parser.parse_args()
    evaluation(args.archive,args.bank,args.bank_sha256,args.output)
