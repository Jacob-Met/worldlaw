"""Offline receipt replay from protected source/target summaries and locked forecasts."""
import hashlib
import json
import math
from pathlib import Path
from vector_field import check
from forecast import forecasts

def main():
    root=Path(__file__).resolve().parent
    load=lambda n:json.loads((root/n).read_text())
    protocol=load("command_replication.json")
    ro=load("matched_commands.json")
    source=load("source_measurements.json");target=load("target_measurements.json")
    lock=(root/"locked_forecasts.json").read_bytes()
    assert hashlib.sha256(lock).hexdigest()=="4810ce0398021c38d4fdbf4cec01d944567e830222d48d0c189f54b9b743739f"
    assert [r["step"] for r in target]==list(range(21))
    assert len(source)==42 and len({r["sha256"] for r in source+target})==63
    for i,group in enumerate(ro["triads"]):
        assert [r["bias"] for r in group]==[100,200,400]
        assert [r["step"] for r in group]==[4*i,2*i,i]
        for r,m in zip(group,[source[2*i],source[2*i+1],target[i]]):
            assert (r["bias"],r["step"])==(m["bias"],m["step"])
    lo=[r["full"]["joint"] for r in source[::2]];mid=[r["full"]["joint"] for r in source[1::2]]
    pred=forecasts(lo,mid)
    assert len(protocol["roles"])==8 and pred==json.loads(lock)
    errors=[[v-r["full"]["joint"] for v in f] for f,r in zip(pred,target)]
    score=load("score.json")
    assert errors==score["errors"]
    for r,e in zip(score["roles"],zip(*errors)):
        worst=max(range(21),key=lambda i:abs(e[i]))
        assert (r["mae"],r["rmse"],r["max"],r["worst"])==(math.fsum(map(abs,e))/21,math.sqrt(math.fsum(x*x for x in e)/21),abs(e[worst]),worst)
    wins=sum(abs(e[0])<abs(e[5]) for e in errors)
    mae=[r["mae"] for r in score["roles"]]
    assert wins==score["candidate_wins_pooled"]==0 and score["gate"]==(mae[0]<min(mae[1:]) and wins>=11)==False
    assert check()["rational_fields"]==432
    print("21 exact command products; 42 source and 21 held summaries; 168 forecasts and all eight role scores reproduced; joint gate false.")
if __name__=="__main__":main()
