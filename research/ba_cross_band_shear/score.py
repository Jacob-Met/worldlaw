"""Check original forecasts before loading the held shear column."""
import hashlib,json,math,pathlib,statistics
from inputs import PRESSURES,seven_targets
ROLES=set("calibrated_constrained direct_constrained calibrated_unbounded direct_unbounded cyclic_residual brine_last_shear brine_mean_shear brine_last_poisson gas_ultrasonic_shear gas_ultrasonic_poisson gas_shear_ratio gas_shear_increment brine_origin_regression gas_global_increment all_shear_change".split())
BASE="calibrated_constrained"
def load_forecast():
    raw=pathlib.Path("forecasts.json").read_bytes();lock=json.loads(pathlib.Path("forecast-lock.json").read_bytes())
    assert hashlib.sha256(raw).hexdigest()==lock["sha256"] and len(raw)==lock["bytes"]
    a=json.loads(raw)
    for k,ps in [("primary",list(PRESSURES)),("paper_range",[5,8,10,15,20])]:
        p=a[k];rs=p["rows"];assert [r["pressure"] for r in rs]==ps and not p["refusals"]
        assert set(p["strict_controls"])==ROLES-{BASE,"calibrated_unbounded","direct_unbounded"}
        for r in rs:
            assert set(r["forecast"])==set(r["squared"])==ROLES
            assert all(math.isfinite(v) and v>0 and math.sqrt(r["squared"][n])==v for n,v in r["forecast"].items())
    return a
def score(panel,truth):
    rows=panel["rows"];metrics={};err={}
    for n in sorted(ROLES):
        e=[r["forecast"][n]-truth[r["pressure"]] for r in rows];err[n]=e
        w=max(range(len(e)),key=lambda i:abs(e[i]))
        metrics[n]={"rmse":math.sqrt(statistics.fmean(a*a for a in e)),"mae":statistics.fmean(map(abs,e)),"worst":rows[w]["pressure"],"worst_signed":e[w]}
    for n in ROLES:metrics[n]["candidate_strict_wins"]=sum(abs(a)<abs(b) for a,b in zip(err[BASE],err[n]))
    m=metrics[BASE]
    gate=all(m["rmse"]<metrics[n]["rmse"] and m["mae"]<metrics[n]["mae"] and metrics[n]["candidate_strict_wins"]>=len(rows)//2+1 for n in panel["strict_controls"])
    gate=gate and all(m["rmse"]<=metrics[n]["rmse"] and m["mae"]<=metrics[n]["mae"] for n in ["calibrated_unbounded","direct_unbounded"])
    return {"metrics":metrics,"signed_errors":err,"gate":gate,"pressures":[r["pressure"] for r in rows]}
if __name__=="__main__":
    a=load_forecast();t=seven_targets();assert set(t)==set(PRESSURES)
    print(json.dumps({"targets":t,**{n:score(a[n],t) for n in ["primary","paper_range"]}},sort_keys=True,separators=(",",":"),allow_nan=False))
