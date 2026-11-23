"""Read the registered single-pH rows with a separate held target entry."""
import hashlib
import io
import math
import zipfile

SOURCE = (400,625,900,1600,2025)
HELD = (1225,2500)
AREA = math.pi * .25**2
ARCHIVE = 'a191eb58d0ec89c9b6342d674b3dc5ccde1285acdaf125e2778f384de0f02f68'

def opened(data):
    if hashlib.sha256(data).hexdigest()!=ARCHIVE: raise ValueError("archive custody")
    return zipfile.ZipFile(io.BytesIO(data))

def rows(z,metal,rpm,allow_current):
    path=f'src/pH10.458/{metal}/pH10.458_{metal}_{rpm:04d}rpm.tsv'
    times=[];pot=[];curr=[]
    with z.open(path) as f:
        header=f.readline().decode('utf-8-sig').strip().split('\t')
        if header!=['Time (s)','Potential applied (V)','WE(1).Current (A)','Column 4']: raise ValueError(f"header {path}")
        for i,line in enumerate(f):
            if not line.strip(): continue
            cols=line.rstrip(b'\r\n').split(b'\t')
            if len(cols)<3: raise ValueError(f"schema {path}")
            if i==0 and (len(cols)<4 or float(cols[3])!=rpm): raise ValueError(f"rotation binding {path}")
            times.append(float(cols[0]));pot.append(float(cols[1]))
            if allow_current: curr.append(float(cols[2])/AREA)
    if len(pot)<50 or not all(math.isfinite(v) for v in times+pot+curr): raise ValueError(f"invalid input {path}")
    if any(b<a for a,b in zip(times,times[1:])): raise ValueError(f"clock {path}")
    if any(b<a for a,b in zip(pot,pot[1:])): raise ValueError(f"nonmonotonic applied voltage {path}")
    return pot,curr,dict(rows=len(pot),start=times[0],end=times[-1],potential_support=[min(pot),max(pot)])

def forecast_inputs(z,metal):
    import numpy as np
    source={};target={};info={}
    for r in SOURCE+HELD:
        e,j,info[str(r)]=rows(z,metal,r,r in SOURCE)
        if r in SOURCE: source[r]=(np.asarray(e),np.asarray(j))
        else: target[r]=np.asarray(e)
    return source,target,info
