"""Reconstruct all stages from the two source files and compare every saved scalar."""
import argparse
import json
import math
import pathlib
from model import calibration, endpoint_compatibility, forecasts
from score import score
from source import PINS, archive

def compare(observed,expected,path=""):
    if isinstance(expected,dict):
        if set(observed)!=set(expected):raise ValueError(path+" keys")
        return sum(compare(observed[k],v,path+"/"+k) for k,v in expected.items())
    if isinstance(expected,list):
        if len(observed)!=len(expected):raise ValueError(path+" length")
        return sum(compare(a,b,path+"/"+str(i)) for i,(a,b) in enumerate(zip(observed,expected)))
    if isinstance(expected,(bool,str)) or expected is None:
        if observed!=expected:raise ValueError(path)
    elif not math.isclose(observed,expected,rel_tol=2e-7,abs_tol=2e-8):
        raise ValueError(f"{path}: computed {observed!r}, archived {expected!r}")
    return 1

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--archives",type=pathlib.Path,required=True)
    ns=ap.parse_args()
    directory=pathlib.Path(__file__).resolve().parent
    for source in PINS:archive(ns.archives,source)
    b=json.loads((directory/"forecast.json").read_text())
    s=json.loads((directory/"score.json").read_text())
    t=calibration(ns.archives)
    c=endpoint_compatibility(ns.archives)
    p=forecasts(ns.archives,t)
    source_bank={"tab":t,"compatibility":c,"predictions":p}
    checks=compare(t,b["tab"])+compare(c,b["compatibility"])+compare(p,b["predictions"])
    actual=score(ns.archives,source_bank)
    checks+=compare(actual,s["score"])
    print("REPLAY",json.dumps({"checks":checks,"programs":len(p),"predictions":sum(len(v["predicted_work"]) for v in p.values()),"gates_passed":sum(actual["gates"].values()),"gates":len(actual["gates"]),"joint":actual["joint"]}))

if __name__=="__main__":main()
