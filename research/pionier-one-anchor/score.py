"""Open the twenty registered processed positions against a fixed pre-outcome forecast."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from release import projected_tables,STARS
from orbit import ARMS

CONTROL=("stationary","face_on","edge_on","isotropic","physical_fit")
def rmse(xs):
    return math.sqrt(math.fsum(x*x for x in xs)/len(xs))

def score(archive, forecast):
    full=projected_tables(archive,targets=True)
    systems={}
    rows=[]
    for s in STARS:
        data=full[s]["epochs"]
        rec=forecast["nominal"][s]
        base=rec["anchor"]
        if (base["rho"],base["pa"],base["mjd"])!=(data[0]["rho"],data[0]["pa"],data[0]["mjd"]):
            raise ValueError("Anchor changed")
        part=[]
        for obs,pred in zip(data[1:],rec["rows"],strict=True):
            if obs["mjd"]!=pred["mjd"] or obs["fixed_flux"]!=pred["fixed_flux"]:
                raise ValueError("Target roster")
            d=math.radians(obs["pa"]-base["pa"])
            real=[obs["rho"],obs["rho"]*math.cos(d),obs["rho"]*math.sin(d)]
            errors={a:[pred["forecast"][a][j]-real[j] for j in range(3)] for a in ARMS}
            low,high=pred["admissible_radius"]
            row={"star":s,"mjd":obs["mjd"],"rho":obs["rho"],"pa":obs["pa"],"fixed_flux":obs["fixed_flux"],
                 "truth":real,"forecast":pred["forecast"],"error":errors,
                 "in_distance_free_interval":low<=real[0]<=high}
            part.append(row)
        case={}
        for a in ARMS:
            rms=[rmse([r["error"][a][j] for r in part]) for j in range(2)]
            rms_branches=[math.sqrt(math.fsum(r["error"][a][1]**2+
                (sign*r["forecast"][a][2]-r["truth"][2])**2 for r in part)/len(part)) for sign in (-1,1)]
            case[a]={"rmse":rms,"global_mirror_rmse":rms_branches}
        systems[s]=case
        rows+=part
    metrics={}
    for a in ARMS:
        vals=[systems[s][a]["rmse"] for s in STARS]
        metrics[a]={k:fn(v[j] for v in vals) for k,j,fn in (
            ("mean_radius",0,lambda g:math.fsum(g)/3),("worst_radius",0,max),
            ("mean_parallel",1,lambda g:math.fsum(g)/3),("worst_parallel",1,max))}
    gates={k:v<min(metrics[a][k] for a in CONTROL) for k,v in metrics["marginal"].items()}
    worst={}
    for j,name in enumerate(("radius","parallel")):
        worst[name]=max(rows,key=lambda r:abs(r["error"]["marginal"][j]))
    return {"gates":gates,"joint":all(gates.values()),"metrics":metrics,"systems":systems,
            "worst":worst,"rows":rows,"range_hits":sum(r["in_distance_free_interval"] for r in rows)}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path)
    parser.add_argument("forecast",type=Path)
    parser.add_argument("expected_hash")
    parser.add_argument("output",type=Path)
    args=parser.parse_args()
    raw=args.forecast.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=args.expected_hash:
        raise ValueError("Forecast lock")
    result=score(args.archive,json.loads(raw))
    args.output.write_text(json.dumps(result,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n")
    print("RESULT",json.dumps({k:result[k] for k in ("gates","joint","metrics","range_hits")}))
