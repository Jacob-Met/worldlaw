"""Independent scalar receiver for every locked role and held front sample."""
import bisect
from decimal import Decimal as D, localcontext
import hashlib
import io
import json
import math
import os
from pathlib import Path
import statistics
import subprocess

import h5py

base=Path(__file__).resolve().parent
read=lambda name:json.loads((base/name).read_bytes())
design=read("design.json");lock=read("locked_forecasts.json");score=read("score.json")
sha=hashlib.sha256((base/"locked_forecasts.json").read_bytes()).hexdigest()
assert sha==score["forecast_sha256"]==(base/"forecast.sha256").read_text().strip()
roles=lock["roles"]; sums={}; largest=None; residuals=0; paired=0; delta=0.
goals=[5+i/4 for i in range(45)]
for r in [a for a in design if a["held"]]:
    run=r["id"]; recorded=score["runs"][run]
    blob=subprocess.check_output(["git","-C",os.environ["PALAGRAM_GIT"],"cat-file","blob",r["git_blob"]])
    assert hashlib.sha1(b"blob "+str(len(blob)).encode()+b"\0"+blob).hexdigest()==r["git_blob"]
    with h5py.File(io.BytesIO(blob),"r") as h:
        t=list(map(float,h["t"][:].reshape(-1)));ds=h["x_front"];x=list(map(float,ds[:].reshape(-1)))
        sentinels=[float(ds.attrs[k]) for k in ("_FillValue","missing_value") if k in ds.attrs]
        x=[v if v not in sentinels else float("nan") for v in x]
        L=float(h["L0"][()]);H=float(h["H0"][()]);phi=float(h["phi"][()]);a=float(h["alpha"][()])
        rf=float(h["rho_f"][()]);rp=float(h["rho_p"][()]);ra=float(h["rho_a"][()])
    t0=L/math.sqrt(9.81*(rf+phi*(rp-rf)-ra)/ra*H*math.cos(math.radians(a)))
    med=statistics.median(b-a for a,b in zip(t,t[1:]))
    target=[]; pairs=[]
    with localcontext() as ctx:
        ctx.prec=65
        for u in goals:
            tstar=u*t0; k=bisect.bisect_left(t,tstar); data=None;pair=None
            if k<len(t) and t[k]==tstar and math.isfinite(x[k]):
                data=D(x[k]);pair=[k,k]
            elif 0<k<len(t) and t[k]-t[k-1]<=1.5*med and math.isfinite(x[k]) and math.isfinite(x[k-1]):
                data=D(x[k-1])+(D(tstar)-D(t[k-1]))*(D(x[k])-D(x[k-1]))/(D(t[k])-D(t[k-1]))
                pair=[k-1,k]
            target.append(data);pairs.append(pair)
        assert pairs==recorded["interpolation_source_indices"]
        assert sum(v is not None for v in target)==recorded["n"]
        paired+=recorded["n"];sums[run]={}
        for j,v in enumerate(target):
            old=recorded["target_m"][j]
            if v is None: assert old is None
            else: assert abs(float(v)-old)<1e-11
        for role in roles:
            e=[(i,D(1000)*(D(p)-v)) for i,(p,v) in enumerate(zip(lock["held"][run][role],target)) if v is not None]
            residuals+=len(e)
            rms=(sum(err**2 for _,err in e)/len(e)).sqrt()
            ix,ev=max(e,key=lambda pair:abs(pair[1]));sums[run][role]=rms
            delta=max(delta,abs(float(rms)-recorded["rmse_mm"][role]),abs(float(ev)-recorded["worst"][role]["signed_error_mm"]))
            assert ix==recorded["worst"][role]["index"]
            if role=="finite_column" and (largest is None or abs(ev)>largest[0]):
                largest=(abs(ev),run,ix)
group_stats={}
for size in sorted(set(r["d"] for r in design if r["held"])):
    members=[r["id"] for r in design if r["held"] and r["d"]==size]
    group_stats[str(size)]={key:sum(sums[i][key] for i in members)/len(members) for key in roles}
balanced={role:sum(z[role] for z in group_stats.values())/len(group_stats) for role in roles}
for k,v in group_stats.items():
    for role,value in v.items():delta=max(delta,abs(float(value)-score["groups"][k][role]))
for role,value in balanced.items():delta=max(delta,abs(float(value)-score["balanced_mm"][role]))
assert largest[1:]==(score["worst"]["run"],score["worst"]["index"])
support=all(r["n"]>=36 for r in score["runs"].values())
assert support == score["gate"]["all_13_supported"]
assert delta<1e-8
gate=support and all(balanced["finite_column"]<balanced[k] for k in roles if k not in {"finite_column","finite_glass2500"}) and all(v["finite_column"]<v[k] for v in group_stats.values() for k in ("mixed_column","empirical_curve"))
assert gate==score["joint_pass"]
print(json.dumps({"status":"verified","source":"independent raw member and clock/Decimal scalar receiver",
                  "forecast_sha256":sha,"runs":len(sums),"valid_target_cells":paired,"finite_residuals":residuals,
                  "role_run_scores":len(sums)*len(roles),"size_mean_scores":len(group_stats)*len(roles),
                  "balanced_scores":len(roles),"joint_pass":gate,"worst":[float(largest[0]),*largest[1:]],
                  "max_abs_score_or_worst_delta_mm":delta,"arithmetic_decimal_precision":65},sort_keys=True))
