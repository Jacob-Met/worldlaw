"""Score the locked terminal-work predictions on every released mixed loading."""
import math
import numpy as np
from source import HELD,project
from model import work

CANDIDATE="support_geomean"
CONTROLS=("hill48","hosford6","axis_blend","yld2000_m4","yld2000_m6","yld2000_m8",
          "yld6_midarea","mises_terminal_strain")

def score(root,bank):
    data=project(root,"biaxial",HELD,"ABCD")
    outputs={}
    errors={}
    for label,A in data.items():
        b=bank["predictions"][label]
        if len(A)!=b["n"] or not np.array_equal(A[0,::2],b["strain_first"]) or not np.array_equal(A[-1,::2],b["strain_last"]):
            raise ValueError("Input strain mismatch")
        wx=work(A[:,0],A[:,1]);wy=work(A[:,2],A[:,3])
        total=wx+wy
        W=float(total[-1])
        if not np.isfinite(W) or W<=0:raise ValueError("Nonpositive observed terminal work")
        valid=b["uniaxial_lower_by_0_90_45"]
        lower=max(valid) if all(v is not None for v in valid) else None
        delta=bank["compatibility"]["maximum_fractional_shortfall"]
        outputs[label]={"observed_component_work":[float(wx[-1]),float(wy[-1])],"work":W,
               "nonmonotone_stored_total_steps":int(np.count_nonzero(np.diff(total)<0)),
               "stored_total_work_range":[float(min(total)),float(max(total))],
               "component_negative_increments":[float(np.minimum(np.diff(w),0).sum()) for w in (wx,wy)],
               "first":A[0].tolist(),"last":A[-1].tolist(),"euler_lower_work":lower,
               "raw_lower_satisfied":lower is not None and lower<=W,
               "training_slack_lower_satisfied":lower is not None and (1-delta)*lower<=W,
               "conditional_true_ray_bracket_contains":b["predicted_work"]["hull_lower"] is not None
                   and b["predicted_work"]["tangent_upper"] is not None
                   and b["predicted_work"]["hull_lower"]<=W<=b["predicted_work"]["tangent_upper"]}
        errors[label]={arm:(None if pred is None or pred<=0 else math.log(pred/W))
                       for arm,pred in b["predicted_work"].items()}
    aggregate={}
    for arm in errors[HELD[0]]:
        v=[errors[k][arm] for k in HELD]
        aggregate[arm]=None if any(t is None for t in v) else {"mean_abs_log":sum(abs(t) for t in v)/len(v),"worst_abs_log":max(abs(t) for t in v)}
    gates={arm+"/"+metric:aggregate[arm] is not None and aggregate[CANDIDATE] is not None
           and aggregate[CANDIDATE][metric]<aggregate[arm][metric]
           for arm in CONTROLS for metric in ("mean_abs_log","worst_abs_log")}
    return {"observed":outputs,"signed_log_residuals":errors,"whole_program_scores":aggregate,"gates":gates,"joint":all(gates.values())}
