"""Rebuild the held-position original from the pinned source and recount it separately."""
import argparse
import hashlib
import json
import math
from pathlib import Path

from independent import check
from lock import freeze
from score import score

HERE=Path(__file__).resolve().parent

def same(a,b,path="result"):
    if isinstance(b,dict):
        if a.keys()!=b.keys():raise ValueError(path)
        for k,v in b.items():same(a[k],v,f"{path}.{k}")
    elif isinstance(b,list):
        if len(a)!=len(b):raise ValueError(path)
        for i,(x,y) in enumerate(zip(a,b)):same(x,y,f"{path}[{i}]")
    elif isinstance(b,float):
        if not math.isclose(a,b,rel_tol=1e-13,abs_tol=1e-9):raise ValueError((path,a,b))
    elif a!=b:raise ValueError((path,a,b))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive",type=Path,required=True,help="Verified author tar; downloaded when absent")
    args=parser.parse_args()
    args.archive.parent.mkdir(parents=True,exist_ok=True)
    bank=freeze(args.archive)
    raw=(json.dumps(bank,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()
    stored=(HERE/"forecast.json").read_bytes()
    if hashlib.sha256(stored).hexdigest()!="2726f93ed200be23ca0d4f9eea68a0b0088d676bd9f38140ecacd824dfe9a182":
        raise ValueError("Original bank identity")
    same(json.loads(raw),json.loads(stored))
    outcome=score(args.archive,bank)
    same(outcome,json.loads((HERE/"result.json").read_bytes()))
    independent=check(args.archive,json.loads(stored),outcome)
    same(independent,json.loads((HERE/"independent-receipt.json").read_bytes()))
    print(json.dumps({"byte_identical_bank":raw==stored,"max_independent_error_mas":independent["max_forecast_component_difference_mas"],
                     "epochs":independent["epochs"],"gates":independent["gates"],"range_hits":independent["range_hits"]},sort_keys=True))

if __name__=="__main__":main()
