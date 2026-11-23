"""Independent Decimal receiving of four optical scans; no predictor or numerical framework imports."""
import base64,bisect,csv,hashlib,io,json,math,pathlib,struct,urllib.request,zipfile
from decimal import Decimal as D,getcontext
getcontext().prec=52
P=pathlib.Path(".")
def read(n):return json.loads((P/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def fd(x):return D.from_float(x)
reg=read("protocol.json");score=read("author-ordinate-score.json");assert reg["roles"]==score["roles"] and reg["repeats"]==[1,2,3,4]
orig=[]
for ix,rep in enumerate(reg["repeats"]):
    a=read(f"forecast-{rep}.json");m=read(f"forecast-lock-{rep}.json")["meta"];rows=a["vectors"]
    assert m["target_ordinates_read"]==0 and m["repeat"]==rep and m["protocol_sha"]==sha((P/"protocol.json").read_bytes())
    parts=[struct.pack("<750d",*x) for x in rows]
    assert list(map(sha,parts))==m["role_sha"] and sha(base64.b64decode(a["header"])+b"".join(parts))==m["sha"]==score["locks"][ix]
    orig.append(rows)
u="https://researchdata.durham.ac.uk/downloads/r2x920fw90c"
q=urllib.request.Request(u,headers={"User-Agent":"independent raw Faraday analyzer score receiver"})
with urllib.request.urlopen(q,timeout=160) as f:b=f.read()
assert sha(b)==reg["source"]["sha256"]
checks=[];maxdiff=0.;maxmean=0.;gates=[];tail_rows=0
with zipfile.ZipFile(io.BytesIO(b)) as z:
    for ix,rep in enumerate(reg["repeats"]):
        A=orig[ix];ref=score["rows"][ix]
        n=f"Magneto_optical_rotation_via_HT_data_availability/Data without fit/Faraday/filter/filter_{rep}.csv"
        with z.open(n) as f:xy=[tuple(map(float,r)) for r in csv.reader(io.TextIOWrapper(f,encoding="ascii"))]
        x,raw=zip(*xy);y=tuple(v-1 for v in raw)
        assert len(y)==170000 and ref["raw_target_sha"]==sha(struct.pack("<170000d",*raw)) and ref["target_sha"]==sha(struct.pack("<170000d",*y))
        # Compare released measurement columns only. The author notebooks use Pandas'
        # inferred header on the original headerless scans. Keep all 170000 rows for scores.
        ep=n.replace("Data without fit","Data with fit").replace(".csv","_with_fit.csv")
        with z.open(ep) as ef: ex=[tuple(map(float,r)) for r in csv.reader(io.TextIOWrapper(ef,encoding="ascii"))]
        assert len(ex)==750
        for skip in (0,1):
            xx=[v*1000 for v in x[skip:]];ed=[xx[0]+i*(xx[-1]-xx[0])/750 for i in range(750)]+[xx[-1]]
            xs=[[] for _ in ex];ys=[[] for _ in ex]
            for i,u in enumerate(xx):
                q=min(749,bisect.bisect_right(ed,u)-1);xs[q].append(u);ys[q].append(y[skip+i])
            means=[math.fsum(a)/len(a) for a in ys];cent=[math.fsum(a)/len(a) for a in xs]
            off=[a-r[1] for a,r in zip(means,ex)]
            checks.append({"repeat":rep,"skip_source_rows":skip,"released_minus_predicted_min":-max(off),"released_minus_predicted_max":-min(off),"physical_residual_rms":math.sqrt(math.fsum(a*a for a in off)/750),"physical_minus_one_residual_rms":math.sqrt(math.fsum((a-1)**2 for a in off)/750),"detuning_max_abs_MHz":max(abs(a-r[0]) for a,r in zip(cent,ex))})
        low=min(x);high=max(x);st=(high-low)/750;edges=[low+i*st for i in range(750)]+[high]
        groups=[[] for _ in range(750)]
        for i,v in enumerate(x):groups[min(749,bisect.bisect_right(edges,v)-1)].append(i)
        nd=[D(0) for _ in A];na=nd[:];binrm=nd[:];binma=nd[:];bw=[(D(-1),-1) for _ in A];rw=bw[:];truth={}
        for k,G in enumerate(groups):
            ys=sorted((fd(y[i]),i) for i in G);cnt=len(ys);ysval=[t[0] for t in ys]
            accum=[D(0)]
            for q,_ in ys:accum.append(accum[-1]+q)
            sm=accum[-1];sq=sum(v*v for v in ysval);mean=sm/cnt;truth[k]=mean
            for a,row in enumerate(A):
                b=fd(row[k]);err=b-mean;binrm[a]+=err*err;binma[a]+=abs(err)
                if abs(err)>bw[a][0]:bw[a]=(abs(err),k)
                nd[a]+=cnt*b*b-2*b*sm+sq
                j=bisect.bisect_right(ysval,b);na[a]+=j*b-accum[j]+sm-accum[j]-(cnt-j)*b
                for endpoint in (ys[0],ys[bisect.bisect_left(ysval,ys[-1][0])]):
                    err=abs(b-endpoint[0]);idx=endpoint[1]
                    if err>rw[a][0] or (err==rw[a][0] and idx<rw[a][1]):rw[a]=(err,idx)
        rm=[]
        for a in range(10):
            metrics=[(binrm[a]/750).sqrt(),binma[a]/750,(nd[a]/170000).sqrt(),na[a]/170000];rm.append(metrics[0])
            for v,key in zip(metrics,["binned_rmse","binned_mae","native_rmse","native_mae"]):maxdiff=max(maxdiff,abs(float(v)-ref[key][a]))
            bw0=ref["bin_max"][a];rw0=ref["raw_max"][a];assert bw0["bin"]==bw[a][1] and rw0["native_row"]==rw[a][1]
            assert rw0["measured"]==y[rw[a][1]] and rw0["detuning_GHz"]==x[rw[a][1]]
        for row in ref["worst_primary_window"]:
            k=row["bin"];assert [role[k] for role in A]==row["forecasts"] and len(groups[k])==row["sample_count"]
            maxmean=max(maxmean,abs(float(truth[k])-row["measured"]));tail_rows+=1
        passed=all(rm[0]<rm[a] for a in [1,2,3,4,5]);assert ref["gate"]==passed;gates.append(passed)
assert maxdiff<1e-12 and maxmean<1e-12 and score["gate"]==all(gates)
print(json.dumps({"scope":"postscore author-prescribed physical ordinate; release columns audited separately","export_checks":checks,"native_rows":680000,"native_role_residuals":6800000,"binary64_forecasts":30000,"held_metrics":160,"extrema":80,"nearby_bins":tail_rows,"absolute_metric_difference":maxdiff,"absolute_neighborhood_mean_difference":maxmean,"gates":gates,"joint":all(gates),"archives":score["locks"]},sort_keys=True))
