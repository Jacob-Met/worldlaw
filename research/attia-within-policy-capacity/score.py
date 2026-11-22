"""Score one immutable complete forecast file against the author’s terminal cell life records."""
import csv
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path
from urllib.parse import quote

import numpy as np


REPO = "https://raw.githubusercontent.com/petermattia/battery-parameter-spaces/ec9508f9d2d6098f6e9a46dfaf79a222e65d7491/"
PINS = {"Validation/final_results.csv":"a7127ecb00dd6359cf126cf7a0bbe766ce435789",
        "Validation/electrochem/Qn.csv":"0a884557d705c9e3bb2a2fa125e728fb77cd3cd7"}


def get(path):
    b=urllib.request.urlopen(REPO+quote(path),timeout=45).read()
    assert hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()==PINS[path]
    return b


def score(root,sha):
    raw=(root/"locked-45-forecasts.json").read_bytes()
    if hashlib.sha256(raw).hexdigest()!=sha:
        raise ValueError("Unmatched prediction lock")
    d=json.loads(raw)
    groups=[tuple(x) for x in d["policy"]]
    ch=np.array(d["channel"])
    accepted=np.array(d["accepted"])
    forecasts={k:np.array(v) for k,v in d["forecasts"].items()}
    assert len(groups)==len(set(ch))==45 and accepted.sum()==44
    rows=list(csv.reader(io.StringIO(get("Validation/final_results.csv").decode())))
    assert rows[0]==["C1","C2","C3","R1","R2","R3","R4","R5"]
    y=np.full(45,np.nan)
    for row in rows[1:]:
        key=tuple(map(float,row[:3]))
        idx=[i for i,g in enumerate(groups) if g==key]
        assert len(idx)==5 and np.isnan(y[idx]).all()
        y[idx]=list(map(float,row[3:]))
    assert np.isfinite(y).all() and (y>100).all()
    q=np.loadtxt(io.BytesIO(get("Validation/electrochem/Qn.csv")),delimiter=",")
    assert q.shape[0]==45
    # The producer writes up to cycle_life+10 into a zero-padded array for each sorted cell.
    last=np.array([np.flatnonzero(np.isfinite(row) & (row>0))[-1]+1 for row in q])
    derived=last-10
    mismatches=np.flatnonzero(derived!=y)
    if mismatches.size:
        evidence={"prediction_sha256":sha,"source_rule":"last positive acquired q cycle minus 10",
                  "matches":int((derived==y).sum()),"mismatches":[{"channel":int(ch[i]),"derived":int(derived[i]),"reported":float(y[i])} for i in mismatches]}
        (root/"endpoint-identity-refusal.json").write_text(json.dumps(evidence,sort_keys=True))
        raise ValueError("Endpoint identity refusal: "+json.dumps(evidence,sort_keys=True))
    results={}
    for pane,eligible in (("all45",np.ones(45,dtype=bool)),("accepted44",accepted)):
        out={}
        for k,v in forecasts.items():
            err=v-y
            values=[]
            for g in sorted(set(groups)):
                keep=np.array([group==g for group in groups]) & eligible
                eg=err[keep]
                values.append({"policy":g,"n":int(keep.sum()),"centered_rmse":float(np.sqrt(np.mean((eg-eg.mean())**2))),
                               "absolute_rmse":float(np.sqrt(np.mean(eg**2)))})
            bad=np.flatnonzero(eligible)[np.argmax(np.abs(err[eligible]))]
            out[k]={"macro_centered_rmse":float(np.mean([e["centered_rmse"] for e in values])),
                    "pooled_rmse":float(np.sqrt(np.mean(err[eligible]**2))),"pooled_mae":float(np.mean(np.abs(err[eligible]))),
                    "per_policy":values,"worst":{"channel":int(ch[bad]),"barcode":d["barcode"][bad],
                    "policy":groups[bad],"observed":float(y[bad]),"forecast":float(v[bad]),"error":float(err[bad])}}
        role=out["shape"]
        gate={}
        for k,v in out.items():
            if k=="shape":continue
            wins=sum(a["centered_rmse"]<b["centered_rmse"] for a,b in zip(role["per_policy"],v["per_policy"],strict=True))
            gate[k]={"protocol_wins":wins,"macro_better":role["macro_centered_rmse"]<v["macro_centered_rmse"],
                     "passed":bool(wins>=6 and role["macro_centered_rmse"]<v["macro_centered_rmse"])}
        results[pane]={"roles":out,"gates":gate}
    output={"prediction_sha256":sha,"target_blobs":PINS,"y_in_locked_channel_order":y.tolist(),
            "channels":ch.tolist(),"physical_order_recount":{"equal":int((derived==y).sum()),"source_rule":"last positive acquired q cycle minus 10",
            "mismatches":[{"channel":int(ch[i]),"derived":int(derived[i]),"reported":float(y[i])} for i in mismatches]},
            "results":results}
    path=root/"held-score.json";path.write_text(json.dumps(output,sort_keys=True,allow_nan=False))
    print(json.dumps({"score_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size,
                      "identity":output["physical_order_recount"],
                      "scores":{p:{k:round(v["macro_centered_rmse"],6) for k,v in block["roles"].items()} for p,block in results.items()},
                      "worst":results["all45"]["roles"]["shape"]["worst"],"gates":{p:v["gates"] for p,v in results.items()}}))


if __name__=="__main__":
    score(Path(sys.argv[1]),sys.argv[2])
