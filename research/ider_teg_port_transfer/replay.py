"""Offline verification of locked response functions, release identity, scores and worst-row predictions."""
import base64,hashlib,json,math,os,sys,zlib
from pathlib import Path
from forecast import evaluate
from score import expand
def avg(v):
    v=list(v);return math.fsum(v)/len(v)
if __name__=="__main__":
    os.chdir(sys.argv[1] if len(sys.argv)>1 else ".")
    J=lambda name:json.loads(Path(name).read_bytes())
    f=J("forecast.json");lock=J("forecast-lock.json");p=J("protocol.json");sp=J("split.json");te=sp["held"];r=p["roles"];c=p["candidate"]
    assert set(f["models"])==set(te) and len(te)==28 and len(r)==13
    assert hashlib.sha256(Path("forecast.json").read_bytes()).hexdigest()==lock["sha256"]
    assert hashlib.sha256(Path("protocol.json").read_bytes()).hexdigest()==f["protocol_sha256"]
    envelope=J("score-zlib.json");raw=zlib.decompress(base64.b64decode(envelope["zlib_b64"],validate=True));assert hashlib.sha256(raw).hexdigest()==envelope["json_sha256"] and len(raw)==envelope["json_bytes"]
    s=json.loads(raw);assert s["forecast_sha256"]==lock["sha256"] and set(s["metrics"])==set(te)
    mods={}
    for k in te:
        assert set(s["metrics"][k])==set(r)==set(f["models"][k])==set(s["f64_prediction_sha256"][k])
        for role in r:
            y=expand(f,k,role);assert all(math.isfinite(v) for v in [y["E"],y["R"],*y["x"],*y["y"]])
    for m in range(5,9):
        g=str(m);mods[g]={}
        for role in r:
            mods[g][role]=[avg(s["metrics"][k][role][i] for k in te if k[3]==g) for i in range(8)]
            assert mods[g][role]==s["modules"][g][role]
    summary={role:[avg(mods[g][role][i] for g in mods) for i in range(8)] for role in r}
    assert summary==s["mean"]
    wins={role:sum(v[c][0]<v[role][0] for v in mods.values()) for role in r if role!=c}
    joint=all(summary[c][0]<summary[role][0] and summary[c][1]<summary[role][1] and w>=3 for role,w in wins.items())
    assert joint==s["gate"] and wins==s["wins"]
    _,k,n=s["worst"][c]
    for idx,v,i,ys in s["candidate_worst_episode"]:
        for role in r:assert math.isclose(evaluate(expand(f,k,role),v,idx),ys[role],rel_tol=1e-13,abs_tol=1e-13)
    print(json.dumps({"checked_functions":28*len(r),"native_held_rows":sum(v[0] for v in s["census"].values()),"gate":joint,"recount":"stored original metrics and worst reveal","source_original":"independent.py"}))
