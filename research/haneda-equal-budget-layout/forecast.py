"""Lock forecasts using two calibration sources and donor-only held-source projections."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import numpy as np
from projection import C,H,CENTER,OFF,OLD,MOVED,SQUARE,FREQ,DEV,HELD,PRIMARY
from layouts import optimal_layout,method_weights
from author_filters import load_checked,author_weights

LAYOUTS=("original","relocated","equal_aperture_optimal")
RIDGES=(1e-6,1e-4,.01,.1,1.)
FITTED=("shell_ridge","full_ridge","directional_residual")
FIXED=("author_directional","author_isotropic","line_directional")
def read_stage(path):
    with np.load(path,allow_pickle=False) as f:return {k:f[k] for k in f.files}

def prepare(sources,author):
    rows={}
    for speaker,z in sources.items():
        if not np.array_equal(z["centers"],CENTER) or not np.array_equal(z["frequencies"],FREQ):
            raise ValueError("Unmatched projection geometry")
        for name in LAYOUTS:
            raw=np.zeros((50,len(FREQ),32),complex)
            shells=np.zeros((50,len(FREQ),4),complex)
            estimates={k:np.zeros((50,len(FREQ)),complex) for k in FIXED}
            bounds=np.zeros((50,len(FREQ)),complex)
            layouts=[]
            for i,xyz in enumerate(CENTER):
                center=z["origin"]+.02*xyz
                source=z["source"]
                keep=OLD if name=="original" else MOVED if name=="relocated" else optimal_layout(center,source)
                layouts.append(keep.tolist())
                for j,freq in enumerate(FREQ):
                    values=z["donors"][i,keep,j]
                    raw[i,j,keep]=values
                    for shell in range(1,5):
                        mask=SQUARE[keep]==shell
                        if np.any(mask):shells[i,j,shell-1]=values[mask].mean()
                    iso,directional=method_weights(author,freq,center,source,keep)
                    estimates["author_isotropic"][i,j]=iso@values
                    estimates["author_directional"][i,j]=directional@values
                    line=np.all(OFF[keep,1:]==0,axis=1)
                    if np.any(line):
                        lw=author_weights(author,freq,center+H*OFF[keep[line]],center,source,True)
                        estimates["line_directional"][i,j]=lw@values[line]
                    if name=="relocated":
                        bounds[i,j]=-.5*shells[i,j,3]-3*shells[i,j,1]-.5*shells[i,j,2]
            rows[speaker,name]=dict(raw=raw,shells=shells,estimates=estimates,certified_filter=bounds,ids=layouts)
    return rows

def predict(rows,data,layout,method,ridge,train,test):
    a=rows[test,layout]
    if method in FIXED:return a["estimates"][method]
    feature="shells" if method=="shell_ridge" else "raw"
    X=np.concatenate([rows[s,layout][feature] for s in train])
    Y=np.concatenate([data[s]["targets"] for s in train])
    if method=="directional_residual":
        Y=Y-np.concatenate([rows[s,layout]["estimates"]["author_directional"] for s in train])
    ans=np.zeros((50,len(FREQ)),complex)
    for j in range(len(FREQ)):
        v=X[:,j]; gram=v.conj().T@v
        scale=float(np.trace(gram).real/v.shape[1])
        if not scale>0:raise ValueError("Zero calibration feature energy")
        weights=np.linalg.solve(gram+ridge*scale*np.eye(v.shape[1]),v.conj().T@Y[:,j])
        ans[:,j]=a[feature][:,j]@weights
    if method=="directional_residual":ans+=a["estimates"]["author_directional"]
    return ans

def per_frequency(pred,truth):
    energy=np.sum(abs(truth)**2,axis=0)
    if np.any(energy<=0):raise ValueError("Zero target energy")
    return np.sqrt(np.sum(abs(pred-truth)**2,axis=0)/energy)

def pack(values):return np.stack((values.real,values.imag),axis=-1).tolist()

def forecast(directory,output):
    directory=Path(directory)
    data={s:read_stage(directory/f"sp{s}.npz") for s in (*DEV,*HELD)}
    assert all(("targets" in data[s])==(s in DEV) for s in data)
    assert all(int(data[s]["speaker"])==s for s in data)
    with tempfile.TemporaryDirectory() as d:rows=prepare(data,load_checked(d))
    predictions={}; provenance={}
    for layout in LAYOUTS:
        candidates={}
        for method in (*FIXED,*FITTED):
            trials=[None] if method in FIXED else RIDGES
            results=[]
            for lam in trials:
                e=[]
                for tr,te in ((1,3),(3,1)):
                    pred=predict(rows,data,layout,method,lam,[tr],te)
                    e.append(float(per_frequency(pred,data[te]["targets"])[PRIMARY].mean()))
                results.append(dict(ridge=lam,per_source=e,mean=float(np.mean(e))))
            best=min(range(len(results)),key=lambda i:(results[i]["mean"],i))
            candidates[method]=dict(chosen=results[best],tested=results)
        selected=min(candidates,key=lambda k:candidates[k]["chosen"]["mean"])
        provenance[layout]=dict(methods=candidates,selected=selected)
        for s in HELD:
            bank={m:predict(rows,data,layout,m,v["chosen"]["ridge"],list(DEV),s) for m,v in candidates.items()}
            bank["selected"]=bank[selected]
            if layout=="relocated":bank["certified_filter"]=rows[s,layout]["certified_filter"]
            bank["zero"]=np.zeros_like(bank[selected])
            predictions[f"{s}/{layout}"]={arm:pack(a) for arm,a in bank.items()}
    result=dict(centers=CENTER.tolist(),frequencies=FREQ.tolist(),held=list(HELD),development=list(DEV),
                ids={f"{s}/{l}":x["ids"] for (s,l),x in rows.items() if s in HELD},
                calibration=provenance,forecasts=predictions)
    raw=json.dumps(result,separators=(",",":"),sort_keys=True,allow_nan=False).encode()
    Path(output).write_bytes(raw)
    print("FORECAST_LOCK",len(raw),hashlib.sha256(raw).hexdigest(),[provenance[l]["selected"] for l in LAYOUTS])

if __name__=="__main__":forecast(*sys.argv[1:])
