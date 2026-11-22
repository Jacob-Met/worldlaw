"""Reconstruct the registered development comparison from the two original SOFA files."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_numeric(got, expected, path=""):
    if path.endswith("/raw_worst/predicted_LR") and path.startswith("/neighbor_"):
        # An eigenvector can receive a different common phase on another LAPACK build.
        import numpy as np
        a=np.asarray(got) @ np.array([1,1j]);b=np.asarray(expected) @ np.array([1,1j])
        assert np.allclose(np.outer(a,a.conj()),np.outer(b,b.conj()),rtol=2e-8,atol=2e-10),path
    elif isinstance(expected,dict):
        assert got.keys()==expected.keys(),path
        for key in expected:
            verify_numeric(got[key],expected[key],path+"/"+key)
    elif isinstance(expected,list):
        assert len(got)==len(expected),path
        for i,item in enumerate(expected):
            verify_numeric(got[i],item,f"{path}/{i}")
    elif isinstance(expected,bool) or not isinstance(expected,(int,float)):
        assert got==expected,path
    else:
        import math
        assert math.isclose(got,expected,rel_tol=2e-8,abs_tol=2e-10),path


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source",type=Path,required=True,help="Directory containing both published SOFA files")
    parser.add_argument("--output",type=Path,required=True,help="New directory for forecasts and scores")
    opts=parser.parse_args()
    root=Path(__file__).resolve().parent
    out=opts.output.resolve()
    out.mkdir(parents=True,exist_ok=False)
    src=opts.source.resolve()
    schema=root/"source-schema.json"
    expected=json.loads((root/"score-dev.json").read_text())
    assert expected["pass"] is False and expected["coordinates"]==1638
    base=[sys.executable,str(root/"course.py")]
    arguments=[str(src),str(out),str(schema),"--ports","dev"]
    subprocess.run([*base,"freeze",*arguments],check=True)
    pred=out/"forecasts-dev.npz"
    locked=digest(pred)
    genuine=locked==expected["locked_sha256"]
    subprocess.run([*base,"score",*arguments,"--lock",locked],check=True)
    got=json.loads((out/"score-dev.json").read_text())
    verify_numeric(got["results"],expected["results"])
    for key in ("pass","all_identifiable","beat_every_comparator","coordinates","frequencies"):
        assert got[key]==expected[key],key
    raw=out/"independent-dev.json"
    subprocess.run([sys.executable,str(root/"recount.py"),str(src/"KEMAR_NFHRIRmea_1cm.sofa"),
                    str(pred),str(out/"score-dev.json"),str(out/"outcomes-dev.npz"),"dev",str(raw)],check=True)
    independent=json.loads(raw.read_text())
    assert independent["joint"] is False
    print(json.dumps({"coordinates":got["coordinates"],"frequencies":got["frequencies"],"arms":len(got["results"]),
                      "frozen_original_forecast_sha256":expected["locked_sha256"],"replay_forecast_sha256":locked,
                      "forecast_bytes_equal":genuine,"all_sweep_and_raw_values_reproduced":True,
                      "independently_recounted_complex_errors":len(got["results"])*independent["per_arm_complex_points"],
                      "mean_and_worst_gates":got["beat_every_comparator"],"final_measurements_decoded":0},indent=2))


if __name__=="__main__":
    main()
