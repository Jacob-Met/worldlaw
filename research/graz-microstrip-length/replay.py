"""Rebuild six frozen forecasts, then score both physical standards from the archive."""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ARCHIVE = 'fb07e056ca519ab8c9637be7360617d3cfd4519cdd8b28597f53ad3c42308956'
ARCHIVED_AUTHOR = '5ba8b85738ce09e292e6d8d81262ca4076caa4427505148f47639ec865e9b8a6'
MAINTAINED_AUTHOR = 'ac0a335bc39d7fb31b2fa2df83544e082096474709d08ab3811c4bf41b1b4d76'
FILES = ('authors.py','receiver.py','matrix_paths.py','projective.py','pole_certificate.py',
         'forecast.py','forecast_projective.py','score.py','synthetic_projective.py')

def digest(data):
    return sha256(data).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path, help='Original Microstrip_measurements.zip')
    parser.add_argument('multiline', type=Path, help='Pinned author multiline.py')
    parser.add_argument('output', type=Path, help='New output directory')
    args=parser.parse_args()
    archive=args.archive.resolve()
    if digest(archive.read_bytes())!=ARCHIVE or digest(args.multiline.read_bytes())!=MAINTAINED_AUTHOR:
        raise ValueError('Original dataset or maintained author source identity differs')
    with zipfile.ZipFile(archive) as z: original=z.read('Microstrip_measurements/mTRL.py')
    if digest(original)!=ARCHIVED_AUTHOR:raise ValueError('Archived author source differs')
    home=args.output.resolve()
    home.mkdir(parents=True,exist_ok=False)
    root=Path(__file__).resolve().parent
    for item in FILES:shutil.copyfile(root/item,home/item)
    (home/'mTRL.py').write_bytes(original)
    shutil.copyfile(args.multiline,home/'maintained_multiline.py')
    env=dict(os.environ,OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1')
    def run(*argv):
        subprocess.run([sys.executable,*map(str,argv)],cwd=home,env=env,check=True)
    run(home/'synthetic_projective.py')
    run(home/'forecast_projective.py',archive,home/'prediction')
    locked=home/'prediction'/'forecasts.npz'
    ident=digest(locked.read_bytes())
    run(home/'score.py',archive,locked,ident,home/'score')
    report=json.loads((home/'score'/'scores.json').read_text())
    official=json.loads((root/'comparison.json').read_text())
    assert set(report['scores'])==set(official['scores']['metrics'])
    assert report['gates']==official['independent_recount']['gates'] and report['joint'] is False
    diffs=[abs(x-y) for name,row in report['scores'].items() for x,y in
           zip(row['per_length_rmse'],official['scores']['metrics'][name],strict=True)]
    if max(diffs)>1e-8:raise ValueError(f'Published numerical results differ by {max(diffs)}')
    print(json.dumps({'native_forecast_sha256':official['forecast']['forecast'],
        'replay_forecast_sha256':ident,'max_per_length_rmse_difference':max(diffs),
        'all_ten_gate_decisions_equal':True,'joint':report['joint']}))

if __name__=='__main__':main()
