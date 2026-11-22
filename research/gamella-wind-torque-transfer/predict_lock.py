"""Write and identify every forecast before any held suffix is exposed."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import numpy as np
import pandas as pd
import wind_transfer as w

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main(out):
    out.mkdir(parents=True,exist_ok=False)
    policy=json.loads(Path('protocol.json').read_text())
    if [*policy['controls'],policy['candidate']]!=list(w.ROLES):
        raise ValueError('registered role order')
    files=['design.txt','protocol.json','wind_transfer.py','wt_models.py','predict_lock.py',
           'score_locked.py','author_simulator.py','verify_author.py','torque_flow.py']
    if digest(Path('design.txt'))!=policy['design_sha256']:raise ValueError('changed initial design')
    model=w.fit()
    record={'source_sha256':{f:digest(Path(f)) for f in files},'predictions':{},
            'runtime':[platform.python_version(),np.__version__,pd.__version__]}
    for member in policy['holdouts']:
        u,prefix=w.panel(member,inputs_only=True)
        if prefix.shape!=(5000,5,2) or not np.isfinite(prefix).all():raise ValueError('prefix')
        arrays=w.forecasts(model,u,prefix)
        archive=out/f'forecasts-{member}.npz'
        np.savez_compressed(archive,**arrays)
        with np.load(archive,allow_pickle=False) as data:
            if list(data.files)!=list(w.ROLES):raise ValueError('role roster')
            sums={}
            for name in w.ROLES:
                a=data[name]
                if a.shape!=(5000,45,2) or a.dtype.str!='<f4':raise ValueError('forecast schema')
                sums[name]=hashlib.sha256(a.tobytes(order='C')).hexdigest()
        record['predictions'][member]={'archive_sha256':digest(archive),'array_sha256':sums}
    path=out/'prediction-lock.json'
    path.write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'lock_sha256':digest(path),'registry':record}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('out',type=Path);main(p.parse_args().out)
