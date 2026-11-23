"""Independent Decimal reader for all locked functions and public original samples."""
import hashlib,json,math,urllib.request,statistics,base64,zlib,concurrent.futures
from pathlib import Path
from decimal import Decimal as D,getcontext
getcontext().prec=55
def J(name):return json.loads(Path(name).read_bytes(),parse_float=D)
def avg(x):
    vals=list(x);return sum(vals,D(0))/len(vals)
def strict_curve(sweep,meta):
    u=meta["content_details"]["download_url"]
    with urllib.request.urlopen(u,timeout=90) as r:b=r.read(6000000)
    pin=pins[sweep]
    assert len(b)==meta["size"] and hashlib.sha256(b).hexdigest()==pin["sha256"] and meta["id"]==pin["id"]
    parsed=[]
    for line in b.decode("ascii").splitlines():
        if line.strip():
            a,h=line.split();parsed.append([D(a.replace(",",".")),D(h.replace(",","."))])
    return parsed
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
    url="https://data.mendeley.com/public-api/datasets/tfg4byhch8/files?folder_id=root&version=1"
    with urllib.request.urlopen(url,timeout=60) as z:cat={a["filename"]:a for a in json.load(z)}
    pins=J("training-summary.json")["pins"];te=split["held"];roles=protocol["roles"];ca=protocol["candidate"]
    assert set(f["models"])==set(te) and set(s["metrics"])==set(te) and set(f["roles"])==set(roles) and len(te)==28
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:data=dict(zip(te,pool.map(lambda k:strict_curve(k,cat[k]),te)))
    worst={};cnt={};me={};raw_worst={};pcount=0
    for k,xy in data.items():
        assert len(xy)==s["census"][k][0]
        me[k]={}
        for r in roles:
            y=[fitted(f,k,r,v,n) for n,(v,i) in enumerate(xy)];d=[h-i for h,(v,i) in zip(y,xy)];pcount+=len(d)
            wi=max(range(len(d)),key=lambda n:abs(d[n]));zi=min(range(len(d)),key=lambda n:abs(xy[n][0]))
            power=abs(max(x[0]*h for x,h in zip(xy,y))-max(v*i for v,i in xy))
            errs=[avg(z*z for z in d).sqrt(),avg(abs(z) for z in d),avg(d),abs(d[wi]),power,avg(z*z for z in d[:16]).sqrt(),avg(z*z for z in d[16:]).sqrt(),d[zi]]
            for a,b in zip(errs,s["metrics"][k][r]):check(a,b,"sweep")
            me[k][r]=errs
            if r not in raw_worst or abs(d[wi])>raw_worst[r][0]:raw_worst[r]=(abs(d[wi]),k,wi)
    groups={};summ={}
    for m in range(5,9):
        g=str(m);groups[g]={}
        for r in roles:
            q=[avg(me[k][r][l] for k in te if k[3]==g) for l in range(8)]
            for a,b in zip(q,s["modules"][g][r]):check(a,b,"module")
            groups[g][r]=q
    for r in roles:
        q=[avg(groups[g][r][l] for g in groups) for l in range(8)]
        for a,b in zip(q,s["mean"][r]):check(a,b,"overall")
        a,k,idx=raw_worst[r];h,kh,ih=s["worst"][r];assert (kh,ih)==(k,idx);check(a,h,"raw_worst")
        summ[r]=q
    wins={r:sum(v[ca][0]<v[r][0] for v in groups.values()) for r in roles if r!=ca}
    result=all(summ[ca][0]<summ[r][0] and summ[ca][1]<summ[r][1] and w>=3 for r,w in wins.items())
    assert result==s["gate"] and wins==s["wins"];_,k,idx=raw_worst[ca]
    for n,v,i,y in s["candidate_worst_episode"]:
        assert [v,i]==data[k][n]
        for r in roles:check(fitted(f,k,r,v,n),y[r],"worst_episode")
    print(json.dumps({"raw_rows":sum(map(len,data.values())),"reconstructed_current_predictions":pcount,"whole_sweeps":len(data),"roles":len(roles),"metric_and_episode_checks":cnt,"worst_fraction_error_floor_1":{k:str(v) for k,v in worst.items()},"candidate_gate":result,"module_wins":wins,"forecast_sha256":lock["sha256"],"score_sha256":enc["json_sha256"]},sort_keys=True))
