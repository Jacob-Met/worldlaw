"""Independent array and empirical receiver; reads only the public training cases 2–4."""
import argparse
import hashlib
import io
import json
import math
import struct
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from scipy.io import loadmat

BASE="https://raw.githubusercontent.com/alexdenker/ktc2023_postprocessing/5f0b13f807d3482e964f236ada6e86b5c66477f5/ChallengeData/level_1/"
CASES={2:"a286e50e8670e36c96030c7dcf493e05d9a02d30",3:"f6767e5771aaf894e7da258f3dac91444f146f0a",4:"c558b3e0d93775714634b40117742428e9831e95"}
ARMS=["water","raw_repeat","reference_repeat","reference_repeat_source_bias","raw_superposition","reference_superposition","raw_reciprocal","reference_reciprocal","reference_reciprocal_gls","reference_reciprocal_gls_wrong_electrode_order","source_blend"]
CORE=ARMS[2:3]+[ARMS[5],ARMS[7],ARMS[9]]
STRONG=[ARMS[3],ARMS[10]]


def measure(path,sha):
    b=path.read_bytes()
    assert hashlib.sha256(b).hexdigest()==sha
    rows={};scores={}
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        man=json.loads(z.read("manifest.json"))
        expected={f"phantom{i}/{a}.f64le" for i in CASES for a in ARMS}
        assert set(man['sha256'])==expected and set(z.namelist())==expected|{'manifest.json'} and len(z.namelist())==34
        for k in expected:
            raw=z.read(k)
            assert hashlib.sha256(raw).hexdigest()==man['sha256'][k] and len(raw)==3472
            rows[k]=struct.unpack("<434d",raw)
    for case,blob in CASES.items():
        with urllib.request.urlopen(BASE+f"data{case}.mat",timeout=40) as f: b=f.read(40585)
        assert len(b)==40584 and hashlib.sha1(b"blob 40584\0"+b).hexdigest()==blob
        store=loadmat(io.BytesIO(b),variable_names=["Inj","Uel"]);curr=store['Inj'];obs=store['Uel'][:,0].tolist()
        seen={};query=[]
        for column,u in enumerate(curr.T):
            pair=tuple(np.flatnonzero(u))
            if pair in seen:query.append(column)
            else:seen[pair]=column
        assert [x+1 for x in query]==man['columns_one_based'] and len(query)==14
        ground=[float(obs[31*col+edge]) for edge in range(31) for col in query]
        result={}
        for arm in ARMS:
            pred=rows[f"phantom{case}/{arm}.f64le"]
            err=[s-t for s,t in zip(pred,ground)]
            worst=max(range(434),key=lambda k:abs(err[k]))
            result[arm]={"rmse_V":math.sqrt(math.fsum(e*e for e in err)/434),
              "mae_V":math.fsum(abs(e) for e in err)/434,
              "worst":[1+worst//14,1+query[worst%14],pred[worst],ground[worst],abs(err[worst])],
              "per_pattern_rmse_V":[math.sqrt(math.fsum(e*e for e in err[k::14])/31) for k in range(14)]}
        scores[str(case)]=result
    means={a:math.fsum(s[a]['rmse_V'] for s in scores.values())/3 for a in ARMS}
    p=ARMS[8]
    gate=lambda controls:all(means[p]<means[t] and sum(s[p]['rmse_V']<s[t]['rmse_V'] for s in scores.values())>=2 for t in controls)
    return {"sha256":sha,"mean_phantom_rmse_V":means,"all":scores,"core":gate(CORE),"strong":gate(STRONG),"joint":gate(CORE+STRONG)}


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path)
    parser.add_argument("sha")
    args=parser.parse_args();print(json.dumps(measure(args.archive,args.sha),sort_keys=True))
