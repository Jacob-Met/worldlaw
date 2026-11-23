"""Load the frozen subset of the deposited coil campaigns, without the later chamber."""
import csv,hashlib,io,json
from pathlib import Path
import numpy as np
from qualify_methods import fetch
ROOT=Path(__file__).resolve().parent
SENSORS=np.delete(np.arange(64),23)
I=np.array([-1.8,-1.2,-.6,0,.6,1.2,1.8])
def read_coils(e,roster):
    moments=np.empty((3,7,63,3));stats=[];ledger=[]
    ids=None
    for a,axis in enumerate("XYZ"):
        for j,amp in enumerate(I):
            name=f"Raw Data/Exposure_{e}T/DC_field_{amp:.1f}A_300pts_{axis}.csv"
            raw=fetch(name,roster)
            rows=list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
            if len(rows)!=19200 or any(len(row)!=4 for row in rows):raise ValueError(("DC tabular schema",name,len(rows),rows[0][:1]))
            keys=[row[0].strip() for row in rows];first=tuple(keys[:64])
            if len(set(first))!=64 or keys!=list(first)*300:raise ValueError(("source sensor identifiers",name,len(set(first)),first[:6]))
            if ids is None:ids=first
            if first!=ids:raise ValueError("changed channel order")
            val=np.asarray([[float(y) for y in row[1:]] for row in rows]).reshape(300,64,3)[:,SENSORS]
            if not np.all(np.isfinite(val)):raise ValueError(("invalid eligible chip",name))
            moments[a,j]=val.mean(0)
            ledger.append(dict(name=name,bytes=len(raw),md5=roster[name],sha256=hashlib.sha256(raw).hexdigest()))
            stats.append(dict(name=name,minimum=val.min((0,1)).tolist(),maximum=val.max((0,1)).tolist(),max_within_chip_sd=val.std(0).max(0).tolist()))
    # M[s,output,pose] has native readout units per nominal ampere.
    c=moments.mean(1)
    M=(np.einsum("ajsv,j->sva",moments,I)/(I@I))
    implied=c[:,None]+np.einsum("sva,j->ajsv",M,I)
    return moments,c,M,dict(ledger=ledger,stats=stats,ids=ids,maximum_level_residual=np.max(np.abs(moments-implied),axis=(0,1,2)).tolist())
def chamber(e,r):
    name=f"Raw Data/Exposure_{e}T/Zero_gauss_chamber_after{e}T_averaged_carton.csv"
    raw=fetch(name,r);a=np.genfromtxt(io.BytesIO(raw),delimiter=",",dtype=float)
    if a.shape!=(64,3) or not np.all(np.isfinite(a[SENSORS])):raise ValueError(("chamber dimensions",e,a.shape))
    return a[SENSORS],dict(name=name,sha256=hashlib.sha256(raw).hexdigest(),md5=r[name],bytes=len(raw))
