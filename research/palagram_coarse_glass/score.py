"""Open held front observations only after checking the locked producer bytes."""
import hashlib
import json
import math
import numpy as np
from course import COURSE, DESIGN, GRID, POLICY, observe

lock_path=COURSE/"locked_forecasts.json"
expected=(COURSE/"forecast.sha256").read_text().strip()
assert hashlib.sha256(lock_path.read_bytes()).hexdigest()==expected
lock=json.loads(lock_path.read_text())
roles=POLICY["roles"]; held=[r for r in DESIGN if r["held"]]
assert list(lock["roles"])==roles and len(set(roles))==12 and len(held)==13
assert set(lock["held"])=={r["id"] for r in held} and lock["held_positions_opened"]==0
assert all(set(a)==set(roles) and all(np.asarray(v).shape==(45,) and np.isfinite(v).all() for v in a.values()) for a in lock["held"].values())
out={"forecast_sha256":expected,"roles":roles,"runs":{},"groups":{},"worst":None}
for r in held:
    k=r["id"]; y,pairs,t,x=observe(r); y=y*r["L0"]; good=np.isfinite(y)
    predictions={m:np.asarray(lock["held"][k][m]) for m in roles}
    item={"size_um":r["d"]*1e6,"n":int(good.sum()),"target_m":[float(v) if np.isfinite(v) else None for v in y],
          "interpolation_source_indices":pairs,"clock_sha256":hashlib.sha256(t.astype('<f8').tobytes()).hexdigest(),
          "position_sha256":hashlib.sha256(x.astype('<f8').tobytes()).hexdigest(),"rmse_mm":{},"worst":{}}
    if not good.any():raise ValueError("No measured cells in "+k)
    for m,p in predictions.items():
        e=1000*(p-y); index=int(np.nanargmax(abs(e)))
        item["rmse_mm"][m]=float(np.sqrt(np.mean(e[good]**2)))
        item["worst"][m]={"index":index,"signed_error_mm":float(e[index])}
    idx=item["worst"]["finite_column"]["index"]; lo,hi=pairs[idx]
    sl=list(range(max(0,lo-3),min(len(t),hi+4)))
    item["candidate_worst_context"]={"index":idx,"u":float(GRID[idx]),"observation_m":float(y[idx]),
        "all_predictions_m":{m:float(a[idx]) for m,a in predictions.items()},
        "raw_time_and_front_m":[[a,float(t[a]),float(x[a]) if np.isfinite(x[a]) else None] for a in sl]}
    out["runs"][k]=item
    err=abs(item["worst"]["finite_column"]["signed_error_mm"])
    if out["worst"] is None or err>out["worst"]["absolute_error_mm"]:
        out["worst"]={"run":k,"absolute_error_mm":err,**item["candidate_worst_context"]}
for size in sorted({r["d"] for r in held}):
    rows=[out["runs"][r["id"]] for r in held if r["d"]==size]
    out["groups"][str(size)]={m:float(np.mean([v["rmse_mm"][m] for v in rows])) for m in roles}
out["balanced_mm"]={m:float(np.mean([v[m] for v in out["groups"].values()])) for m in roles}
res=out["balanced_mm"]; groups=out["groups"]
out["gate"]={"all_13_supported":all(v["n"]>=36 for v in out["runs"].values()),
             "all_controls":all(res["finite_column"]<res[m] for m in roles if m not in ("finite_column","finite_glass2500")),
             "both_size_contrasts":all(g["finite_column"]<g[m] for g in groups.values() for m in ("mixed_column","empirical_curve"))}
out["joint_pass"]=all(out["gate"].values())
print("SCORED "+json.dumps(out,sort_keys=True,separators=(',',':'),allow_nan=False))
