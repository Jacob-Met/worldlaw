"""Generate and lock all models from angular solar observations only."""
import base64
import hashlib
import io
import json
from pathlib import Path
import numpy as np
from acquisition import acquire, vacuum
from model import C,V,feature,profiles_for

ROOT=Path(__file__).resolve().parent


def main():
    proto=json.loads((ROOT/"protocol.json").read_text())
    lines=np.array(proto["lines_air_angstrom"])
    mu=np.array(proto["source"]["angles"])
    dates=proto["target"]["dates"]
    source,auth,receipts=acquire(proto)
    flux=np.empty((len(mu),len(lines),len(V)))
    empirical=np.empty((len(lines),len(V)))
    for j,lam in enumerate(lines):
        vlam=float(vacuum(lam))*np.exp(V/C)
        for i in range(len(mu)):
            x,y=source[i][j]
            if x[0]>vlam[0] or x[-1]<vlam[-1]:raise ValueError("input unbracketed")
            flux[i,j]=np.interp(vlam,x,y)
        x,y=auth[j]
        if x[0]>vlam[0] or x[-1]<vlam[-1]:raise ValueError("published control unbracketed")
        empirical[j]=np.interp(vlam,x,y)
    out=[];records=[]
    for day in dates:
        part=[]
        for j,lam in enumerate(lines):
            absorption=np.stack([feature(f)[0] for f in flux[:,j]])
            kwargs=dict(mu=mu,local=absorption,author=empirical[j],lam=lam,date=day)
            pred,m=profiles_for(**kwargs)
            pert={}
            for label,delta in [("omit_limb",{"limb":"omit"}),("linear_limb",{"limb":"linear"}),
                                  ("sidereal",{"sidereal":True}),("start_date",{"hours":0}),
                                  ("end_date",{"hours":24})]:
                changed,_=profiles_for(**kwargs,**delta)
                pert[label]=float(np.sqrt(np.mean((changed[0,abs(V)<=6]-pred[0,abs(V)<=6])**2)))
            part.append(pred)
            records.append(dict(date=day,air_line=float(lam),geometry=m,sensitivity=pert,
                full_coupling_rms=float(np.sqrt(np.mean((pred[0,abs(V)<=6]-pred[1,abs(V)<=6])**2)))))
        out.append(part)
    arrays=dict(v=V,mu=mu,lines=lines,resolved_flux=flux,published_full_flux=empirical,predictions=np.array(out))
    if not all(np.all(np.isfinite(a)) for a in arrays.values()):raise ValueError("nonfinite science output")
    if arrays["predictions"].shape!=(3,8,5,441):raise ValueError("incomplete predictions")
    buf=io.BytesIO();np.savez_compressed(buf,**arrays);packet=buf.getvalue()
    stamp={"source_slices":receipts,"record_count":len(records),"records":records,
           "asset_shapes":{k:list(a.shape) for k,a in arrays.items()},
           "array_hashes":{k:hashlib.sha256(np.ascontiguousarray(a,dtype='<f8').tobytes()).hexdigest() for k,a in arrays.items()},
           "packet_bytes":len(packet),"packet_sha256":hashlib.sha256(packet).hexdigest(),"held_target_rows_opened":0}
    print("FORECAST "+json.dumps(stamp,sort_keys=True,separators=(",",":")),flush=True)
    for start in range(0,len(packet),36000):
        print("PACK "+str(start)+" "+base64.b64encode(packet[start:start+36000]).decode(),flush=True)


if __name__=="__main__":
    main()
