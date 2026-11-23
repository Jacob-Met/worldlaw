"""Receive a whole frozen 18-job probability collection and score every locked cell."""
import ast
import csv
import hashlib
import io
import json
import math
import pathlib
import re
import sys
import urllib.request
from collections import Counter, defaultdict

CSV_SHA="3917448673855c2e6a7276c078f8f53de5450e9ffb2bef90f2d129b5b72d31a7"
ROLES=("single","static","dynamic","single_spam","static_spam","dynamic_spam","free_static_spam","constant","last","var1","var2")
BASES="XYZ"


def load_forecasts(path, digest):
    raw=pathlib.Path(path).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==digest
    locks=json.loads(raw)
    assert len(locks)==18 and [row["ordinal"] for row in locks]==list(range(18))
    assert len({row["job_id"] for row in locks})==18
    for row in locks:
        assert row["csv_sha256"]==CSV_SHA and set(row["probabilities"])==set(ROLES)
        for q in row["probabilities"].values():
            assert len(q)==6 and all(len(v)==3 and all(math.isfinite(p) and 0<p<1 for p in v) for v in q)
    return locks


def counts(text):
    series=[]
    for dictionary in re.findall(r"\{[^{}]*\}",text):
        parts=ast.literal_eval(dictionary)
        assert isinstance(parts,dict)
        c=Counter()
        for key,val in parts.items():
            digits=str(key)
            ix=int(digits,16) if digits.startswith("0x") else int(digits)
            assert ix in (0,1) and type(val) is int and val>=0
            c[ix]+=val
        assert c[0]+c[1]==1024
        series.append(c[0])
    assert len(series)==16
    return series


def evaluate(locks,digest):
    z=json.load(urllib.request.urlopen("https://zenodo.org/api/records/8363718",timeout=40))
    f=next(f for f in z["files"] if f["size"]==832470)
    b=urllib.request.urlopen(f["links"].get("content",f["links"]["self"]),timeout=40).read()
    assert hashlib.sha256(b).hexdigest()==CSV_SHA
    groups=defaultdict(list)
    for row in csv.DictReader(io.StringIO(b.decode("utf-8-sig"))):
        groups[row["job_id"]].append(row)
    eligible={j for j,rows in groups.items() if len(rows)==6 and all(float(r["theta_full"])==0 for r in rows)}
    assert eligible=={x["job_id"] for x in locks}
    events=[]; concordance=[]
    for lock in locks:
        job=lock["job_id"];date=lock["date"]
        for bi,basis in enumerate(BASES):
            pair=[r for r in groups[job] if r["measurement_basis"]==basis]
            assert len(pair)==2 and all(r["completion_date"]==date for r in pair)
            assert all(tuple(map(int,r["n"].strip()[1:-1].split()))==tuple(range(0,151,10)) for r in pair)
            cc=[counts(r["counts"]) for r in pair]
            for rep in range(2):
                for k in range(10): assert lock["prefix_counts"][k][bi][rep]==cc[rep][k]
                for k in range(10,16):
                    y=cc[rep][k]
                    p={r:lock["probabilities"][r][k-10][bi] for r in ROLES}
                    ent={r:-(y*math.log(v)+(1024-y)*math.log1p(-v))/1024 for r,v in p.items()}
                    logcoef=math.lgamma(1025)-math.lgamma(y+1)-math.lgamma(1025-y)
                    events.append(dict(date=date,ordinal=lock["ordinal"],job=job,basis=basis,n=10*k,rep=rep,k0=y,shots=1024,p=p,ce=ent,
                                       residual={r:y/1024-v for r,v in p.items()},nll={r:1024*e-logcoef for r,e in ent.items()}))
            concordance.append(dict(ordinal=lock["ordinal"],basis=basis,prefix_all_identical=cc[0][:10]==cc[1][:10],
                                    held_equal=sum(x==y for x,y in zip(cc[0][10:],cc[1][10:])),
                                    held_mean_abs_count_difference=sum(abs(x-y) for x,y in zip(cc[0][10:],cc[1][10:]))/6))
    def avg(rows):return {r:math.fsum(e["ce"][r] for e in rows)/len(rows) for r in ROLES}
    means=avg(events);days=[avg([e for e in events if e["ordinal"]==d]) for d in range(18)]
    competitors=("static_spam","single_spam","free_static_spam","var1","var2")
    gates={r:means["dynamic_spam"]<means[r] for r in competitors}
    wins=sum(d["dynamic_spam"]<d["static_spam"] for d in days)
    ix=max(range(len(events)),key=lambda i:abs(events[i]["residual"]["dynamic_spam"]))
    return dict(source=CSV_SHA,forecast_lock_sha256=digest,events=events,means=means,
                total_binomial_nll={r:math.fsum(e["nll"][r] for e in events) for r in ROLES},days=days,
                depths={n:avg([e for e in events if e["n"]==n]) for n in range(100,151,10)},
                replica={v:avg([e for e in events if e["rep"]==v]) for v in [0,1]},
                worst_day_ordinal={r:max(range(18),key=lambda i:days[i][r]) for r in ROLES},
                worst_event=events[ix],concordance=concordance,paired_static_wins=wins,gates=gates,joint=all(gates.values()) and wins>=12)


if __name__=="__main__":
    lock=load_forecasts(sys.argv[1],sys.argv[2])
    with open(sys.argv[3],"w") as f:json.dump(evaluate(lock,sys.argv[2]),f,sort_keys=True,allow_nan=False,separators=(",",":"))
