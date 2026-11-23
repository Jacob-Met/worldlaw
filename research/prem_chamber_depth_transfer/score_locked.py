"""Check all 44 locked arrays before retrieving either held emitted spectrum."""
import base64,hashlib,json,pathlib
import numpy as np
from chamber_inputs import data
P=pathlib.Path(".")
def read(n):return json.loads((P/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
reg=read("protocol.json");seeds=reg["transport"]["seeds"];locks=[];arrs=[]
for seed in seeds:
    rec=read(f"forecast-lock-{seed}.json")["forecast"];j=read(f"forecast-{seed}.json")
    A=np.asarray(j["vectors"],dtype="<f8")
    assert j["seed"]==rec["seed"]==seed and rec["held_sle_read"]==0
    assert rec["protocol_sha"]==sha((P/"protocol.json").read_bytes()) and rec["roles"]==reg["roles"]
    assert j["shape"]==rec["shape"]==list(A.shape)==[2,11,568] and np.isfinite(A).all()
    blob=base64.b64decode(j["header"],validate=True)+A.tobytes()
    assert len(blob)==rec["npy_bytes"] and sha(blob)==rec["npy_sha"]
    assert [[sha(v.tobytes()) for v in u] for u in A]==rec["digest"]
    locks.append(rec["npy_sha"]);arrs.append(A)
# Only this point may see the held simulated-lunar-environment columns G and K.
d=data(reg,score=True);Y=np.stack([d["G"],d["K"]]);W=np.stack([d["E"],d["I"]])
out={"roles":reg["roles"],"seeds":seeds,"locks":locks,"measured_cells":Y.size,"residuals":2*2*11*568,
     "truth_sha":[sha(np.asarray(a,dtype="<f8").tobytes()) for a in Y],"replicates":[]}
for A in arrs:
    err=A-Y[:,None,:];ab=np.abs(err);rm=np.sqrt(np.mean(err**2,axis=2));mae=ab.mean(axis=2)
    maxima=[];episodes=[]
    for i in range(2):
        role=[]
        for j in range(11):
            n=int(ab[i,j].argmax())
            role.append({"bin":n,"wavelength":W[i,n],"truth":Y[i,n],"forecast":A[i,j,n],"signed_error":err[i,j,n]})
        maxima.append(role)
        n=int(ab[i,0].argmax())
        episodes.append([{"bin":k,"wavelength_um":W[i,k],"truth":Y[i,k],"forecast":A[i,:,k].tolist(),"signed_errors":err[i,:,k].tolist()} for k in range(max(0,n-3),min(568,n+4))])
    out["replicates"].append({"rmse":rm.tolist(),"mae":mae.tolist(),"maxima":maxima,"primary_worst_windows":episodes,
        "passes_by_comparator":{reg["roles"][j]:(rm[:,0]<rm[:,j]).tolist() for j in [1,5,6,7,8]},
        "gate":bool(np.all(rm[:,0:1]<rm[:,[1,5,6,7,8]]))})
out["gate"]=all(v["gate"] for v in out["replicates"])
print(json.dumps(out,sort_keys=True),flush=True)
