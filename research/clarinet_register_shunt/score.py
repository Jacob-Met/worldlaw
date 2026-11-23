"""Score the exact sealed arrays against the three preregistered open lower-body files per upper."""
import hashlib,io,json,pathlib,sys,zipfile
import numpy as np
from read_named_impedance import read_records,variables
def pair(x):return [float(x.real),float(x.imag)]
def main(raw_zip,forecast,sha):
    reg=json.load(open("protocol.json"));path=pathlib.Path(forecast)
    data=path.read_bytes();m=json.load(open(path.with_name("manifest.json")))
    assert hashlib.sha256(data).hexdigest()==sha==m["archive_sha"]
    with np.load(io.BytesIO(data),allow_pickle=False) as z: A=z["predictions"].astype(np.complex128)
    f,_,opened=read_records(raw_zip,reg,"score")
    target=np.stack([np.stack([opened[u,l] for l in reg["held_lower"]],axis=1) for u in reg["upper"]],axis=1)
    error=np.abs(A-target[None,...]);rms=np.sqrt(np.mean(error**2,axis=1));means=rms.mean(axis=(1,2))
    wins=[int(np.sum(rms[0]<r)) for r in rms];ix=np.unravel_index(np.argmax(error[0]),error[0].shape)
    k,i,j=(int(s) for s in ix);u=reg["upper"][i];l=reg["held_lower"][j]
    member=next(r for r in reg["acquisitions"] if r["path"].endswith(f"diam {u}/Z{l}.mat"))
    with zipfile.ZipFile(raw_zip) as z:record=z.read(member["path"])
    assert hashlib.sha256(record).hexdigest()==member["sha256"]
    vv=variables(record,{"Z_closed","Z_open","fmes"})
    window=[]
    for b in range(max(0,k-4),min(len(f),k+5)):
        window.append(dict(index=b,hz=f[b],Z_open=pair(vv["Z_open"][b]),Z_closed=pair(vv["Z_closed"][b]),open_reflection=pair(target[b,i,j]),role_reflections=[pair(x) for x in A[:,b,i,j]],role_errors=error[:,b,i,j].tolist()))
    worsts=[]
    for r in range(len(reg["roles"])):
        q,h,s=map(int,np.unravel_index(np.argmax(error[r]),error[r].shape));worsts.append(dict(index=q,hz=f[q],upper=reg["upper"][h],lower=reg["held_lower"][s],absolute=error[r,q,h,s]))
    subbands={}
    for name,inc in [("100_to_1000",f<1000),("1000_to_2000",(f>=1000)&(f<2000)),("2000_to_4000",f>=2000)]:
        subbands[name]=dict(rows=int(inc.sum()),mean_unit_rmse=np.sqrt(np.mean(error[:,inc]**2,axis=1)).mean(axis=(1,2)).tolist())
    gate=bool(all((means[0]<means[r] and wins[r]>=6) for r in range(1,len(means))) and max(np.array(m["fallback"])[0].ravel())/len(f)<.01)
    result=dict(gate=gate,archive_sha=sha,roles=reg["roles"],per_unit_rmse=rms.tolist(),mean_rmse=means.tolist(),primary_wins_of_9=wins,rows_per_unit=len(f),complex_residuals=int(error.size),worst_by_role=worsts,subbands=subbands,worst_primary=dict(upper=u,lower=l,index=k,window=window))
    print(json.dumps(result,sort_keys=True,allow_nan=False))
if __name__=="__main__":main(*sys.argv[1:])
