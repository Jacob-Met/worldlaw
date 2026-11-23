"""Receive the lower plotted envelope after authenticating every forecast."""
from printed_forecast import read,sha,P,extract
import json,math
pin="b81a47b026d46cebc8dd1f44c3cb9d23dbc39c41cb6d22ae6465ff2f3a7a5d98"
assert sha((P/"upper-forecast-lock.json").read_bytes())==pin
reg=read("printed-protocol.json");lock=read("upper-forecast-lock.json")
assert lock["protocol_sha"]==sha((P/"printed-protocol.json").read_bytes()) and lock["roles"]==reg["roles"]
assert lock["held_lower_outputs_emitted"]==0 and [r["fill"] for r in lock["rows"]]==[".5",".67"]
for row in lock["rows"]:
    assert len(row["forecast"])==len(row["upper"]["values"])==41
    for u,p in zip(row["upper"]["values"],row["forecast"]):
        assert len(p)==10 and (all(x is None for x in p) if u is None else all(math.isfinite(x) and 0<=x<=u for x in p))
scores=[]
for idx,row in enumerate(lock["rows"]):
    lower=extract(reg,"held",idx+1,.05);up=row["upper"]
    assert all(lower[k]==up[k] for k in ("image_sha","counts","palette"))
    cases=[]
    for i,(u,l,pred) in enumerate(zip(up["values"],lower["values"],row["forecast"])):
        assert (u is None)==(l is None)
        cases.append({"bin":i,"f_over_fstar":.980+i*.001,"colored_pixels":up["counts"][i],"upper":u,"lower":l,"forecast":pred,"error":([y-l for y in pred] if u is not None else None)})
    obs=[r for r in cases if r["error"] is not None]
    rmse=[math.sqrt(math.fsum(r["error"][k]**2 for r in obs)/len(obs)) for k in range(10)]
    mae=[math.fsum(abs(r["error"][k]) for r in obs)/len(obs) for k in range(10)]
    worst=[max(obs,key=lambda r:abs(r["error"][k]))["bin"] for k in range(10)]
    rank=all(rmse[0]<rmse[k] for k in (1,2,3,4,5,6,8))
    scores.append({"fill":row["fill"],"available":len(obs),"total":len(cases),"cases":cases,"rmse":rmse,"mae":mae,"each_worst_bin":worst,"rank_gate":rank,"gate":len(obs)==len(cases) and rank})
print(json.dumps({"scope":"printed upper-conditioned lower envelope only","lock_sha":pin,"rows":scores,"roles":lock["roles"],"gate":all(r["gate"] for r in scores)},sort_keys=True))
