"""Rebuild both chart score tables from received fixed endpoints and check the archived pixel evidence."""
import hashlib,json,math,pathlib,sys
p=pathlib.Path(sys.argv[1])
def read(n):return json.loads((p/n).read_text())
def last(n):return json.loads((p/n).read_text().splitlines()[-1])
def sha(n):return hashlib.sha256((p/n).read_bytes()).hexdigest()
reg=read("printed-protocol.json");f=read("upper-forecast-lock.json");s=read("score.json")
assert f==last("upper-forecast-original.txt") and s==last("score-original.txt")
assert f["protocol_sha"]==sha("printed-protocol.json") and s["lock_sha"]==sha("upper-forecast-lock.json")
assert s["roles"]==f["roles"]==reg["roles"] and f["held_lower_outputs_emitted"]==0
a=last("independent-original.txt");assert a["forecast_sha"]==s["lock_sha"] and a["available_by_held_fill"]==[41,40]
assert a["all_40_metric_max_diff"]<1e-12 and a["endpoint_and_forecast_max_diff"]<1e-12
assert a["held_arms_recounted"]==810 and a["all_20_worst_indices_equal"]
dec=[]
for term,pred in zip(s["rows"],f["rows"]):
    ca=term["cases"];assert [q["forecast"] for q in ca]==pred["forecast"] and [q["upper"] for q in ca]==pred["upper"]["values"]
    obs=[c for c in ca if c["lower"] is not None]
    assert len(ca)==41 and len(obs)==term["available"]
    errs=[[q["forecast"][k]-q["lower"] for q in obs] for k in range(10)]
    rm=[math.sqrt(math.fsum(x*x for x in col)/len(obs)) for col in errs];ma=[math.fsum(map(abs,col))/len(obs) for col in errs]
    assert rm==term["rmse"] and ma==term["mae"]
    assert [obs[max(range(len(obs)),key=lambda i:abs(col[i]))]["bin"] for col in errs]==term["each_worst_bin"]
    passed=len(obs)==41 and all(rm[0]<rm[k] for k in (1,2,3,4,5,6,8))
    assert passed==term["gate"];dec.append(passed)
assert dec==a["per_fill_gate"]==[False,False] and not s["gate"]
win=last("pixel-witness-original.txt")["witnesses"]
assert [(row["fill"], row["bin"],len(row["pixels_xy_RGB"])) for row in win]==[(".5",0,64),(".67",27,5),(".67",15,2)]
for row in win:
    i=0 if row["fill"]==".5" else 1
    assert row["same_bin"]==s["rows"][i]["cases"][row["bin"]]
modal=last("modal-geometry-original.txt");assert abs(modal["atwood_squared_frequency_ratio"]-.7/1.3)<1e-12
for key,fval in [(".3","0.3"),(".5","0.5"),(".67","0.67")]:
    assert reg["ratios"][key]==modal["circular"][fval]["64"]["center_per_wall_amplitude"]
print("Both failed fill gates, 810 conditional forecasts, 40 scalar scores and all three original pixel witnesses verified.")
