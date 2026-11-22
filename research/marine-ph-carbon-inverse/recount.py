"""Independently recount locked forecasts against raw replicate assays and optical rows."""
import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
import statistics
import sys


def equal(a,b):
    if not math.isclose(a,b,rel_tol=2e-11,abs_tol=2e-9):
        raise ValueError((a,b))


def run(path, source):
    def dataset(n):
        with (source/(n+".csv")).open(newline="") as f:
            return list(csv.DictReader(f))
    report=json.loads((path/"observed.json").read_bytes())
    preds=json.loads((path/"locked.json").read_bytes())
    split=json.loads((path/"split.json").read_bytes())
    raws=defaultdict(list); baths=defaultdict(list)
    for row in dataset("905278"):
        raws[row["Batch"]].append({k:float(row["meas_"+k]) if row["meas_"+k].strip() else None for k in ("TA","DIC")})
    for row in dataset("905357"):
        baths[row["Batch"]].append({k:float(row[k]) for k in ("Temp","meas_pHt","pHt_std_err","Practical_Salinity","PO4","Si")})
    assert len(raws)==len(baths)==25
    counts={"batches":0,"available_TA":0,"available_DIC":0,"point_component_errors":0,"bath_strip_checks":0}
    by={};worsts={}
    for phase,ids in (("calibration_leave_one_out",split["calibration"]),("held",split["held"])):
        vals=defaultdict(list);covered=defaultdict(int);widths=defaultdict(int)
        panel_worst={}
        for i in ids:
            key=str(i);model=preds[key];rec=raws[key];opt=baths[key]
            assert len(rec)==4 and len(opt)==9
            counts["batches"]+=1;mean=[]
            for k in ("TA","DIC"):
                known=[r[k] for r in rec if r[k] is not None]
                counts["available_"+k]+=len(known);mean.append(statistics.fmean(known))
            for j,v in enumerate(mean):equal(v,report[phase]["batches"][key]["measured"][j])
            for arm,forecast in model["predictions"].items():
                d=[f-v for f,v in zip(forecast,mean)]
                vals[arm].append(tuple(map(abs,d)));counts["point_component_errors"]+=2
                j=max(range(2),key=lambda k:abs(d[k]))
                if arm not in panel_worst or abs(d[j])>abs(panel_worst[arm]["signed_error"]):
                    panel_worst[arm]={"batch":i,"channel":("TA","DIC")[j],"signed_error":d[j],"forecast":forecast,
                                     "raw_replicates":rec,"mean_carbon":mean,"bath_observations":opt,
                                     "conservative_single":model["predictions"]["conservative_one_bath"],
                                     "conservative_all":model["predictions"]["conservative_nine_bath"],
                                     "free_minimax":model["predictions"]["minimax"],
                                     "singular_values":model["optical"]["singular_values"],
                                     "envelopes":model["optical"]["engineering_pH_strips"]}
            A,C=mean
            for delta,(zl,bl,zh,bh) in model["optical"]["pH_strip_coefficients"].items():
                e=model["optical"]["engineering_pH_strips"][delta]
                hits=[l*C+b-1e-6<=A<=h*C+d+1e-6 for l,b,h,d in zip(zl,bl,zh,bh)]
                counts["bath_strip_checks"]+=len(hits)
                if all(hits) and 2 not in e["status"]:covered[delta]+=1
                if e["status"]==[0,0,0,0] and max(e["TA_min_max"][1]-e["TA_min_max"][0],e["DIC_min_max"][1]-e["DIC_min_max"][0])<=20:
                    widths[delta]+=1
        by[phase]={}
        for arm,v in vals.items():
            s=[statistics.fmean(x[i] for x in v) for i in (0,1)]+[max(max(x) for x in v)]
            by[phase][arm]=dict(zip(("TA_mae","DIC_mae","worst_joint"),s))
            for k,x in by[phase][arm].items():equal(x,report[phase]["arms"][arm][k])
        for d,old in report[phase]["engineering"].items():
            assert covered[d]==old["contains_both"] and widths[d]==old["both_width_at_most20"]
        metrics=by[phase];gates={k:all(metrics["anchored_inverse"][k]<v[k] for n,v in metrics.items() if n!="anchored_inverse") for k in metrics["anchored_inverse"]}
        assert report[phase]["gate"]==gates and report[phase]["point_joint"]==all(gates.values())
        assert report[phase]["engineering_joint"]==(covered["0.003"]==widths["0.003"]==len(ids))
        worsts[phase]={k:panel_worst[k] for k in ("anchored_inverse","minimax","conservative_nine_bath")}
    assert counts=={"batches":25,"available_TA":99,"available_DIC":99,"point_component_errors":600,"bath_strip_checks":675}
    shared=report["held"]["point_joint"] and report["held"]["engineering_joint"]
    assert report["external_course_admitted"]==shared
    out={"counts":counts,"scores":by,"raw_worst":worsts,"external_course_admitted":shared}
    (path/"independent.json").write_text(json.dumps(out,sort_keys=True,allow_nan=False)+"\n")
    print(json.dumps({"counts":counts,"worst_held":worsts["held"]["anchored_inverse"],"external":shared},sort_keys=True))


if __name__=="__main__":
    run(Path(sys.argv[1]),Path(sys.argv[2]))
