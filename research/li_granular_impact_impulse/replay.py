"""Offline receiving of locked predictions and complete equal-composition metrics."""
import hashlib,json,math,sys,os
from pathlib import Path
from forecast import pred
from measurements import contract
if __name__=="__main__":
    os.chdir(sys.argv[1] if len(sys.argv)>1 else ".")
    p=contract();raw=Path("forecast.json").read_bytes();f=json.loads(raw);s=json.loads(Path("score.json").read_bytes());a=json.loads(Path("forecast-lock.json").read_bytes())
    assert len(raw)==a["bytes"] and hashlib.sha256(raw).hexdigest()==a["sha256"]==s["forecast_sha256"]
    d=f["permitted_inputs_and_development"];g=json.loads(Path("optical-inputs.json").read_bytes())["secant_per_s"]
    predictions,coefs=pred(d,g,p);assert set(predictions)==set(p["held"]) and set(s["target_Q"])==set(p["held"])
    cells=0
    for k,roles in predictions.items():
        for r,v in roles.items():
            for x,y in zip(v,f["predictions"][k][r]):
                assert math.isclose(x,y,rel_tol=2e-12,abs_tol=1e-12);cells+=1
            errors=[abs(x-y) for x,y in zip(f["predictions"][k][r],s["target_Q"][k])]
            scaled=[e/n for e,n in zip(errors,s["normalization"][k[6]])]
            avg=lambda a:math.fsum(a)/len(a)
            mse=lambda arr:math.sqrt(avg([u*u for u in arr]))
            metrics=[mse(scaled),avg(scaled),mse(errors),avg(errors)]
            assert all(math.isclose(x,y,rel_tol=1e-13) for x,y in zip(metrics,s["run"][r][k]))
    assert cells==1014
    c=p["candidate"];success=True
    for r in p["roles"]:
        group={v:[avg([s["run"][r][i][q] for i in p["held"] if i[6]==v]) for q in range(4)] for v in "12345"}
        for v in group:assert all(math.isclose(x,y,rel_tol=1e-13) for x,y in zip(group[v],s["composition"][r][v]))
        agg=[avg([group[v][q] for v in group]) for q in range(4)]
        assert all(math.isclose(x,y,rel_tol=1e-13) for x,y in zip(agg,s["mean"][r]))
        if r!=c:
            w=sum(s["composition"][c][v][0]<group[v][0] for v in group)
            assert w==s["candidate_group_wins"][r]
            success &= w>=3 and all(s["mean"][c][q]<agg[q] for q in (0,1))
    assert s["joint_gate"]==success
    print(json.dumps({"forecast_cells":cells,"primary_gate":success,"held_runs":len(p["held"]),"roles":len(p["roles"]),"recalibration":"training summaries and optical inputs","raw_pressure_replay":"independent.py"}))
