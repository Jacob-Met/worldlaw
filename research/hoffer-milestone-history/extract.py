"""Extract prefix-only predictors or recorded first-passage events from the released columns."""
from collections import Counter,defaultdict
import hashlib
import math
from pathlib import PurePosixPath
import re
import numpy as np
from archive import authenticated_archive,metadata,blocks

H=np.array([2.,4.,8.,16.,32.,64.,128.])
N=301

def fetch_case(values,dt,mode):
    # Accessor converts a coordinate token only when explicitly indexed. The
    # held prefix phase never converts a coordinate after the issue sample.
    q=[]
    deadline=max(0,N-1-math.ceil(128./dt-1e-12))
    last=-1
    hit=False
    for i in range(deadline+1):
        z=values(i)
        if not math.isfinite(z):return None
        q.append(z)
        if z<=.2:last=i
        if last>=0 and z>=.5:
            hit=True
            break
    now=q[-1]
    lag=max(1,math.ceil(8./dt-1e-12))
    slow=max(1,math.ceil(32./dt-1e-12))
    X=[now,i/300.,float(hit),float(last>=0),now-q[max(0,i-lag)],
       (i-last)*dt if last>=0 else 0.,now-sum(q[-slow:])/len(q[-slow:])]
    if mode=="prefix":return X,None
    # The seven labels concern only coordinates through the largest horizon.
    end=min(N-1,i+math.floor(128./dt+1e-12))
    first=0. if now>=.8 else math.inf
    if first:
        for j in range(i+1,end+1):
            z=values(j)
            if not math.isfinite(z):return X,None
            if z>=.8:
                first=(j-i)*dt
                break
    return X,(first<=H+1e-10).astype(np.uint8)

def harvest(path,mode):
    if mode not in ("donor","prefix","score"):raise ValueError("stage")
    direction="U" if mode=="donor" else "F"
    prefix="UpTransition" if direction=="U" else "DownTransition"
    parsed={};ledger=[];seen=set()
    with authenticated_archive(path) as archive:
        table=metadata(archive)
        for e in table:
            if e["direction"]!=direction:continue
            member=e["member"]
            key=(e["group"],e["dt_us"],e["start_nm"],e["end_nm"])
            holder=parsed.setdefault(key,{"ids":[],"x":[],"y":[]})
            row={"member":member,"key":key,"declared":e["declared"],"present":e["present"],"blocks":[]}
            ledger.append(row)
            if not e["present"]:continue
            raw=archive.read(member)
            emitted=False
            for ib,(head,body) in enumerate(blocks(raw)):
                emitted=True
                names=head.decode("latin1").rstrip("\t").split("\t")
                width=len(names)
                signature=(key,head,hashlib.sha256(b"\n".join(body)).hexdigest())
                detail={"block":ib,"body_sha256":signature[-1],"columns":width,"rows":len(body),
                        "duplicate":signature in seen,"prefix_unknown":0,"endpoint_unknown":0}
                row["blocks"].append(detail)
                if signature in seen:continue
                seen.add(signature)
                matrix=[l.split(b'\t') for l in body]
                for col,name in enumerate(names):
                    uid=f"{member}:{ib}:{col}:{name}"
                    holder["ids"].append(uid)
                    if len(body)!=N or not re.fullmatch(prefix+r"\d+",name):
                        result=None
                    else:
                        def value(j):
                            r=matrix[N-1-j if mode=="donor" else j]
                            if col>=len(r) or not r[col].strip():return math.nan
                            try:z=float(r[col])
                            except ValueError:return math.nan
                            return (z-e["start_nm"])/(e["end_nm"]-e["start_nm"])
                        result=fetch_case(value,e["dt_us"],mode)
                    x,y=(None,None) if result is None else result
                    if x is None:detail["prefix_unknown"]+=1
                    if mode!="prefix" and y is None:detail["endpoint_unknown"]+=1
                    holder["x"].append([math.nan]*7 if x is None else x)
                    if mode!="prefix":holder["y"].append([255]*7 if y is None else y)
            if not emitted:
                row["unbound_header"]=True
    return parsed,ledger
