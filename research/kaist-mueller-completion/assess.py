"""Evaluate frozen material-blocked forecasts from separate linear and circular projections."""
import json
from pathlib import Path
import sys
import numpy as np

from comparison import design_one, train_predict
from design import TRAIN_GROUPS, HOLD_GROUPS, GEOM


def read(root, i):
    with np.load(root/str(i)/"linear.npz") as z:
        assert np.array_equal(z["geometry"],GEOM)
        return design_one(z["a"].astype(float),z["geometry"])


def targets(root,i):
    with np.load(root/str(i)/"circular.npz") as z:
        return z["vv"].astype(float)


def run(root,phase):
    if phase=="development":
        folds=[(label,tuple(i for other,g in TRAIN_GROUPS.items() if other!=label for i in g),test)
               for label,test in TRAIN_GROUPS.items()]
    elif phase=="held":
        assert json.loads((root/"development.json").read_text())["primary_joint"]
        ids=tuple(i for grp in TRAIN_GROUPS.values() for i in grp)
        folds=[(k,ids,g) for k,g in HOLD_GROUPS.items()]
    else:
        raise ValueError(phase)
    inputs={i:read(root,i) for _,train,test in folds for i in (*train,*test)}
    predictions={}
    for group,train,te in folds:
        trainrows=[(inputs[j],targets(root,j)) for j in train]
        # One trained model per group would suffice; concatenating the test inputs
        # ensures all projections are fixed before reading any evaluation label.
        block={k:np.concatenate([inputs[j][k] for j in te]) for k in inputs[te[0]]}
        pp=train_predict(trainrows,block)
        for j,i in enumerate(te):
            start=j*len(GEOM)
            predictions[i]={k:v[start:start+len(GEOM)] for k,v in pp.items()}
    fp=root/(phase+"-predictions.npz")
    np.savez_compressed(fp,**{f"{i}-{k}":v for i,arms in predictions.items() for k,v in arms.items()})
    res={}
    for i,arms in predictions.items():
        y=targets(root,i);f=inputs[i];sup=np.isfinite(y)
        intensity=np.where(np.isfinite(f["intensity"]),abs(f["intensity"]),0.)
        if not sup.any() or intensity[sup].sum()<=0:raise ValueError(("unscoreable material",i))
        denominator=intensity[sup].sum()
        e={k:float(np.abs(z[sup]-y[sup]).sum()/denominator) for k,z in arms.items()}
        valid=sup & f["valid"] & ~f["empty"]
        if valid.any():
            yy=y[valid]/f["intensity"][valid]
            width=float(np.mean(f["hi"][valid]-f["lo"][valid]))
            cover=int(np.sum((f["lo"][valid]-1e-8<=yy)&(yy<=f["hi"][valid]+1e-8)))
        else:width=None;cover=0
        worst=int(np.flatnonzero(sup)[np.argmax(np.abs(arms["candidate"][sup]-y[sup]))])
        unique,count=np.unique(f["pure"],return_counts=True)
        res[i]={"errors":e,"all_coordinates":len(y),"scoreable":int(sup.sum()),
                "linear_only_valid":int(f["valid"].sum()),"finite_target_only_input_fallback":int((sup&~f["valid"]).sum()),
                "finite_observed_empty_interval":int((sup&f["valid"]&f["empty"]).sum()),
                "compatible_count":int(valid.sum()),"observed_inside":cover,"mean_normalized_width_on_compatible":width,
                "signed_endpoint_ties":int(np.sum(sup&f["ambiguous"])),
                "pure_status":dict(zip(unique,count.astype(int).tolist())),
                "worst":{"index":GEOM[worst].tolist(),"measured_VV":float(y[worst]),"M00":float(f["intensity"][worst]) if np.isfinite(f["intensity"][worst]) else None,
                         "predictions":{k:float(p[worst]) for k,p in arms.items()}}}
    overall={k:{"mean":float(np.mean([x["errors"][k] for x in res.values()])),
                "worst":float(max(x["errors"][k] for x in res.values()))} for k in next(iter(predictions.values()))}
    gates={s:all(overall["candidate"][s]<v[s] for k,v in overall.items() if k!="candidate") for s in ("mean","worst")}
    out={"phase":phase,"materials":res,"overall":overall,"gates":gates,"primary_joint":all(gates.values())}
    (root/(phase+".json")).write_text(json.dumps(out,sort_keys=True,allow_nan=False)+"\n")
    return out


if __name__=="__main__":
    print(json.dumps(run(Path(sys.argv[1]),sys.argv[2]),sort_keys=True,allow_nan=False))
