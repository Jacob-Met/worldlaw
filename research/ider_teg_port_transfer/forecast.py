"""Create frozen electrical-port functions without opening any of the 28 test members."""
import bisect,concurrent.futures,json,hashlib,math,statistics
from pathlib import Path
from catalog import fetch
from reader import manifest
from training import data,linear
def avg(v):
    v=list(v);return math.fsum(v)/len(v)
GRID=[-.10+.025*i for i in range(47)]
ORD=[0,1,2,4,8,16,32,64,128,256,512,768,1024,1536]
def interp(x,y,q):
    i=bisect.bisect_left(x,q)
    if i==0:return y[0]
    if i==len(x):return y[-1]
    return y[i-1]+(q-x[i-1])*(y[i]-y[i-1])/(x[i]-x[i-1])
def role(e,r,x=(),y=(),axis="relative_voltage"):
    assert all(math.isfinite(v) and v>0 for v in [e,r])
    return {"E":e,"R":r,"x":list(x),"y":list(y),"axis":axis}
def evaluate(fun,v,idx):
    x=v/fun["E"];z=idx if fun["axis"]=="row" else x
    return fun["E"]/fun["R"]*(1.-x+(interp(fun["x"],fun["y"],z) if fun["x"] else 0.))
def create(records,p):
    xy=lambda m,j:records[f"TEG{m}_{j}.txt"]
    meta={};profiles={};ordinary={}
    for m in range(1,9):
        for j in range(1,10 if m<=4 else 3):
            d=10*j;rows=xy(m,j);fit=linear(rows);e=fit["effective_open_V"];r=fit["effective_R"];assert e>0 and r>0
            meta[m,j]=[e/d,r]
            vx=[v/e for v,_ in rows];assert all(a<b for a,b in zip(vx,vx[1:]))
            residual=[i*r/e-(1-v/e) for v,i in rows]
            profiles[m,j]=[interp(vx,residual,q) for q in GRID]
            ordinary[m,j]=residual
    anc={m:[avg(meta[m,j][i] for j in (1,2)) for i in range(2)] for m in range(1,9)}
    donors=[(m,j) for m in range(1,5) for j in range(1,10)]
    def profile(ids):return [avg(profiles[k][l] for k in ids) for l in range(len(GRID))]
    curve=profile(donors);og=[q for q in ORD if any(len(ordinary[k])>q for k in donors)]
    elapsed=[avg(ordinary[k][q] for k in donors if len(ordinary[k])>q) for q in og]
    global_fits=[]
    for i in range(2):
        x=[10*j-15 for m,j in donors];y=[meta[m,j][i]/anc[m][i]-1 for m,j in donors]
        a=sum(v*v for v in x);b=sum(v**3 for v in x);c=sum(v**4 for v in x);d=math.fsum(u*v for u,v in zip(x,y));e=math.fsum(u*u*v for u,v in zip(x,y))
        global_fits.append([d/a,(c*d-b*e)/(a*c-b*b),(a*e-b*d)/(a*c-b*b)])
    out={}
    for m in range(5,9):
        for j in range(3,10):
            d=j*10;x=d-15;ks=[(h,j) for h in range(1,5)];dcurve=profile(ks)
            def calibrated(a,quadratic=False):
                return [a[i]*(1+(global_fits[i][1] if quadratic else global_fits[i][0])*x+(global_fits[i][2]*x*x if quadratic else 0.)) for i in range(2)]
            A=calibrated(anc[m]);wrong=calibrated(anc[5+(m-4)%4]);quad=calibrated(anc[m],True)
            rel=[anc[m][i]*avg(meta[h,j][i]/anc[h][i] for h,_ in ks) for i in range(2)]
            add=[anc[m][i]+avg(meta[h,j][i]-anc[h][i] for h,_ in ks) for i in range(2)]
            local=[math.exp((math.log(meta[m,1][i])+math.log(meta[m,2][i]))/2+x*(math.log(meta[m,2][i])-math.log(meta[m,1][i]))/10) for i in range(2)]
            shrink=[math.sqrt(u*v) for u,v in zip(A,local)]
            nearest=min(range(1,5),key=lambda h:sum(math.log(anc[h][i]/anc[m][i])**2 for i in range(2)))
            nn=[anc[m][i]*meta[nearest,j][i]/anc[nearest][i] for i in range(2)]
            def model(ar,shape=()):return role(d*ar[0],ar[1],GRID if shape else (),shape)
            out[f"TEG{m}_{j}.txt"]={
              "integrated_shape":model(A,curve),"integrated_line":model(A),"elapsed_shape":role(d*A[0],A[1],og,elapsed,"row"),
              "constant_thevenin":model(anc[m]),"source_mean_curve":model([avg(meta[k][i] for k in ks) for i in range(2)],dcurve),
              "relative_by_setting":model(rel),"relative_by_setting_shape":model(rel,dcurve),"additive_by_setting":model(add,dcurve),
              "local_gradient":model(local,curve),"shrunk_local":model(shrink,curve),"quadratic_shared":model(quad,curve),
              "nearest_corrected":model(nn,profiles[nearest,j]),"wrong_module":model(wrong,curve)}
    assert all(list(a)==p["roles"] for a in out.values())
    return out,global_fits
if __name__=="__main__":
    specs=manifest();pri=json.loads(Path("training-summary.json").read_bytes());p=json.loads(Path("protocol.json").read_bytes());split=json.loads(Path("split.json").read_bytes())
    assert all(specs[k]["content_details"]["sha256_hash"].lower()==a["sha256"] and specs[k]["id"]==a["id"] for k,a in pri["pins"].items())
    def read(k):
        assert k in split["source"];rows,h=data(specs[k]);assert h==pri["pins"][k]["sha256"];return k,rows
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:records=dict(pool.map(read,split["source"]))
    out,fit=create(records,p);assert set(out)==set(split["held"])
    shapes=[];grids=[];refs={}
    for k,roles in out.items():
        refs[k]={}
        for r,v in roles.items():
            grid=[v["axis"],v["x"]]
            if grid not in grids:grids.append(grid)
            shape=[grids.index(grid),v["y"]]
            if shape not in shapes:shapes.append(shape)
            refs[k][r]=[v["E"],v["R"],shapes.index(shape)]
    print(json.dumps({"models":refs,"grids":grids,"shapes":shapes,"global_slopes":fit,"training_n":sum(len(x) for x in records.values()),"roles":p["roles"],"protocol_sha256":hashlib.sha256(Path("protocol.json").read_bytes()).hexdigest()},allow_nan=False,separators=(",",":"),sort_keys=True))
