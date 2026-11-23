"""Freeze all nine/five/six future epochs before calling any target parser."""
import argparse
import hashlib
import itertools
import json
import math
from pathlib import Path
from release import projected_tables, STARS
from orbit import bank, fixed_orientation, xy

def write(path,data):
    path.write_text(json.dumps(data,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n")

def physical_check(record,star):
    rho=record["anchor"]["rho"]
    p0=xy(star,record["anchor"]["mjd"])
    A=record["A_mas"]
    # Direct positive-scale fit of a single measured length under fixed A:
    # rho(c)=A*sqrt(u0²+c²v0²)/sqrt(1−c²), monotone for 0<=c<1.
    lo,hi=0.,1.
    if rho<=A*abs(p0[0]):
        hi=lo
    else:
        for _ in range(85):
            c=(lo+hi)/2
            val=A*math.hypot(p0[0],c*p0[1])/math.sqrt(1-c*c)
            if val<rho:lo=c
            else:hi=c
    c=(lo+hi)/2
    # Both methods fit the physical angular scale. An inconsistent anchor
    # requires the actual fitted scale A at c=0, not a re-anchored orbit.
    for row in record["rows"]:
        x,y=xy(star,row["mjd"])
        if record["cos_i_squared_unconstrained"]<0:
            direct=(A*abs(x), A*x*math.copysign(1,p0[0]), 0.)
        else:
            direct=fixed_orientation(c,p0,(x,y),rho)
        if max(abs(a-b) for a,b in zip(direct,row["forecast"]["physical_fit"]))>2e-7:
            raise ValueError("Independent constrained orbit disagrees")

def freeze(archive):
    inputs=projected_tables(archive,targets=False)
    nominal={}
    stress={}
    error=0.
    for s in STARS:
        record=bank(inputs[s])
        check=bank(inputs[s],2048)
        for one,two in zip(record["rows"],check["rows"]):
            for name in ("isotropic","marginal"):
                error=max(error,max(abs(a-b) for a,b in zip(one["forecast"][name],two["forecast"][name])))
        physical_check(record,inputs[s])
        nominal[s]=record
        stress[s]=[]
        for signs in itertools.product((-1,1),repeat=5):
            altered=bank(inputs[s],2048,signs)
            stress[s].append({"signs":signs,"unconstrained_c2":altered["cos_i_squared_unconstrained"],
                "rows":[{name:r["forecast"][name] for name in ("marginal","physical_fit")} for r in altered["rows"]]})
    if error>.002:
        raise ValueError(("4096/2048 integration difference, mas",error))
    return {"nominal":nominal,"stress":stress,"max_quadrature_difference_mas":error,"source_inputs":inputs}
if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path)
    parser.add_argument("forecast",type=Path)
    args=parser.parse_args()
    data=freeze(args.archive)
    write(args.forecast,data)
    print("FORECAST",args.forecast.stat().st_size,hashlib.sha256(args.forecast.read_bytes()).hexdigest())
    print("ADMISSION",data["max_quadrature_difference_mas"],
          {s:x["cos_i_squared_unconstrained"] for s,x in data["nominal"].items()})
