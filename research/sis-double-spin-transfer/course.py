"""Separated training, predicted spacings and measured-feature receiving."""
import argparse
import hashlib
import json
from pathlib import Path
from model import calibrate,forecast
from score import score

def main():
    p=argparse.ArgumentParser()
    p.add_argument("stage",choices=["calibrate","forecast","score"])
    p.add_argument("--sources",required=True,type=Path)
    p.add_argument("--input",type=Path)
    p.add_argument("--input-sha")
    p.add_argument("--spcat")
    p.add_argument("--output",required=True,type=Path)
    a=p.parse_args()
    if a.stage=="calibrate":result=calibrate(a.sources)
    else:
        raw=a.input.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=a.input_sha:raise ValueError("Artifact hash")
        b=json.loads(raw)
        result=forecast(a.sources,b,a.spcat) if a.stage=="forecast" else score(a.sources,b)
        result["input_sha256"]=a.input_sha
    raw=(json.dumps(result,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()
    a.output.write_bytes(raw)
    print(a.stage,len(raw),hashlib.sha256(raw).hexdigest())
if __name__=="__main__":main()
