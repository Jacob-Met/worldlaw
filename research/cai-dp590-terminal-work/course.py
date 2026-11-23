"""Run the prospectively separated calibration, endpoint-strain forecast and score."""
import argparse
import hashlib
import json
import pathlib
from model import calibration,endpoint_compatibility,forecasts
from score import score

def packed(obj):
    return (json.dumps(obj,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()

def load_locked(path,digest):
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=digest:raise ValueError("Input identity mismatch")
    return json.loads(data)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("stage",choices=("calibrate","forecast","score"))
    ap.add_argument("--archives",type=pathlib.Path,required=True)
    ap.add_argument("--input",type=pathlib.Path)
    ap.add_argument("--sha256")
    ap.add_argument("--output",type=pathlib.Path,required=True)
    args=ap.parse_args()
    if args.stage=="calibrate":
        result={"tab":calibration(args.archives),"compatibility":endpoint_compatibility(args.archives)}
    else:
        locked=load_locked(args.input,args.sha256)
        if args.stage=="forecast":
            result={**locked,"calibration_sha256":args.sha256,"predictions":forecasts(args.archives,locked["tab"])}
        else:
            result={"forecast_sha256":args.sha256,"score":score(args.archives,locked)}
    raw=packed(result)
    args.output.write_bytes(raw)
    print(args.stage,len(raw),hashlib.sha256(raw).hexdigest())
if __name__=="__main__":main()
