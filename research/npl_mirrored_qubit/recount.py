"""Independent standard-library recount of every held original circuit and model.

With --raw, authenticate the original CSV and read only all-idle job counts.
Without it, verify the same forecasts against the published held count ledger.
"""
import ast
import csv
import gzip
import hashlib
import io
import json
import math
import pathlib
import re
import sys
from collections import defaultdict

LOCK_SHA="53da3857baaa68d1a50b6f080bbdaac7dca5dc1eaa89af9e0a40244b2265d21a"
CSV_SHA="3917448673855c2e6a7276c078f8f53de5450e9ffb2bef90f2d129b5b72d31a7"
SCORE_SHA="c72f7c220ec740a268afd1befb151fd08cfbf62188e7246cb53cc3373def7765"
ROLES=["constant","dynamic","dynamic_spam","free_static_spam","last","single","single_spam","static","static_spam","var1","var2"]


def checked(data,digest):
    assert hashlib.sha256(data).hexdigest()==digest
    return data


def source_counts(csv_bytes, jobs):
    # The CSV contains public shot counts from other jobs. Their numeric contents
    # are never parsed. This independent path converts only the eligible rows.
    eligible={}
    rows=list(csv.DictReader(io.StringIO(checked(csv_bytes,CSV_SHA).decode())))
    for j in {r["job_id"] for r in rows}:
        rec=[r for r in rows if r["job_id"]==j]
        if {float(r["theta_full"]) for r in rec}=={0}:
            eligible[j]=rec
    assert set(eligible)==set(jobs) and len(rows)==1728
    values={}
    for j,items in eligible.items():
        for basis in "XYZ":
            pair=[r for r in items if r["measurement_basis"]==basis]
            assert len(pair)==2
            for rep,row in enumerate(pair):
                # Parse one complete released count dictionary at a time to allow
                # both the comma-separated and the printed-array representations.
                chunks=row["counts"].split("}")
                for k,part in enumerate(chunks[:-1]):
                    entry=ast.literal_eval("{"+part.rsplit("{",1)[1]+"}")
                    zero=one=0
                    for name,v in entry.items():
                        key=str(name).lower()
                        if key in ("0","0x0"):zero+=v
                        elif key in ("1","0x1"):one+=v
                        else:raise ValueError(key)
                    assert type(zero) is type(one) is int and zero+one==1024
                    values[j,basis,rep,k]=zero
                assert len(chunks)==17
    return values


def run(root, data=None):
    locks=json.loads(checked((root/"forecasts.json").read_bytes(),LOCK_SHA))
    report=json.loads(checked(gzip.decompress((root/"score.json.gz").read_bytes()),SCORE_SHA))
    assert report["forecast_lock_sha256"]==LOCK_SHA and len(locks)==18
    truth=source_counts(data,[l["job_id"] for l in locks]) if data is not None else {}
    ledger={(v["ordinal"],v["basis"],v["rep"],v["n"]):v for v in report["events"]}
    assert len(ledger)==len(report["events"])==648
    errs=[];loads=defaultdict(list);nlls=defaultdict(list);daily=defaultdict(list);dup=[];worst=(0.,None)
    for l in locks:
        o,j=l["ordinal"],l["job_id"]
        assert set(l["probabilities"])==set(ROLES)
        for bi,b in enumerate("XYZ"):
            pairs=[]
            for rep in (0,1):
                for k in range(10):
                    if truth:assert truth[j,b,rep,k]==l["prefix_counts"][k][bi][rep]
                y=[]
                for k in range(10,16):
                    row=ledger[o,b,rep,10*k]
                    assert row["job"]==j and row["date"]==l["date"] and row["shots"]==1024
                    c=row["k0"]
                    if truth:assert truth[j,b,rep,k]==c
                    y.append(c)
                    for role in ROLES:
                        p=l["probabilities"][role][k-10][bi]; assert row["p"][role]==p
                        f=c/1024
                        e=-f*math.log(p)-(1-f)*math.log(1-p)
                        residual=f-p
                        logprob=1024*e-math.log(math.comb(1024,c))
                        loads[role].append(e);nlls[role].append(logprob);daily[o,role].append(e)
                        errs.extend([abs(e-row["ce"][role]),abs(residual-row["residual"][role]),abs(logprob-row["nll"][role])])
                        if role=="dynamic_spam" and abs(residual)>worst[0]:
                            worst=(abs(residual),(o,b,rep,10*k))
                pairs.append(y)
            dup.append((o,b,all(v[bi][0]==v[bi][1] for v in l["prefix_counts"]),
                        sum(a==c for a,c in zip(*pairs)),sum(abs(a-c) for a,c in zip(*pairs))/6))
    for observed,released in zip(dup,report["concordance"]):
        assert observed==(released["ordinal"],released["basis"],released["prefix_all_identical"],released["held_equal"],released["held_mean_abs_count_difference"])
    means={r:math.fsum(vals)/len(vals) for r,vals in loads.items()}
    max_avg=max(abs(means[r]-report["means"][r]) for r in ROLES)
    max_total=max(abs(math.fsum(nlls[r])-report["total_binomial_nll"][r]) for r in ROLES)
    wins=sum(math.fsum(daily[i,"dynamic_spam"])<math.fsum(daily[i,"static_spam"]) for i in range(18))
    competitors=["static_spam","single_spam","free_static_spam","var1","var2"]
    gates={r:means["dynamic_spam"]<means[r] for r in competitors}
    assert wins==report["paired_static_wins"] and gates==report["gates"] and report["joint"]==(all(gates.values()) and wins>=12)
    w=report["worst_event"];assert worst[1]==(w["ordinal"],w["basis"],w["rep"],w["n"])
    shots=len(ledger)*1024
    gap_ce=(means["dynamic_spam"]-means["free_static_spam"])*shots
    gap_nll=math.fsum(nlls["dynamic_spam"])-math.fsum(nlls["free_static_spam"])
    assert max(errs)<5e-10 and max_avg<1e-14 and max_total<5e-8 and abs(gap_ce-gap_nll)<5e-8
    return dict(raw_source_verified=bool(truth),eligible_jobs=len(locks),circuits=len(ledger),shots=shots,
                probabilities_and_residuals=sum(map(len,loads.values())),date_wins=wins,gate=gates,joint=report["joint"],
                maximum_per_cell_delta=max(errs),maximum_mean_delta=max_avg,maximum_total_nll_delta=max_total,
                nll_gap_from_ce_per_shot=gap_ce,nll_gap_from_exact_binomial=gap_nll,worst_raw_row=worst[1],
                duplicate_prefix_identical=sum(v[2] for v in dup),duplicate_held_equal=sum(v[3] for v in dup))


if __name__=="__main__":
    folder=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).parent
    data=None
    if "--raw" in sys.argv:
        import urllib.request
        meta=json.load(urllib.request.urlopen("https://zenodo.org/api/records/8363718",timeout=40))
        f=next(f for f in meta["files"] if f["size"]==832470)
        data=urllib.request.urlopen(f["links"].get("content",f["links"]["self"]),timeout=40).read()
    print(json.dumps(run(folder,data),sort_keys=True))
