"""Replay all four registered physical configurations from the publisher archive."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

HERE=Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def run(script,*args):
    subprocess.run([sys.executable,str(HERE/script),*map(str,args)],check=True,
                   env={**os.environ,'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1'})

def compare(got,expected,where='root'):
    if isinstance(expected,dict):
        assert got.keys()==expected.keys(), where
        for key in expected:compare(got[key],expected[key],where+'.'+str(key))
    elif isinstance(expected,list):
        assert len(got)==len(expected),where
        for i,(v,w) in enumerate(zip(got,expected)):compare(v,w,where+str(i))
    elif isinstance(expected,bool) or isinstance(expected,(int,str)) or expected is None:
        assert type(got) is type(expected) and got==expected,where
    else:
        assert abs(got-expected)<=2e-9*(1+abs(expected)),(where,got,expected)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('archive',type=Path)
    a=ap.parse_args()
    assert digest(a.archive)=='9b93ad7d7dfe8b576c65836f4c884caa0b34b65c599778dac557abffdd950e59'
    original=json.loads((HERE/'measurements.json').read_text())
    with tempfile.TemporaryDirectory() as td:
        dev=Path(td)/'dev';res=Path(td)/'reserve';dev.mkdir()
        shutil.copyfile(HERE/'study.py',dev/'study.py')
        run('study.py','lock',a.archive,dev)
        fresh_dev_lock=digest(dev/'lock.json')
        run('study.py','score',a.archive,dev,'--pin',fresh_dev_lock)
        # BLAS may change a few least significant bits. Check the fresh entire
        # training results first, then install the original exact training packet
        # for the historical reserve reader's immutable training-pin check.
        compare(json.loads((dev/'training.json').read_text()),json.loads((HERE/'training.json').read_text()))
        shutil.copyfile(HERE/'training.json',dev/'training.json')
        run('reserve.py','lock',a.archive,dev,res)
        run('reserve.py','score',a.archive,dev,res,'--pin',digest(res/'lock.json'))
        for directory,name in [(dev,'development'),(res,'reserve')]:
            now=json.loads((directory/'scores.json').read_text())
            before=original[name]
            assert now['lock_sha256']==digest(directory/'lock.json')
            compare({k:v for k,v in now.items() if k!='lock_sha256'},
                    {k:v for k,v in before.items() if k!='lock_sha256'})
        output=Path(td)/'independent.json'
        run('receive.py',a.archive,dev,res,output)
        fresh=json.loads(output.read_text())
        stored=json.loads((HERE/'independent.json').read_text())
        compare(fresh,stored)
        assert fresh['rows']==12620 and fresh['scores']==140
        print('Replayed 4 physical configurations, 12,620 complex forecasts and 140 scores. Development passed 7/7; reserve failed 5/5.')
if __name__=='__main__':main()
