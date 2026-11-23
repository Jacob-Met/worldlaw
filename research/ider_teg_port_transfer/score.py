"""After byte lock, compare every function on every original stopped voltage grid."""
import concurrent.futures,hashlib,json,math,statistics,struct
from pathlib import Path
from reader import manifest
from training import data
from forecast import evaluate,role
def avg(x):
    x=list(x);return math.fsum(x)/len(x)
def expand(b,k,r):
    e,R,idx=b["models"][k][r];grid,y=b["shapes"][idx];axis,x=b["grids"][grid]
    assert axis in ("relative_voltage","row") and len(x)==len(y)
    return role(e,R,x,y,axis)
def grade(rows,ys):
    d=[y-i for y,(v,i) in zip(ys,rows)]
    worst=max(range(len(d)),key=lambda n:abs(d[n]));obs=max(range(len(d)),key=lambda n:rows[n][0]*rows[n][1]);ph=max(range(len(d)),key=lambda n:rows[n][0]*ys[n])
    mapeak=abs(rows[ph][0]*ys[ph]-rows[obs][0]*rows[obs][1]);zero=min(range(len(d)),key=lambda n:abs(rows[n][0]))
    return [math.sqrt(avg(e*e for e in d)),avg(abs(e) for e in d),avg(d),abs(d[worst]),mapeak,
            math.sqrt(avg(e*e for e in d[:16])),math.sqrt(avg(e*e for e in d[16:])),d[zero]],worst
if __name__=="__main__":
    split=json.loads(Path("split.json").read_bytes());p=json.loads(Path("protocol.json").read_bytes())
    b=Path("forecast.json").read_bytes();lock=json.loads(Path("forecast-lock.json").read_bytes())
    assert len(b)==lock["bytes"] and hashlib.sha256(b).hexdigest()==lock["sha256"]
    f=json.loads(b);te=split["held"];roles=p["roles"]
    assert f["protocol_sha256"]==hashlib.sha256(Path("protocol.json").read_bytes()).hexdigest() and set(f["models"])==set(te)
    assert f["roles"]==roles and all(set(f["models"][k])==set(roles) for k in te)
    functions={k:{r:expand(f,k,r) for r in roles} for k in te}
    specs=manifest();pins=json.loads(Path("training-summary.json").read_bytes())["pins"]
    def read(k):
        assert k in te
        assert specs[k]["content_details"]["sha256_hash"].lower()==pins[k]["sha256"] and specs[k]["id"]==pins[k]["id"]
        z,h=data(specs[k]);return k,z
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:records=dict(pool.map(read,te))
    worst={r:(-1,None,None) for r in roles};metrics={};arrays={};census={}
    for k,rows in records.items():
        assert len(rows)>16
        metrics[k]={};arrays[k]={};volt=[v for v,i in rows];curr=[i for v,i in rows]
        census[k]=[len(rows),min(volt),max(volt),rows[0],rows[-1],round(statistics.median(b-a for a,b in zip(volt,volt[1:])),12),sum(b<=a for a,b in zip(volt,volt[1:]))]
        for r in roles:
            ys=[evaluate(functions[k][r],v,n) for n,(v,i) in enumerate(rows)]
            assert len(ys)==len(rows) and all(map(math.isfinite,ys))
            arrays[k][r]=hashlib.sha256(struct.pack("<"+"d"*len(ys),*ys)).hexdigest()
            v,n=grade(rows,ys);metrics[k][r]=v
            if v[3]>worst[r][0]:worst[r]=(v[3],k,n)
    modules={str(m):{r:[avg(metrics[k][r][i] for k in te if int(k[3])==m) for i in range(8)] for r in roles} for m in range(5,9)}
    summary={r:[avg(modules[str(m)][r][i] for m in range(5,9)) for i in range(8)] for r in roles}
    c=p["candidate"];wins={r:sum(g[c][0]<g[r][0] for g in modules.values()) for r in roles if r!=c}
    gate=all(summary[c][0]<summary[r][0] and summary[c][1]<summary[r][1] and w>=3 for r,w in wins.items())
    mag,k,n=worst[c];rows=records[k]
    episode=[[l,*rows[l],{r:evaluate(functions[k][r],rows[l][0],l) for r in roles}] for l in range(max(0,n-5),min(len(rows),n+6))]
    out={"forecast_sha256":lock["sha256"],"metric_order":["RMSE","MAE","bias","max_abs","max_observed_grid_VI_error","first16_RMSE","suffix_RMSE","bias_at_nearest_zero_voltage"],"census":census,"metrics":metrics,"modules":modules,"mean":summary,"gate":gate,"wins":wins,"worst":worst,"candidate_worst_episode":episode,"f64_prediction_sha256":arrays}
    import base64,zlib
    raw=json.dumps(out,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    print(json.dumps({"json_sha256":hashlib.sha256(raw).hexdigest(),"json_bytes":len(raw),"zlib_b64":base64.b64encode(zlib.compress(raw,9)).decode()},sort_keys=True))
    print(json.dumps({"means":summary,"wins":wins,"gate":gate,"worst":worst[c],"episode":episode,"samples":sum(len(v) for v in records.values())},allow_nan=False,separators=(",",":"),sort_keys=True))
