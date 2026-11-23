"""Build all forecasts using only the article's pressure and input projections."""
import sys,json
from pathlib import Path
import numpy as np
from project import project
from stable import solve,curvature
from phase_models import controls


def forecast(xml):
    d=project(xml)
    out={}
    for i,j,comp in [(2,3,1),(4,5,3),(8,9,4)]:
        data=d[i]
        assert [r["var"] for r in data]==[r["var"] for r in d[j]]
        x=np.array([float(r["var"][1]) for r in data]);t=np.array([float(r["var"][2]) for r in data])
        p=np.array([float(r["p"]) for r in data])
        u=np.array([float(next(v for k,v in r["u"] if k=="nCombExpandUncertValue")) for r in data])
        assert x[0]==0 and x[-1]==1 and np.all(np.diff(x)>0) and np.all(p>u)
        pred,meta=controls(x,t,p,comp)
        inner=solve(x,p,u,t,False);outer=solve(x,p,u,t,True)
        if not outer:raise ValueError("continuous-box numerical relaxation empty; do not score false forecasts")
        mid=[(a+b)/2 for a,b in outer["bounds"]]
        pred["outer_midpoint"]=mid
        out[str(i)]=dict(x=x.tolist(),t=t.tolist(),p=p.tolist(),u=u.tolist(),pred=pred,control=meta,inner=inner,outer=outer,
                         curvature=curvature(x,p,u,t))
    return out


if __name__=="__main__":
    y=forecast(sys.argv[1]);Path(sys.argv[2]).write_text(json.dumps(y,allow_nan=False,sort_keys=True)+"\n")
