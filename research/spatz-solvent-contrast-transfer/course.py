"""Reproduce the registered single-angle receiver from twelve authenticated NeXus files."""
import argparse,hashlib,json,pathlib
from forecast import TRAIN,HELD,forecasts
from envelope import envelopes
from projection import project,receive
from score import score
HERE=pathlib.Path(__file__).resolve().parent
def encoded(obj):
    return (json.dumps(obj,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()
def save(p,obj):
    raw=encoded(obj);pathlib.Path(p).write_bytes(raw);return hashlib.sha256(raw).hexdigest()
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("stage",choices=("calibrate","forecast","score"))
    ap.add_argument("--archives",type=pathlib.Path)
    ap.add_argument("--output",type=pathlib.Path,required=True)
    ap.add_argument("--input",type=pathlib.Path)
    ap.add_argument("--expected-sha256")
    a=ap.parse_args()
    design=json.loads((HERE/"design.json").read_bytes())
    if a.stage=="calibrate":
        if not a.archives:ap.error("--archives required")
        a.archives.mkdir(exist_ok=True,parents=True);receive(a.archives)
        result=project(a.archives,TRAIN,design)
    else:
        if not a.input or not a.expected_sha256:ap.error("input and expected hash required")
        raw=a.input.read_bytes();actual=hashlib.sha256(raw).hexdigest()
        if actual!=a.expected_sha256:raise ValueError("Immutable input hash mismatch")
        inp=json.loads(raw)
        if a.stage=="forecast":
            if set(inp)!={str(i) for i in TRAIN}:raise ValueError("Calibration roster")
            result=forecasts(design,inp)
            result.update(envelopes=envelopes(inp,design),calibration=inp,calibration_sha256=actual)
        else:
            if not a.archives:ap.error("--archives required")
            if set(inp["points"])!={str(i) for i in HELD}:raise ValueError("Forecast roster")
            receive(a.archives)
            tv=project(a.archives,HELD,design)
            result={"forecast_sha256":actual,"truth":tv,"score":score(inp,tv)}
    print("OUTPUT",a.stage,save(a.output,result),a.output.stat().st_size,flush=True)
if __name__=="__main__":main()
