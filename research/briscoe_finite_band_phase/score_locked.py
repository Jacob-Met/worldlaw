"""Authenticate the four frozen forecast arrays before opening any analyzer transmission."""
import base64,hashlib,io,json,pathlib,zipfile
import numpy as np
from forecast import checksummed_archive,name
def sha(b):return hashlib.sha256(b).hexdigest()
P=pathlib.Path(".");reg=json.loads((P/"protocol.json").read_text());assert reg["repeats"]==[1,2,3,4]
allA=[];locks=[];ax=json.loads((P/"axes.json").read_text())
for rep in reg["repeats"]:
    dst=json.loads((P/f"forecast-{rep}.json").read_text());meta=json.loads((P/f"forecast-lock-{rep}.json").read_text())["meta"]
    A=np.array(dst["vectors"],dtype="<f8");assert np.isfinite(A).all() and list(A.shape)==meta["shape"]==[10,750]
    origin=base64.b64decode(dst["header"],validate=True)+A.tobytes()
    assert meta["repeat"]==rep==dst["repeat"] and reg["roles"]==meta["roles"] and meta["target_ordinates_read"]==0
    assert meta["protocol_sha"]==sha((P/"protocol.json").read_bytes())
    assert sha(origin)==meta["sha"] and len(origin)==meta["n"] and [sha(x.tobytes()) for x in A]==meta["role_sha"]
    assert meta["target_axis_sha"]==ax[f"filter/filter_{rep}.csv"]["vector_sha"]
    locks.append(meta["sha"]);allA.append(A)
# Eligibility is all four. The archive is fetched only after every lock passes.
z=checksummed_archive(reg);rows=[]
def metric(a):return np.sqrt(np.mean(a*a,axis=1)).tolist(),np.mean(abs(a),axis=1).tolist()
for rep,A in zip(reg["repeats"],allA):
    with z.open(name("filter",rep)) as f:D=np.loadtxt(f,delimiter=",")
    assert D.shape==(170000,2) and np.isfinite(D).all();x,y=D.T
    assert sha(np.asarray(x,dtype="<f8").tobytes())==ax[f"filter/filter_{rep}.csv"]["vector_sha"]
    edges=np.linspace(x.min(),x.max(),751);i=np.searchsorted(edges,x,side="right")-1;i[x==edges[-1]]=749
    assert i.min()==0 and i.max()==749
    ct=np.bincount(i,minlength=750);assert (ct>0).all()
    b=np.bincount(i,weights=y,minlength=750)/ct;err=A-b;br,bm=metric(err)
    nr,nm=metric(A[:,i]-y)
    binmax=[]
    for k in range(10):
        u=int(np.argmax(abs(err[k])));binmax.append({"bin":u,"bounds_GHz":edges[u:u+2].tolist(),"measured":b[u],"estimate":A[k,u],"signed":err[k,u]})
    u=binmax[0]["bin"];span=[]
    for k in range(max(0,u-3),min(750,u+4)):
        span.append({"bin":k,"bounds_GHz":edges[k:k+2].tolist(),"sample_count":int(ct[k]),"measured":b[k],"forecasts":A[:,k].tolist(),"signed":err[:,k].tolist()})
    native=abs(A[:,i]-y).argmax(axis=1);raw=[]
    for r,v in enumerate(native):
        raw.append({"native_row":int(v),"detuning_GHz":x[v],"bin":int(i[v]),"measured":y[v],"forecast":A[r,i[v]],"at_row_all_signed":(A[:,i[v]]-y[v]).tolist()})
    rows.append({"repeat":rep,"target_sha":sha(np.asarray(y,dtype="<f8").tobytes()),"binned_rmse":br,"binned_mae":bm,"native_rmse":nr,"native_mae":nm,"bin_max":binmax,"raw_max":raw,"worst_primary_window":span,"wins":[br[0]<br[k] for k in range(10)],"gate":all(br[0]<br[k] for k in (1,2,3,4,5))})
print(json.dumps({"roles":reg["roles"],"locks":locks,"rows":rows,"gate":all(r["gate"] for r in rows),"native_cells":680000,"native_residuals":6800000,"bin_residuals":30000},sort_keys=True),flush=True)
