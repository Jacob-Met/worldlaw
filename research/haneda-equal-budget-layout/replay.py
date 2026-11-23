"""Rerun the four-source placement study from raw HDF5 files or authenticated input projections."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zlib
import numpy as np
from forecast import forecast
from projection import DEV, HELD, project
from score import score
from independent import direct_projection, independent
from neighborhood import read_neighborhood

ROOT=Path(__file__).resolve().parent

def verify_forecasts(fresh, original):
    for field in ("centers","frequencies","held","development","ids"):
        assert fresh[field]==original[field]
    assert set(fresh["forecasts"])==set(original["forecasts"])
    for layout,group in original["calibration"].items():
        assert fresh["calibration"][layout]["selected"]==group["selected"]
        for name,method in group["methods"].items():
            assert fresh["calibration"][layout]["methods"][name]["chosen"]["ridge"]==method["chosen"]["ridge"]
    for key,group in original["forecasts"].items():
        assert set(group)==set(fresh["forecasts"][key])
        for name,target in group.items():
            np.testing.assert_allclose(fresh["forecasts"][key][name],target,atol=2e-7,rtol=2e-9)

def run(archives,projections):
    receipts=json.loads((ROOT/"digests.json").read_bytes())
    saved=json.loads((ROOT/"independent-receipt.json").read_bytes())
    for name in ("simplex_certificate.py","stereographic_certificate.py"):
        subprocess.run([sys.executable,str(ROOT/name)],check=True)
    with tempfile.TemporaryDirectory(prefix="haneda-replay-") as tmp:
        local=Path(tmp)
        for name in ("forecast","outcome"):
            z=(ROOT/(name+".json.zlib")).read_bytes()
            assert hashlib.sha256(z).hexdigest()==receipts[name]["compressed_sha256"]
            raw=zlib.decompress(z)
            assert hashlib.sha256(raw).hexdigest()==receipts[name]["sha256"]
            (local/(name+".json")).write_bytes(raw)
        lock=receipts["forecast"]["sha256"]
        if archives:
            for s in (*DEV,*HELD):
                original=archives/f"Raw_A_ir_48k_sp{s}.h5"
                project(original,s,"calibration" if s in DEV else "donors",local/f"sp{s}.npz")
            input_dir=local
        else:
            input_dir=projections
            for name,expected in receipts["projections"].items():
                assert hashlib.sha256((input_dir/name).read_bytes()).hexdigest()==expected
        forecast(input_dir,local/"fresh.json")
        verify_forecasts(json.loads((local/"fresh.json").read_bytes()),json.loads((local/"forecast.json").read_bytes()))
        if archives:
            for s in HELD:
                original=archives/f"Raw_A_ir_48k_sp{s}.h5"
                project(original,s,"targets",local/f"truth{s}.npz",local/"forecast.json",lock)
            truth={str(s):direct_projection(archives/f"Raw_A_ir_48k_sp{s}.h5",s) for s in HELD}
        else:
            truth={s:v["values"] for s,v in saved["raw"].items()}
        score(input_dir,local/"forecast.json",lock,local/"fresh-score.json")
        rebuilt=independent(local/"forecast.json",local/"fresh-score.json",truth)
        original=independent(local/"forecast.json",local/"outcome.json",truth)
        assert rebuilt["gates"]==original["gates"]==saved["scalar"]["gates"]
        if archives:
            outcome=json.loads((local/"outcome.json").read_bytes())
            for s in HELD:
                witness=outcome["worst_stress_rows"][f"{s}/relocated/selected"]
                current=read_neighborhood(archives/f"Raw_A_ir_48k_sp{s}.h5",witness["center"],witness["hz"])
                prior=saved["raw"][str(s)]["neighborhood"]
                assert [r["grid_row"] for r in current]==[r["grid_row"] for r in prior]
                np.testing.assert_allclose([r["value"] for r in current],[r["value"] for r in prior],atol=1e-8,rtol=1e-10)
        print("Verified",len(original["gates"]),"registered gates;",sum(original["gates"].values()),
              "passed. All 700 raw held coefficients and",original["metric_comparisons"],"scalar metrics received.")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--archives",type=Path)
    group.add_argument("--verified-projections",type=Path)
    a=parser.parse_args()
    run(a.archives,a.verified_projections)
