"""Score all released axial values only after an externally locked forecast."""
import hashlib
import json
from pathlib import Path

import numpy as np

from project_input import DIGEST, PAGES, read_page


CONTROLS = ("laun","steller17","steller26","steller17_polynomial","steller26_polynomial",
            "sharma_mckinley","wagner_slope")
POINT_ARMS = ("minimax","conditional_midpoint",*CONTROLS)


def force_values(root, material, temp):
    path = root / f"{material}-primary.pdf"
    if hashlib.sha256(path.read_bytes()).hexdigest() != DIGEST[material]:
        raise ValueError("wrong primary PDF")
    page = PAGES[material] + [0,25,50].index(temp)
    result = []
    for line in read_page(path,page):
        fs = line.split()
        if not fs or fs[0] != str(float(temp)):
            continue
        if material == 2490 and temp == 25 and fs[:4] == ["25.0","100.0","7","22"]:
            fs[2:4] = ["7.22"]
        if len(fs) not in (5,8):
            raise ValueError((page,"uncertain number of columns",len(fs)))
        # Columns 5 and 6 are measured axial N1 and its combined standard uncertainty.
        # Column 7 is the NIST fit. Never substitute it for an unreported observation.
        if len(fs)==8:
            result.append((float(fs[1]),float(fs[5].strip("*")),float(fs[6].strip("*")),"*" in fs[5]))
    return result


def score(outputs, root):
    results = {}
    for k,v in sorted(outputs.items()):
        m,t=[int(s) for s in k.split("/")]
        rows=force_values(root,m,t)
        active=np.array(v["reported_force"],dtype=bool)
        flag=np.array(v["reference_flag"],dtype=bool)[active]
        rate=np.array(v["rates"])[active]
        obs=np.array([row[1] for row in rows])
        unc=np.array([row[2] for row in rows])
        if not np.array_equal(rate,[r[0] for r in rows]) or not np.array_equal(flag,[r[3] for r in rows]):
            raise ValueError("locked reporting roster mismatch")
        normalizer=np.mean(abs(obs))
        if normalizer<=0 or (unc<=0).any():
            raise ValueError("undefined source uncertainty or normalization")
        p={arm:np.array(v[arm])[active] for arm in (*POINT_ARMS,"conditional_lower","conditional_upper")}
        err={arm:np.abs(p[arm]-obs) for arm in POINT_ARMS}
        lo,hi=p["conditional_lower"],p["conditional_upper"]
        ix=int(np.argmax(err["minimax"]))
        results[k]={"rates":rate.tolist(),"measured":obs.tolist(),"standard_uncertainty":unc.tolist(),
                    "reference_only":flag.tolist(),"predictions":{arm:y.tolist() for arm,y in p.items()},
                    "nmae":{arm:float(e.mean()/normalizer) for arm,e in err.items()},
                    "nmae_excluding_reference_diagnostic":{arm:float(e[~flag].mean()/abs(obs[~flag]).mean())
                                                            for arm,e in err.items()},
                    "range_coverage":float(np.mean((lo<=obs)&(obs<=hi))),
                    "range_normalized_width":float(np.mean(hi-lo)/normalizer),
                    "minimax_worst_absolute_pa":{"rate":float(rate[ix]),"measured":float(obs[ix]),
                                                 "predicted":float(p["minimax"][ix]),
                                                 "absolute_error":float(err["minimax"][ix]),
                                                 "reference_only":bool(flag[ix])}}
    overall={a:{"equal_course_nmae":float(np.mean([c["nmae"][a] for c in results.values()])),
                "worst_course_nmae":max(c["nmae"][a] for c in results.values())} for a in POINT_ARMS}
    point_gates={stat:all(overall["minimax"][stat] < overall[a][stat] for a in CONTROLS)
                 for stat in ("equal_course_nmae","worst_course_nmae")}
    interval_gates={"fixed_eight_percent_input_fit":all(v["minimum_relative_input_error"]<=.08+1e-7 for v in outputs.values()),
                    "each_course_90_percent_coverage":all(c["range_coverage"]>=.9 for c in results.values()),
                    "each_course_mean_width_at_most_mean_abs_observation":all(c["range_normalized_width"]<=1 for c in results.values())}
    return {"cohorts":results,"overall":overall,"point_gates":point_gates,"interval_gates":interval_gates,
            "joint_point":all(point_gates.values()),"joint_interval":all(interval_gates.values())}
