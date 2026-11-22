"""Reconstruct or receive the exact published prediction file, then independently score it."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--predictions',type=Path,help='optional original prediction ZIP')
    args=parser.parse_args()
    here=Path(__file__).resolve().parent
    expected=json.loads((here/'prediction-receipt.json').read_text())
    score_ref=json.loads((here/'held-receipt.json').read_text())
    frozen=json.loads((here/'frozen-protocol.json').read_text())
    for n,h in frozen['code_sha256'].items():
        if digest(here/n)!=h:raise ValueError(f'frozen source changed: {n}')
    supplied=args.predictions.resolve() if args.predictions else None
    env=dict(os.environ,OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1')
    with tempfile.TemporaryDirectory(prefix='davis-locked-replay-') as tmp:
        wd=Path(tmp)
        for n in [*frozen['code_sha256'],'frozen-protocol.json','development.json',
                  'predict_locked.py','score_locked.py','independent_recount.py']:
            shutil.copy2(here/n,wd/n)
        if supplied:
            if digest(supplied)!=expected['archive_sha256']:raise ValueError('supplied forecast digest')
            shutil.copy2(supplied,wd/'predictions.zip')
        else:
            subprocess.run([sys.executable,'predict_locked.py'],cwd=wd,check=True,env=env)
        if digest(wd/'predictions.zip')!=expected['archive_sha256']:
            raise ValueError('reconstructed numerical bytes differ from the original forecast; exact receiving requires the published original archive')
        subprocess.run([sys.executable,'score_locked.py',expected['archive_sha256'],expected['lock_sha256']],cwd=wd,check=True,env=env)
        observed=digest(wd/'score.json')
        if observed!=score_ref['score_sha256']:
            raise ValueError('score bytes differ from the published primary receipt')
        subprocess.run([sys.executable,'independent_recount.py',expected['archive_sha256'],observed],cwd=wd,check=True,env=env)
if __name__=='__main__':main()
