"""Open 21 target captures only after authenticating all precommitted predictions."""
import hashlib
import json
import math
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from acquire import get_index, receive

def run():
    raw=Path("locked_forecasts.json").read_bytes()
    assert hashlib.sha256(raw).hexdigest()=="4810ce0398021c38d4fdbf4cec01d944567e830222d48d0c189f54b9b743739f"
    forecasts=json.loads(raw)
    assert len(forecasts)==21 and all(len(r)==8 and all(map(math.isfinite,r)) for r in forecasts)
    index=get_index();rows=[t[2] for t in index["triads"]]
    assert [r["step"] for r in rows]==list(range(21)) and all(r["bias"]==400 for r in rows)
    with ThreadPoolExecutor(3) as pool:
        results=list(pool.map(lambda r: receive(r,index,raw_window=True),rows))
    errors=[[p-r["full"]["joint"] for p in f] for f,r in zip(forecasts,results)]
    roles=[]
    for signed in zip(*errors):
        worst=max(range(21),key=lambda i:abs(signed[i]))
        roles.append({"mae":math.fsum(map(abs,signed))/21,"rmse":math.sqrt(math.fsum(e*e for e in signed)/21),"worst":worst,"max":abs(signed[worst])})
    wins=sum(abs(e[0])<abs(e[5]) for e in errors)
    gate=all(roles[0]["mae"]<r["mae"] for r in roles[1:]) and wins>=11
    print("TARGET",json.dumps(results,allow_nan=False,separators=(",",":")))
    print("SCORE",json.dumps({"roles":roles,"candidate_wins_pooled":wins,"gate":gate,"errors":errors},allow_nan=False,separators=(",",":")))
if __name__=="__main__":run()
