"""Check immutable receipts, registered field exposure, raw-input decisions, and rate limits."""
import hashlib,json,math,pathlib,random,sys
root=pathlib.Path(sys.argv[1])
def read(n):return json.loads((root/n).read_text())
receipts=read("native-receipts.json")
assert len(receipts)==6 and sum(r["exit"]==1 for r in receipts)==1
assert all(r["descendants"]=="drained" for r in receipts)
for n,i in [("python-runtime-refusal.txt",2),("retired-sine-original.txt",3),("pwm-original.txt",4),("independent-original.txt",5)]:
    data=(root/n).read_bytes();assert len(data)==receipts[i]["output_bytes"] and hashlib.sha256(data).hexdigest()==receipts[i]["output_sha256"]
assign=read("assignments.json")["groups"]
obs=[json.loads(s) for s in (root/"retired-sine-original.txt").read_text().splitlines() if s.startswith("{")]
assert len(assign)==21 and len(obs)==120
assert {(g["key"],r["f"]) for g in assign for r in g["runs"]}=={(r["group"],r["f"]) for r in obs}
assert all(r["header"]==["t_s,B_T,H_Aperm,dBdt_Tpers"] for r in obs)
def result(n):return json.loads((root/n).read_text().splitlines()[1])
score=read("pwm-results.json")
assert score==result("pwm-original.txt") and not score["accepted"] and not score["H_decoded"]
registration=read("pwm_registration.json")["groups"]
assert len(registration)==4
raw=[]
for g,s in zip(registration,score["groups"]):
    assert g["key"]==s["group"] and len(s["runs"])==len(g["runs"])
    assert len(s["pairs"])==len(g["runs"])-1 and not s["accepted"]
    for source,p in zip(g["runs"][:-1],s["pairs"]):
        d=p["max_abs_B_diff_T"]
        assert source["f"]==p["source_frequency"] and p["target_frequency"]==g["runs"][-1]["f"]
        assert abs(abs(p["worst_source_B_T"]-p["worst_target_B_T"])-d)<1e-15
        assert not p["pass_pair"] and d>.005*g["amplitude"] and p["source_turns"]==p["target_turns"]
        raw.append([g["key"],p["source_frequency"],p["worst_grid_index"],d])
ind=result("independent-original.txt")
assert len(raw)==ind["pairs"]==24 and ind["aligned_values"]==1572864
for obj,selector in [("min_pair",min),("max_pair",max)]:
    a=selector(raw,key=lambda r:r[-1]);b=ind[obj]
    assert a[:3]==b[:3] and abs(a[-1]-b[-1])<1e-14
assert ind["max_abs_disagreement_T"]<1e-14 and ind["all_rejected_by_full_path_alone"] and not ind["H_decoded"]
rng=random.Random(17579041)
for i in range(500):
    a,b,c=sorted(rng.uniform(0.05,200) for _ in range(3))
    # Finite shifts, their positive mixtures, and both limiting components.
    weights=[rng.random() for _ in range(5)]
    shifts=[10**rng.uniform(-4,4) for _ in range(3)]
    def inc(x,y):
        return weights[0]*(y-x)+weights[1]*(math.sqrt(y)-math.sqrt(x))+sum(w*(y-x)/(math.sqrt(y+h)+math.sqrt(x+h)) for w,h in zip(weights[2:],shifts))
    R=inc(b,c)/inc(a,b);lo=(math.sqrt(c)-math.sqrt(b))/(math.sqrt(b)-math.sqrt(a));hi=(c-b)/(b-a)
    assert lo-1e-9<=R<=hi+1e-9
print("120 sine field-summary exposures; 24/24 registered PWM input comparisons refused; 500 positive-mixture checks passed.")
