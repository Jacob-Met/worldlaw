"""Build a condition-only shear proxy from published optical velocity and height pairs."""
import json
import math
import re
from literal_development import books
from schema import FILES
from clock_and_repeat import val

def profiles():
    filename=next(n for n in FILES if n.startswith("S1"))
    records={}
    for name, rows, ss in books(filename):
        header=next(i for i,row in enumerate(rows[:7]) if any(re.fullmatch(r"g[1-9]",str(val(c,ss))) for c in row.values()))
        markers=[(k,val(c,ss)) for k,c in sorted(rows[header].items()) if re.fullmatch(r"g[1-9]",str(val(c,ss)))]
        for j,(start,rep) in enumerate(markers):
            stop=markers[j+1][0] if j+1<len(markers) else max(rows[header+2])+1
            observations=[]
            for k in range(start,stop):
                if val(rows[header+2].get(k),ss)!="u velocity (m/s)":continue
                assert val(rows[header+2].get(k+1),ss)=="flow height h (cm)"
                t=float(val(rows[header+1][k],ss))
                pairs=[]
                for row in rows[header+3:]:
                    u=val(row.get(k),ss)
                    h=val(row.get(k+1),ss)
                    if u is None or h is None:break
                    try:pairs.append((.01*float(h),float(u)))
                    except ValueError:break
                if len(pairs)>=2:
                    lo=min(pairs);hi=max(pairs)
                    slope=abs((hi[1]-lo[1])/(hi[0]-lo[0])) if hi[0]>lo[0] else None
                else:slope=None
                if slope is not None:assert math.isfinite(slope)
                observations.append([t,len(pairs),slope])
            assert observations
            records[name+":"+rep]=observations
    return records
def condition_shear(records):
    means={}
    for name, rows in sorted(records.items()):
        observed=[x[2] for x in rows if x[2] is not None]
        if observed:means.setdefault(name.split(":")[0],[]).append(math.fsum(observed)/len(observed))
    return {k:math.fsum(v)/len(v) for k,v in means.items()}
if __name__=="__main__":
    data=profiles()
    print(json.dumps({"profiles":data,"secant_per_s":condition_shear(data)},sort_keys=True,allow_nan=False))
