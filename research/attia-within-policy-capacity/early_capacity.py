"""Fit the early-capacity residual controls on the released external historical cells."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np


def prefix(q):
    q = np.asarray(q, dtype=float)[:, 1:100].copy()
    if q.shape[1] != 99 or not np.isfinite(q).all():
        raise ValueError("Nonfinite or incomplete cycle-2 through 100 input")
    return q


def representations(q):
    q = prefix(q)
    n = np.arange(99, dtype=float)
    x = n / 98
    basis = np.stack((np.ones(99), -np.expm1(-n / 24), x, x**2), axis=1)
    coefs = np.linalg.lstsq(basis, q.T, rcond=None)[0].T
    residual = q - coefs @ basis.T
    slope = (q @ (n - n.mean())) / np.sum((n - n.mean())**2)
    late = n[-10:] - n[-10:].mean()
    late_slope = q[:, -10:] @ late / (late @ late)
    return {
        "raw": q,
        "scalar": np.column_stack((q[:, 0], q.max(axis=1)-q[:, 0], slope, late_slope)),
        "shape": np.column_stack((coefs, np.sqrt(np.mean(residual**2, axis=1)))),
    }


def standardized_model(z, target, penalty):
    mu, scale = z.mean(axis=0), z.std(axis=0)
    scale[scale == 0] = 1
    w = (z - mu) / scale
    # Dual system handles the raw 99-cycle vector with only 41 fit cells.
    coef = w.T @ np.linalg.solve(w @ w.T + penalty*np.eye(len(w)), target-target.mean())
    return {"mu":mu.tolist(),"scale":scale.tolist(),"coef":coef.tolist(),
            "intercept":float(target.mean()),"penalty":penalty}


def correction(z, model):
    return (z-model["mu"]) / model["scale"] @ model["coef"] + model["intercept"]


def group_centers(values, groups):
    result = np.zeros_like(values, dtype=float)
    for label in dict.fromkeys(groups):
        idx = np.array([k == label for k in groups])
        result[idx] = values[idx] - values[idx].mean()
    return result


def development(root):
    def load(name):
        data = json.loads((root / (name + ".json")).read_text())
        return (representations(data["q"]), np.asarray(data["pred"]), np.asarray(data["y"]),
                [tuple(float(v) for v in g) for g in data["schedule"]])
    z, e, y, _ = load("train")
    zd, ed, yd, groups = load("test1")
    dy = group_centers(yd, groups)
    pred = {"early": ed}
    out = {"n_fit":len(y),"n_development":len(yd),"models":{},"penalty_losses":{},"shrink":{},
           "historical_replication":[groups.count(g) for g in dict.fromkeys(groups) if groups.count(g)>1]}
    for k in z:
        candidates=[]
        for penalty in (0.1, 1., 10., 100.):
            model=standardized_model(z[k],y-e,penalty)
            v=ed+correction(zd[k],model)
            candidates.append((float(np.sqrt(np.mean((v-yd)**2))),penalty,model,v))
        loss,p,model,v=min(candidates,key=lambda row:(row[0],row[1]))
        out["models"][k]=model
        out["penalty_losses"][k]={str(pen):l for l,pen,_,_ in candidates}
        pred[k]=v
    diagnostics={}
    for name,v in pred.items():
        dv=group_centers(v,groups)
        unclipped=(dy @ dv) / (dv @ dv) if dv @ dv else 0.
        out["shrink"][name]=float(np.clip(unclipped,0,1))
        idx=int(np.argmax(np.abs(v-yd)))
        diagnostics[name]={"absolute_RMSE":float(np.sqrt(np.mean((v-yd)**2))),
                           "unclipped_shrink":float(unclipped),"worst_index":idx,
                           "worst_observed":float(yd[idx]),"worst_forecast":float(v[idx])}
    out["dev_diagnostics"]=diagnostics
    path=root/"historical-model.json"
    path.write_text(json.dumps(out,sort_keys=True,allow_nan=False))
    print(json.dumps({"model_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                      "shape":{k:(len(y),v.shape[1]) for k,v in z.items()},"penalties":{k:m["penalty"] for k,m in out["models"].items()},
                      "diagnostics":diagnostics,"shrink":out["shrink"],"replicated":out["historical_replication"]},sort_keys=True))


if __name__=="__main__":
    development(Path(sys.argv[1]))
