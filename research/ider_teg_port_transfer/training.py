"""Training-only acquisition and independent-publisher content authentication."""
import concurrent.futures,hashlib,json,math,statistics
from pathlib import Path
from reader import manifest,body

def data(x):
    b=body(x)
    digest=hashlib.sha256(b).hexdigest()
    assert digest==x["content_details"]["sha256_hash"].lower()
    rows=[]
    for line in b.decode("ascii").splitlines():
        if not line.strip():continue
        fields=line.split()
        assert len(fields)==2
        v,i=[float(w.replace(",",".")) for w in fields]
        assert math.isfinite(v) and math.isfinite(i)
        rows.append((v,i))
    assert len(rows)>=5
    return rows,digest
def linear(rows):
    n=len(rows);v=statistics.fmean(a for a,b in rows);i=statistics.fmean(b for a,b in rows)
    slope=math.fsum((a-v)*(b-i) for a,b in rows)/math.fsum((a-v)**2 for a,b in rows)
    intercept=i-v*slope
    diff=[b-(intercept+slope*a) for a,b in rows]
    w=max(range(n),key=lambda k:abs(diff[k]))
    return {"offset":intercept,"slope":slope,"effective_open_V":-intercept/slope,"effective_R":-1/slope,
        "rmse":math.sqrt(statistics.fmean(d*d for d in diff)),"worst":[w,*rows[w],diff[w]]}
if __name__=="__main__":
    specs=manifest();split=json.loads(Path("split.json").read_bytes());src=split["source"]
    pins={k:{"id":v["id"],"sha256":v["content_details"]["sha256_hash"].lower()} for k,v in specs.items()}
    assert len(pins)==72 and all(len(v["sha256"])==64 for v in pins.values())
    def dev(k):
        assert k in src
        rows,digest=data(specs[k]);v=[a for a,b in rows];inc=[y-x for x,y in zip(v,v[1:])]
        return k,{"n":len(rows),"min_V":min(v),"max_V":max(v),"voltage_step_median":statistics.median(inc),
                  "nonincreasing_steps":sum(z<=0 for z in inc),"first":rows[0],"last":rows[-1],"fit":linear(rows),"sha256":digest}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=dict(pool.map(dev,src))
    print(json.dumps({"pins":pins,"development":results,"excluded_held_bodies":len(split["held"])},sort_keys=True,allow_nan=False))
