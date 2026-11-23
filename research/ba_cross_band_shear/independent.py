"""Reconstruct both panels from the author archive with independent I/O and 65-digit arithmetic."""
from decimal import Decimal as D,getcontext
import hashlib,io,json,math,urllib.request
import libarchive,openpyxl
getcontext().prec=65
source="https://zenodo.org/records/8371594/files/Data.rar?download=1"
with urllib.request.urlopen(urllib.request.Request(source,headers={"User-Agent":"independent geophysics archive receiver"}),timeout=120) as f: raw=f.read()
assert hashlib.sha256(raw).hexdigest()=="939bd8a15c38a6944810bae9a578f2c439c0fe3de29efa957751cde8bf5feb60"
tables={}
with libarchive.memory_reader(raw) as ar:
    for ent in ar:
        n=ent.pathname
        if not n.endswith(".xlsx"):continue
        bb=b"".join(ent.get_blocks());wb=openpyxl.load_workbook(io.BytesIO(bb),read_only=True,data_only=True)
        assert len(wb.sheetnames)==1
        body=list(wb.active.values);wb.close()
        key=n.split("Sample D_")[1][:-5]; d={}
        if key.startswith("Seismic"):
            p=None
            for p0,f,v,s in body[1:]:
                if p0 is not None:p=int(p0.removesuffix("MPa"));assert p not in d;d[p]=[]
                d[p].append((int(f),D(str(v)),D(str(s))))
        else:
            for p,v,s in body[1:]:
                if p is None:assert s is None and v is None;continue
                d[int(p)]=(D(str(v)),D(str(s)))
        tables[key]=d
lock=json.load(open("forecast-lock.json"));bs=open("forecasts.json","rb").read()
assert len(bs)==lock["bytes"] and hashlib.sha256(bs).hexdigest()==lock["sha256"]
forecasts=json.loads(bs);scores=json.load(open("scores.json"))
def avg(v):return sum(v)/D(len(v))
def ls(a,b,z,clip=False):
    var=sum((x-y)**2 for i,x in enumerate(a) for y in a[:i])
    cross=sum((x-y)*(b[i]-b[j]) for i,x in enumerate(a) for j,y in enumerate(a[:i]))
    slope=cross/var if var else D(0)
    if clip:slope=max(D(0),min(D(".75"),slope))
    return avg(b)+slope*(z-avg(a))
def pack(fluid,p,m):
    l=[r for r in tables["Seismic_"+fluid][p] if r[0]<=m]; x=[v*v for _,v,s in l];y=[s*s for _,v,s in l]
    v,s=tables["Ultrasonic_"+fluid][p]; u=v*v
    return x,y,u,s*s,ls(x,y,u,True),ls(x,y,u)
nf=nr=nm=nt=0; md=D(0); mmetric=D(0);ex=[]
for pan,pres,m in [("primary",[1,3,5,8,10,15,20],128),("paper_range",[5,8,10,15,20],100)]:
    ps=forecasts[pan];ms=scores[pan];errors={}
    g={p:pack("Gas",p,m) for p in pres};b={p:pack("Brine",p,m) for p in pres}
    dx=[g[p][2]-g[p][0][-1] for p in pres];dy=[g[p][3]-g[p][1][-1] for p in pres]
    for i,p in enumerate(pres):
        x,y,u,tr,c,free=b[p];gx,gy,gu,gtr,gc,gf=g[p];ng=g[pres[(i+1)%len(pres)]]
        vals={"calibrated_constrained":c+(gtr-gc),"direct_constrained":c,"calibrated_unbounded":free+(gtr-gf),"direct_unbounded":free,
            "cyclic_residual":c+(ng[3]-ng[4]),"brine_last_shear":y[-1],"brine_mean_shear":avg([v.sqrt() for v in y])**2,
            "brine_last_poisson":u*y[-1]/x[-1],"gas_ultrasonic_shear":gtr,"gas_ultrasonic_poisson":u*gtr/gu,"gas_shear_ratio":y[-1]*gtr/gy[-1],
            "gas_shear_increment":y[-1]+gtr-gy[-1],"brine_origin_regression":u*sum(x0*y0 for x0,y0 in zip(x,y))/sum(v*v for v in x),
            "gas_global_increment":y[-1]+ls(dx,dy,u-x[-1]),"all_shear_change":y[-1]+(u-x[-1])*D(".75")}
        target=tr.sqrt();assert abs(target-D(str(scores["targets"][str(p)])))<D("1e-9");nt+=1
        assert set(vals)==set(ps["rows"][i]["forecast"])
        for n,v in vals.items():
            pred=v.sqrt(); delta=abs(pred-D(str(ps["rows"][i]["forecast"][n])));md=max(md,delta);nf+=1
            e=pred-target;errors.setdefault(n,[]).append(e)
            assert abs(e-D(str(ms["signed_errors"][n][i])))<D("2e-9");nr+=1
    mets={}
    for n,e in errors.items():
        rmse=avg([v*v for v in e]).sqrt();mae=avg(list(map(abs,e)));wi=max(range(len(e)),key=lambda j:abs(e[j]))
        met=ms["metrics"][n];assert met["worst"]==pres[wi]
        d=max(abs(rmse-D(str(met["rmse"]))),abs(mae-D(str(met["mae"]))),abs(e[wi]-D(str(met["worst_signed"]))))
        mmetric=max(mmetric,d);nm+=3
        wins=sum(abs(a)<abs(b) for a,b in zip(errors["calibrated_constrained"],e))
        assert wins==met["candidate_strict_wins"];mets[n]=(rmse,mae,wins)
    rm,ma,_=mets["calibrated_constrained"]
    gate=all(rm<mets[k][0] and ma<mets[k][1] and mets[k][2]>=len(pres)//2+1 for k in ps["strict_controls"]) and all(rm<=mets[k][0] and ma<=mets[k][1] for k in ["direct_unbounded","calibrated_unbounded"])
    assert gate==ms["gate"];ex.append([pan,gate])
assert md<D("2e-9") and mmetric<D("2e-9")
print(json.dumps({"native_raw_rar_bytes":len(raw),"forecast":lock["sha256"],"source_io":"libarchive memory reader and openpyxl; no registered predictor/scorer imported","precision":65,"pressure_rows_including_sensitivity":nt,"forecast_cells":nf,"residuals":nr,"rmse_mae_and_worst_value_cells":nm,"worst_indices_and_win_counts":60,"max_forecast_gap":str(md),"max_metric_gap":str(mmetric),"gates":ex},sort_keys=True))
