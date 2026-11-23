"""Offline Decimal validation of source scale factors, stored metrics and the archived raw episode."""
import hashlib,json,math,urllib.request,statistics,base64,zlib,concurrent.futures
from pathlib import Path
from decimal import Decimal as D,getcontext
getcontext().prec=55
def J(name):return json.loads(Path(name).read_bytes(),parse_float=D)
def avg(x):
    vals=list(x);return sum(vals,D(0))/len(vals)
def interp(xs,ys,u):
    if not xs:return D(0)
    if u<=xs[0]:return ys[0]
    for k in range(1,len(xs)):
        if u<=xs[k]:return (ys[k]*(u-xs[k-1])+ys[k-1]*(xs[k]-u))/(xs[k]-xs[k-1])
    return ys[-1]
def fitted(f,k,r,v,n):
    e,R,idx=f["models"][k][r];g,y=f["shapes"][idx];axis,x=f["grids"][g]
    u=v/e
    return (1-u+interp(x,y,D(n) if axis=="row" else u))*e/R
def check(a,b,kind):
    d=abs(D(a)-D(b))/max(1,abs(a),abs(b))
    worst[kind]=max(worst.get(kind,D(0)),d);cnt[kind]=cnt.get(kind,0)+1
    assert d<D("3e-12"),(kind,a,b,d)
if __name__=="__main__":
    protocol=J("protocol.json");split=J("split.json");lock=J("forecast-lock.json");f=J("forecast.json")
    enc=J("score-zlib.json");payload=zlib.decompress(base64.b64decode(enc["zlib_b64"],validate=True))
    assert len(payload)==enc["json_bytes"] and hashlib.sha256(payload).hexdigest()==enc["json_sha256"]
    s=json.loads(payload,parse_float=D)
    assert hashlib.sha256(Path("forecast.json").read_bytes()).hexdigest()==lock["sha256"]==s["forecast_sha256"]
    assert hashlib.sha256(Path("protocol.json").read_bytes()).hexdigest()==f["protocol_sha256"]
    te=split["held"];roles=protocol["roles"];ca=protocol["candidate"];worst={};cnt={}
    assert len(te)==28 and len(roles)==13 and set(s["metrics"])==set(te)
    from validate_scale import verify
    verify(f,J("training-summary.json")["development"],te,check,avg)
    me=s["metrics"];groups={};summ={}
    for m in range(5,9):
        g=str(m);groups[g]={}
        for r in roles:
            q=[avg(me[k][r][l] for k in te if k[3]==g) for l in range(8)]
            for a,b in zip(q,s["modules"][g][r]):check(a,b,"module")
            groups[g][r]=q
    for r in roles:
        q=[avg(groups[g][r][l] for g in groups) for l in range(8)]
        for a,b in zip(q,s["mean"][r]):check(a,b,"overall")
        h,k,idx=s["worst"][r];check(max(me[k][r][3] for k in te),h,"recorded_worst_via_sweep_metrics")
        summ[r]=q
    wins={r:sum(v[ca][0]<v[r][0] for v in groups.values()) for r in roles if r!=ca}
    result=all(summ[ca][0]<summ[r][0] and summ[ca][1]<summ[r][1] and w>=3 for r,w in wins.items())
    assert result==s["gate"] and wins==s["wins"];_,k,idx=s["worst"][ca]
    for n,v,i,y in s["candidate_worst_episode"]:
        if n==idx:check(abs(y[ca]-i),s["worst"][ca][0],"worst_error")
        for r in roles:check(fitted(f,k,r,v,n),y[r],"worst_episode")
    print(json.dumps({"recorded_rows":sum(x[0] for x in s["census"].values()),"independently_reopened_held_sweeps":0,"whole_sweeps":len(te),"roles":len(roles),"metric_and_episode_checks":cnt,"worst_fraction_error_floor_1":{k:str(v) for k,v in worst.items()},"candidate_gate":result,"module_wins":wins,"forecast_sha256":lock["sha256"],"score_sha256":enc["json_sha256"]},sort_keys=True))
