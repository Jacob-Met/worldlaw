"""Apply loaded-only fits to five open-circuit trajectories using only the optical clock and angles."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
from flux import KINDS, build_motion

FIT_SHA = '5fa1bb0794ce01af82105ee68d6f572ecee9c283cf8685417d83a1d8c27c8c76'
FLUX_SHA = '1b33d5da2d4e78d0a44a9f89d3046b017e97f7c208885bb49478267f767cfc48'
HELD = (37,38,39,40,41)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def expected_files(exposure,folder):
    rows=json.loads(exposure.read_bytes())['roster']
    result={}
    for row in rows:
        if row['folder']!=folder:continue
        import re
        i=int(re.search(r'exp(\d+)',row['name']).group(1))
        if i in HELD:result[i]=row
    if tuple(sorted(result))!=HELD:raise ValueError('five locked files required')
    return result

def produce(source,coefs,root,output):
    if digest(Path(__file__).with_name('flux.py'))!=FLUX_SHA or digest(coefs)!=FIT_SHA:
        raise ValueError('unexpected completed loaded-only fit')
    expected=expected_files(source,'Post-processed data')
    forecasts={};details={}
    with np.load(coefs,allow_pickle=False) as weights:
        if set(weights.files)!=set(KINDS):raise ValueError('role roster')
        for i in HELD:
            path=root/(f'{i:02d}-motion.csv');row=expected[i]
            if path.stat().st_size!=row['bytes'] or digest(path)!=row['sha256']:raise ValueError('optical source identity')
            x=build_motion(path)
            for role in KINDS:
                y=x[role]@weights[role]
                if y.shape!=(100,24) or not np.isfinite(y).all():raise ValueError('finite forecast array expected')
                forecasts[f'{i}-{role}']=y
            details[i]={'file_sha256':row['sha256'],'interval_s':x['dt'].ravel().tolist(),
                        'optical_features_used':['Time','qr','qb','qy']}
    np.savez_compressed(output,**forecasts)
    return {'roles':KINDS,'held':HELD,'members':len(forecasts),'signed_predictions':len(forecasts)*2400,
            'coefficients_sha256':FIT_SHA,'forecast_sha256':digest(output),'forecast_bytes':output.stat().st_size,
            'inputs':details,'target_files_accessed':0}

if __name__=='__main__':
    args=list(map(Path,sys.argv[1:]))
    result=produce(*args)
    print(json.dumps(result))
