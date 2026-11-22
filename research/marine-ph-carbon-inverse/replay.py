"""Replay the 25-batch optical inverse and independent assay receiver from public sources."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen
import shutil
import subprocess
import sys


def same(a,b):
    x=json.loads(a.read_bytes()); y=json.loads(b.read_bytes())
    def walk(l,r):
        if isinstance(l,bool) or isinstance(r,bool):
            assert l is r
        elif isinstance(l,(int,float)) and isinstance(r,(int,float)):
            import math
            if not math.isclose(l,r,rel_tol=2e-8,abs_tol=2e-6):
                raise ValueError((l,r))
        elif isinstance(l,dict) and isinstance(r,dict):
            if set(l)!=set(r):raise ValueError("record keys differ")
            for k in r:walk(l[k],r[k])
        elif isinstance(l,list) and isinstance(r,list):
            if len(l)!=len(r):raise ValueError("record lengths differ")
            for u,v in zip(l,r):walk(u,v)
        elif l!=r:
            raise ValueError((l,r))
    walk(x,y)


def replay(cache,work,fetch):
    base=Path(__file__).resolve().parent
    registry=json.loads((base/"source-registry.json").read_bytes())
    cache.mkdir(parents=True,exist_ok=True)
    for k,row in registry.items():
        path=cache/(k+".csv")
        if not path.exists():
            if not fetch:raise FileNotFoundError(f"Missing {path}; --fetch obtains the released files.")
            req=Request(row["url"],headers={"User-Agent":"Woosley-thermal-pH-research-replay/1"})
            with urlopen(req,timeout=45) as f:
                raw=f.read(row["bytes"]+1)
            if len(raw)!=row["bytes"] or hashlib.sha256(raw).hexdigest()!=row["sha256"]:
                raise ValueError(f"source hash mismatch for {k}")
            with path.open("xb") as f:f.write(raw)
        if hashlib.sha256(path.read_bytes()).hexdigest()!=row["sha256"]:
            raise ValueError(f"wrong cached original for {k}")
    work.mkdir()
    env=dict(os.environ,OPENBLAS_NUM_THREADS="1",MKL_NUM_THREADS="1",OMP_NUM_THREADS="1")
    def run(name,*args):
        subprocess.run([sys.executable,str(base/name),*map(str,args)],check=True,env=env)
    inputs=work/"input";grade=work/"grade"
    run("project.py",cache,inputs,"forecast",base/"split.json")
    run("forecast.py",inputs,work/"locked.json")
    same(work/"locked.json",base/"locked.json")
    print("Locked all 25 forecasts",hashlib.sha256((work/"locked.json").read_bytes()).hexdigest(),flush=True)
    run("project.py",cache,grade,"score",base/"split.json")
    for source,name in ((inputs,"optical-inputs.json"),(inputs,"split.json"),(grade,"all-assays.json")):
        shutil.copyfile(source/name,work/name)
    run("score.py",work/"locked.json",work/"all-assays.json",work/"split.json",work/"observed.json")
    same(work/"observed.json",base/"observed.json")
    run("recount.py",work,cache);same(work/"independent.json",base/"independent.json")
    run("diagnose.py",work)
    # Farkas witnesses need not be unique across LP implementations.
    actual=json.loads((work/"bath-diagnostics.json").read_bytes())
    reference=json.loads((base/"bath-diagnostics.json").read_bytes())
    for k,v in reference.items():
        import numpy as np
        if bool(actual[k]["certificate_at_0.003"])!=bool(v["certificate_at_0.003"]):
            raise ValueError("exact dual-certificate status differs")
        if not np.allclose(actual[k]["forward_error"],v["forward_error"],atol=2e-9,rtol=0):
            raise ValueError("forward chemistry residual differs")


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("source_cache",type=Path)
    p.add_argument("--fetch",action="store_true")
    p.add_argument("--work",type=Path,help="new directory for all replay outputs")
    x=p.parse_args()
    if x.work:replay(x.source_cache,x.work,x.fetch)
    else:
        with TemporaryDirectory(prefix="marine-ph-") as temp:
            replay(x.source_cache,Path(temp)/"replay",x.fetch)
