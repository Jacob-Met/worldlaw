"""Compare locked batch forecasts with independent titration and coulometric assays."""
import json
import math
from pathlib import Path
import sys


def evaluate(pred,truth,split):
    output={}
    for phase,ids in (("calibration_leave_one_out",split["calibration"]),("held",split["held"])):
        by={};points={}
        for i in ids:
            k=str(i);rec=truth[k]
            if rec["TA"] is None or rec["DIC"] is None:
                raise ValueError(("a whole source batch cannot be scored",i))
            targets=[rec["TA"],rec["DIC"]]
            arms=pred[k]["predictions"]
            if not points:
                points={arm:[] for arm in arms}
            for arm,vals in arms.items():
                points[arm].append([abs(x-y) for x,y in zip(vals,targets)])
            by[i]={"measured":targets,"assay_replicates":rec["replicates"],
                   "anchored_inverse":arms["anchored_inverse"],"minimax":arms["minimax"],
                   "conservative_one_bath":arms["conservative_one_bath"],
                   "free_minimax_residual_pH":pred[k]["optical"]["scaled_max_pH_residual"]}
        scores={arm:{"TA_mae":math.fsum(x[0] for x in vv)/len(vv),
                     "DIC_mae":math.fsum(x[1] for x in vv)/len(vv),
                     "worst_joint":max(max(v) for v in vv)} for arm,vv in points.items()}
        gate={n:all(scores["anchored_inverse"][n]<v[n] for arm,v in scores.items() if arm!="anchored_inverse")
              for n in ("TA_mae","DIC_mae","worst_joint")}
        env={}
        for depth in ("0.0005","0.003","0.01"):
            counts={"empty":0,"finite":0,"unbounded":0,"contains_both":0,"both_width_at_most20":0}
            for i in ids:
                w=pred[str(i)]["optical"]["engineering_pH_strips"][depth]
                if 2 in w["status"]:
                    counts["empty"]+=1;continue
                bounded=3 not in w["status"]
                counts["finite" if bounded else "unbounded"]+=1
                inside=True
                for endpoint,name in ((w["TA_min_max"],"TA"),(w["DIC_min_max"],"DIC")):
                    v=truth[str(i)][name]
                    inside &= endpoint[0]-1e-6<=v and (endpoint[1] is None or v<=endpoint[1]+1e-6)
                # Marginal intervals alone cannot prove simultaneous support.
                # The full affine strips for each batch are stored at prediction time.
                aw=pred[str(i)]["optical"]["pH_strip_coefficients"][depth]
                A,C=truth[str(i)]["TA"],truth[str(i)]["DIC"]
                inside &= all(l*C+b-1e-6<=A<=u*C+d+1e-6 for l,b,u,d in zip(*aw))
                counts["contains_both"]+=int(inside)
                counts["both_width_at_most20"]+=int(bounded and all(r[1]-r[0]<=20 for r in (w["TA_min_max"],w["DIC_min_max"])))
            env[depth]=counts
        output[phase]={"arms":scores,"gate":gate,"point_joint":all(gate.values()),
                       "engineering":env,"engineering_joint":env["0.003"]["contains_both"]==len(ids) and env["0.003"]["both_width_at_most20"]==len(ids),"batches":by}
    held=output["held"]
    output["external_course_admitted"]=held["point_joint"] and held["engineering_joint"]
    return output


if __name__=="__main__":
    p,t,s,out=map(Path,sys.argv[1:])
    obj=evaluate(*(json.loads(x.read_bytes()) for x in (p,t,s)))
    with out.open("x") as f:
        json.dump(obj,f,sort_keys=True,allow_nan=False)
        f.write("\n")
    print(json.dumps({k:v for k,v in obj["held"].items() if k!="batches"},sort_keys=True))
