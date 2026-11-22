"""Recount each locked two-channel curve and aggregate with equal date weights."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path

ARMS=("quiet_positive_lag","quiet_zero_lag","author_log_slope","scaled_small_wave","instantaneous_step")
DEV={("2013-06-13",1),("2013-06-13",2),("2015-01-05",1),("2019-03-05",1)}
FINAL={("2013-10-21",i) for i in (1,2,3)}|{("2013-10-23",i) for i in (1,2,3)}|{("2015-11-10",i) for i in (1,2)}|{("2015-11-13",i) for i in (1,2)}|{("2019-05-08",i) for i in (1,2,3)}|{("2019-05-09",i) for i in (2,3)}


def average(xs):
    return math.fsum(xs)/len(xs)


def aggregate(records,cohort):
    expected=DEV if cohort=="development" else FINAL
    identity=[(r["date"],r["bead"]) for r in records]
    if len(identity)!=len(set(identity)) or set(identity)!=expected:
        raise ValueError("incomplete, repeated or unregistered date/bead roster")
    dates=defaultdict(lambda:defaultdict(list))
    worst={name:{"error":-1.0} for name in ARMS}
    comparisons=0
    for r in records:
        pred=r["locked"]["forecast"]["predictions"]
        if set(r["observed"])!={"-800","800"} or set(pred)!=set(r["observed"]):
            raise ValueError("wrong signs")
        for name in ARMS:
            bead_rmse=[]
            for sign in ("-800","800"):
                obs=r["observed"][sign]
                forecast=pred[sign]["arms"][name]
                truth=obs["target"]
                assert len(forecast)==len(truth)==51 and set(pred[sign]["arms"])==set(ARMS)
                errors=[]
                for i,(a,b) in enumerate(zip(forecast,truth)):
                    assert len(a)==len(b)==2 and all(map(math.isfinite,a+b))
                    error=math.hypot(a[0]-b[0],a[1]-b[1])
                    errors.append(error)
                    if error>worst[name]["error"]:
                        worst[name]={"error":error,"date":r["date"],"bead":r["bead"],"command":int(sign),"index":4000+20*i,"prediction":a,"observation":b}
                e=math.sqrt(average([x*x for x in errors]))
                assert math.isclose(e,obs["arms"][name]["rmse_vector"],rel_tol=1e-12,abs_tol=1e-14)
                assert math.isclose(max(errors),obs["arms"][name]["max_norm"],rel_tol=1e-12,abs_tol=1e-14)
                bead_rmse.append(e)
                comparisons+=len(errors)*2
            dates[r["date"]][name].append(average(bead_rmse))
    date_scores={d:{n:average(v[n]) for n in ARMS} for d,v in sorted(dates.items())}
    scores={n:{"mean":average([r[n] for r in date_scores.values()]),"worst_date":max(r[n] for r in date_scores.values())} for n in ARMS}
    gates={c:{n:scores[ARMS[0]][c]<scores[n][c] for n in ARMS[1:]} for c in ("mean","worst_date")}
    passed=all(all(row.values()) for row in gates.values())
    return {"cohort":cohort,"units":"V/(gain times sum voltage)","scores":scores,"gates":gates,"passed":passed,"by_date":date_scores,"worst_raw_rows":worst,"component_forecasts_recounted":comparisons}


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("cohort",choices=["development","final"])
    p.add_argument("records",nargs="+",type=Path)
    args=p.parse_args()
    print(json.dumps(aggregate([json.loads(f.read_text()) for f in args.records],args.cohort),indent=2))
