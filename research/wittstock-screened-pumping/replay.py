"""Rebuild the physical pressure course and compare with the original frozen result."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.request import urlopen

import numpy as np

import pressure

BASE = Path(__file__).resolve().parent
RELEASE = "https://data.mendeley.com/public-files/datasets/rjzt4hjb8h/files/97cee424-e63c-47de-b616-0f675429970e/file_downloaded"
PUBLISHED_TARGET = "https://prod-dcd-datasets-public-files-eu-west-1.s3.eu-west-1.amazonaws.com/44008279-afd2-4a6e-a01a-35d62bfe2dba"


def archive(cache):
    target = cache / "author-input.zip"
    if not target.exists():
        for url in [RELEASE, PUBLISHED_TARGET]:
            try:
                with urlopen(url, timeout=120) as response:
                    data = response.read(38_777_115)
                if len(data) != 38_777_114 or hashlib.sha256(data).hexdigest() != pressure.SHA:
                    raise ValueError("Published input identity mismatch")
                with tempfile.NamedTemporaryFile(dir=cache, delete=False) as handle:
                    handle.write(data)
                Path(handle.name).replace(target)
                break
            except OSError:
                if url == PUBLISHED_TARGET:
                    raise
    assert target.stat().st_size == 38_777_114
    assert hashlib.sha256(target.read_bytes()).hexdigest() == pressure.SHA
    return target


def check_actual(actual, expected):
    assert actual['decision'] == expected['decision'] is False
    for method in ['Theis','finite_screen']:
        for a,b in zip(actual['fits'][method], expected['fits'][method], strict=True):
            assert a['well'] == b['well']
            for field in ['train_rmse_mm','full_rmse_mm','pumping_rmse_mm','recovery_rmse_mm','D_m2_s','gain_m']:
                np.testing.assert_allclose(a[field],b[field],rtol=1e-8,atol=1e-10)
            assert a['worst']['seconds']==b['worst']['seconds']
            assert a['worst']['depth_m']==b['worst']['depth_m']
            np.testing.assert_allclose(a['worst']['error_mm'],b['worst']['error_mm'],rtol=1e-8)
    np.testing.assert_allclose(actual['ratios'],expected['ratios'],rtol=1e-8)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    args.cache.mkdir(parents=True,exist_ok=True)
    args.output.mkdir(parents=True,exist_ok=True)
    physical=archive(args.cache)
    env=dict(os.environ,OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1')
    subprocess.run([sys.executable,str(BASE/'pressure.py'),str(physical),str(args.output)],env=env,check=True)
    report=args.output/'pressure-receiver.json'
    forecast=args.output/'pressure-predictions.npz'
    subprocess.run([sys.executable,str(BASE/'independent.py'),str(physical),str(report),str(forecast),str(args.output)],env=env,check=True)
    frozen=json.loads((BASE/'result.json').read_text())
    received=json.loads(report.read_text())
    assert received['count']==8397
    check_actual(received['primary'],frozen['original_primary'])
    check_actual(received['333s_activity_log'],frozen['activity_clock'])
    observed,source,radii=pressure.read_release(physical)
    fits=pressure.fit_all(observed,radii,332,np.geomspace(.01,10000.,81),np.geomspace(.003,1,45))
    refined,_=pressure.summarize(observed,source,radii,fits,332)
    check_actual(refined,frozen['doubled_grid'])
    independent=json.loads((args.output/'independent-pressure-receipt.json').read_text())
    assert independent['raw_sha256']==frozen['independent']['raw_sha256']
    assert independent['independent_exact_depth_floor']==frozen['independent']['independent_exact_depth_floor']
    assert independent['counterfactual_control']==frozen['independent']['counterfactual_control']
    assert independent['match_1_micrometre']
    print(json.dumps({'observations':8397,'methods':2,'mean_rmse_ratio':received['primary']['mean_ratio'],
                      'max_prediction_disagreement_mm':independent['max_disagreement_mm'],
                      'thermal_transfer_admitted':False},indent=2))
if __name__=='__main__':
    main()
