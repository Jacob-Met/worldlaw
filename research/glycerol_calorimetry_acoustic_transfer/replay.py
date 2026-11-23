"""Audit locked forecasts, decimal residuals, and the density-margin witness."""
import hashlib
import json
from decimal import Decimal, localcontext
from pathlib import Path
from forecast import build

ROOT=Path(__file__).resolve().parent
SCORE="8135687dc6219955a51f37a0456b3964494bcf48df3d4f0347eabc6c7e57b8c4"
LOCK="3b8ea53a8d9e5d15290e392a939e992e10c17f7a7b5170f92e379a117179e5bf"

def read(name,digest=None,decimal=False):
    data=(ROOT/name).read_bytes()
    if digest and hashlib.sha256(data).hexdigest()!=digest:
        raise ValueError(f"unexpected {name}")
    return json.loads(data,parse_float=Decimal if decimal else float)

def replay_scores():
    reference=read("measured-score.json",SCORE,True)
    forecasts=read("forecast-lock.json",LOCK,True)
    rows=reference["all_50_rows"]
    if len(rows)!=50 or len(forecasts)!=len(rows):
        raise ValueError("missing whole source rows")
    for f,r in zip(forecasts,rows):
        if f["sound_m_s"]!=r["predicted"] or [f["T_K"],f["p_MPa"]]!=[r["T_K"],r["p_MPa"]]:
            raise ValueError("original prediction payload differs")
    groups={"all":rows,"primary":[r for r in rows if r["primary"]],
            "thermal_support":[r for r in rows if r["thermal_support"]],
            "outside_thermal":[r for r in rows if not r["thermal_support"]]}
    for prefix in ("all","primary"):
        for temp in sorted({r["nominal_T"] for r in groups[prefix]}):
            groups[f"{prefix}_T{temp}"]=[r for r in groups[prefix] if r["nominal_T"]==temp]
    assert set(groups)==set(reference["metrics"])
    max_delta=Decimal(0)
    count=0
    for group,records in groups.items():
        for role,receipt in reference["metrics"][group].items():
            diffs=[abs(r["predicted"][role]-r["observed"]) for r in records]
            n=Decimal(len(records))
            actual={"mae":sum(diffs)/n,"rmse":(sum(e**2 for e in diffs)/n).sqrt(),
                    "worst_abs":max(diffs),
                    "mean_abs_percent":sum(100*e/r["observed"] for e,r in zip(diffs,records))/n}
            assert records[diffs.index(max(diffs))]["index"]==receipt["worst_index"]
            for key,value in actual.items():
                max_delta=max(max_delta,abs(value-receipt[key]));count+=1
    if count!=308 or max_delta>Decimal("5e-10"):
        raise ValueError("scalar recount mismatch")
    return {"verified_scalars":count,"verified_worst_rows":count//4,"max_abs_difference":str(max_delta)}

def verify_pressure_tilt():
    experiment=read("calibration-checks.json")
    witness=experiment["preoutcome_density_and_heat_witness"]
    terms=witness["terms"];coef=witness["coefficients"]
    admission=read("calibration-tables.json")["rho"]
    secondary=experiment["independent_direct_density"]["rows"]
    primary=[(t,p,y,1.0) for t,p,y in admission]
    secondary=[(t,p,y,1.27) for t,p,y in secondary if 298.18<=t<=373.15 and .1<=p<=20]
    lo,hi=-float("inf"),float("inf")
    for t,p,r,margin in primary+secondary:
        x,z=(t-340)/40,(p-.1)/20
        v_scaled=sum(a*x**i*z**j for (i,j),a in zip(terms,coef))
        vmin,vmax=1e6/(r+margin),1e6/(r-margin)
        if z:
            lo=max(lo,(vmin-v_scaled)/z);hi=min(hi,(vmax-v_scaled)/z)
        else:
            assert vmin<=v_scaled<=vmax
    expected=witness["possible_coherent_tilts_in_magnified_specific_volume"]
    assert max(abs(a-b) for a,b in zip((lo,hi),expected))<1e-10
    return {"direct_source_rows":len(primary),"independent_in_support_rows":len(secondary),"lower_tilt":lo,"upper_tilt":hi}

if __name__=="__main__":
    with localcontext() as ctx:
        ctx.prec=65
        result=replay_scores()
    calibration=read("calibration-tables.json");states=read("held-state-inputs.json")
    rows=build(calibration,states,read("published-experimental-coefficients.json"))
    saved=read("forecast-lock.json",LOCK)
    assert all(r["sound_m_s"]==s["sound_m_s"] for r,s in zip(rows,saved))
    print(json.dumps({"original_forecasts":350,"decimal_recount":result,"density_tilt":verify_pressure_tilt()},sort_keys=True))
