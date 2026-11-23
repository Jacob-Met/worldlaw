"""Forecast nine complete open-port acquisitions before their named variables become readable."""
import base64,hashlib,io,json,os,pathlib,tempfile,sys
import numpy as np
from author_tube import channels
from fit_shunt import fit,synthetic
from read_named_impedance import read_records

def cube(data,us,ls):
    return np.stack([np.stack([data[u,l] for l in ls],axis=1) for u in us],axis=1)
def main(archive):
    synthetic()
    reg=json.load(open("protocol.json"));U=reg["upper"];tr=reg["calibration_lower"];te=reg["held_lower"]
    f,closed,opened=read_records(archive,reg,"forecast")
    if set(opened)!={(u,l) for u in U for l in tr}:raise ValueError("invalid training targets")
    z=cube(closed,U,tr);w=cube(opened,U,tr);test=cube(closed,U,te)
    lens=reg["geometry"]["L2"];out=np.empty((9,len(f),3,3),dtype="<c8")
    fallback=np.zeros((3,3,3),int);mincond=1.
    for k in range(0,len(f),256):
        section=slice(k,k+256);vals,bad,cond=fit(z[section],w[section],test[section])
        for i,val in enumerate(vals):out[i,section]=val;fallback[i]+=bad[i].sum(axis=0)
        mincond=min(mincond,float(np.min(cond)))
    delta=w-z
    for t,l in enumerate(te):
        a=tr[t];b=tr[t+1];alpha=(lens[l-1]-lens[a-1])/(lens[b-1]-lens[a-1])
        out[3,:,:,t]=test[:,:,t]+(1-alpha)*delta[:,:,t]+alpha*delta[:,:,t+1]
    out[4]=test
    out[8]=test+np.mean(delta,axis=2,keepdims=True)
    # Select exactly one global sign/adapter convention using training opens.
    variants=[(0.,False),(0.,True),(.065,False),(.065,True)]
    errors=[]
    for ad,conj in variants:
        per=[]
        for u in U:
            for l in tr:
                d,trans=channels(f,reg["geometry"],u,l,ad,conj)
                per.append(float(np.sqrt(np.mean(abs(trans(closed[u,l])-opened[u,l])**2))))
        errors.append(np.mean(per))
    choice=int(np.argmin(errors));ad,cj=variants[choice]
    for i,u in enumerate(U):
        for h,l in enumerate(te):
            d,trans=channels(f,reg["geometry"],u,l)
            out[5,:,i,h]=d;out[6,:,i,h]=trans(closed[u,l])
            _,sel=channels(f,reg["geometry"],u,l,ad,cj);out[7,:,i,h]=sel(closed[u,l])
    if not np.isfinite(out).all():raise ValueError("nonfinite forecast")
    root=pathlib.Path(tempfile.mkdtemp(prefix="clarinet-forecast-",dir=os.environ.get("TMPDIR")))
    path=root/"predictions.npz";np.savez_compressed(path,predictions=out,frequencies=f.astype("<f8"))
    raw=path.read_bytes()
    digests={f"{ri}/{u}/{l}":hashlib.sha256(out[ri,:,h,j].tobytes()).hexdigest() for ri in range(len(reg["roles"])) for h,u in enumerate(U) for j,l in enumerate(te)}
    manifest=dict(protocol_sha=hashlib.sha256(open("protocol.json","rb").read()).hexdigest(),archive_sha=hashlib.sha256(raw).hexdigest(),archive_bytes=len(raw),path=str(path),shape=out.shape,axes=["role","frequency","upper","held_lower"],roles=reg["roles"],digests=digests,min_dlt_ratio=mincond,fallback=fallback.tolist(),variant_scores=errors,variant_adaptor=ad,variant_conjugated=cj,held_opens_decoded=0)
    (root/"manifest.json").write_text(json.dumps(manifest,sort_keys=True))
    print("LOCK",json.dumps(manifest,sort_keys=True),flush=True)
    print("ARCHIVE",base64.b64encode(raw).decode("ascii"),flush=True)
if __name__=="__main__":main(sys.argv[1])
