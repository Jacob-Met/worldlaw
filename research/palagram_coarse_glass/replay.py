"""Recount all frozen PALAGRAM coarse-size scores without external dependencies."""
import hashlib
import json
import math
from pathlib import Path

root=Path(__file__).resolve().parent
load=lambda n:json.loads((root/n).read_bytes())
lock=load("locked_forecasts.json");score=load("score.json");cases=load("design.json")
roles=load("protocol.json")["roles"]
assert hashlib.sha256((root/"locked_forecasts.json").read_bytes()).hexdigest()==score["forecast_sha256"]==(root/"forecast.sha256").read_text().strip()
held=[r for r in cases if r["held"]];assert len(held)==13 and len(cases)==74 and len(roles)==12
assert set(score["runs"])==set(lock["held"])=={r["id"] for r in held}
rows={};scores={};total=0;worst=[]
for r in held:
    i=r["id"];row=score["runs"][i];obs=row["target_m"]
    assert len(obs)==45 and len(row["interpolation_source_indices"])==45
    assert set(lock["held"][i])==set(roles)
    finite=sum(v is not None for v in obs);assert finite==row["n"]
    total+=finite;rows[i]={}
    for m in roles:
        pred=lock["held"][i][m];assert len(pred)==45
        e=[(k,1000*(p-y)) for k,(y,p) in enumerate(zip(obs,pred)) if y is not None]
        rms=math.sqrt(math.fsum(v*v for _,v in e)/len(e)); k,w=max(e,key=lambda item:abs(item[1]))
        assert abs(rms-row["rmse_mm"][m])<1e-9 and k==row["worst"][m]["index"] and abs(w-row["worst"][m]["signed_error_mm"])<1e-9
        rows[i][m]=rms
        if m=="finite_column":worst.append((abs(w),i,k))
grouped={}
for d in sorted({r["d"] for r in held}):
    ids=[r["id"] for r in held if r["d"]==d]
    grouped[str(d)]={m:math.fsum(rows[i][m] for i in ids)/len(ids) for m in roles}
    assert all(abs(v-score["groups"][str(d)][m])<1e-9 for m,v in grouped[str(d)].items())
balanced={m:math.fsum(v[m] for v in grouped.values())/2 for m in roles}
assert all(abs(balanced[m]-score["balanced_mm"][m])<1e-9 for m in roles)
assert max(worst)[1:]==(score["worst"]["run"],score["worst"]["index"])
gate={"all_13_supported":all(r["n"]>=36 for r in score["runs"].values()),
      "all_controls":all(balanced["finite_column"]<v for m,v in balanced.items() if m not in ("finite_column","finite_glass2500")),
      "both_size_contrasts":all(v["finite_column"]<v[m] for v in grouped.values() for m in ("mixed_column","empirical_curve"))}
assert gate==score["gate"] and score["joint_pass"]==all(gate.values()) and score["joint_pass"] is False
assert total==584
print("Reproduced 7,020 locked predictions, 7,008 finite residuals, all 156 run RMSEs, 24 size means, 12 balanced scores and the failed registered gate.")
