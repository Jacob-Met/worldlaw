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
            if i==0:
                # The released notebook multiplies the first fourth-column value by 1000.
                shaft_setting = 1000 * float(cols[3])
                named = sorted(SOURCE+HELD, key=lambda n:abs(n-shaft_setting))
                if not math.isfinite(shaft_setting) or shaft_setting<=0 or named[0]!=rpm or abs(named[0]-shaft_setting)==abs(named[1]-shaft_setting):
                    raise ValueError(f"ambiguous converted rotation {path}")
            times.append(float(cols[0]));pot.append(float(cols[1]))
            if allow_current: curr.append(float(cols[2])/AREA)
    if len(pot)<50 or not all(math.isfinite(v) for v in times+pot+curr): raise ValueError(f"invalid input {path}")
    if any(b<a for a,b in zip(times,times[1:])): raise ValueError(f"clock {path}")
    steps = [b-a for a,b in zip(pot,pot[1:])]
    inc, dec = any(x>0 for x in steps), any(x<0 for x in steps)
    if inc == dec: raise ValueError(f"changing direction or constant applied voltage {path}")
    return pot,curr,dict(sweep_direction="increasing" if inc else "decreasing",nominal_rpm=rpm,notebook_rpm=shaft_setting,rows=len(pot),start=times[0],end=times[-1],potential_support=[min(pot),max(pot)])

def forecast_inputs(z,metal):
    import numpy as np
    source={};target={};info={}
    for r in SOURCE+HELD:
        e,j,info[str(r)]=rows(z,metal,r,r in SOURCE)
        if r in SOURCE: source[r]=(np.asarray(e),np.asarray(j))
        else: target[r]=np.asarray(e)
    return source,target,info
