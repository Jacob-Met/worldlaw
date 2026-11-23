"""Evaluate A8-0 with the exact development estimators and four original donors."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

from types import ModuleType
import numpy as np

SOURCE_SHA='0a2897cccdde44ac4f7071d7d01371d51501267a1e8b18eb9e6359013c25c9e6'
TRAIN_SHA='3277de035022209e1707f7a443d7ecee25d52b7423b1dd62945a6eadd119991a'
def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=('lock','score'))
    parser.add_argument('archive',type=Path)
    parser.add_argument('development',type=Path)
    parser.add_argument('destination',type=Path)
    parser.add_argument('--pin')
    a=parser.parse_args()
    source=(a.development/'study.py').read_bytes()
    assert digest(source)==SOURCE_SHA
    # The development reader forbade any A8 access.  Narrow the replacement to
    # the explicit per-call (sheet,load) allowlist, reinforced by the archive proxy.
    assert source.count(b" and sheet!='A8'")==1
    mod=ModuleType('frozen_development_operators')
    exec(compile(source.replace(b" and sheet!='A8'",b""),'study.py','exec'),mod.__dict__)
    assert digest(a.archive.read_bytes())==mod.ARCHIVE_SHA
    training_raw=(a.development/'training.json').read_bytes()
    assert digest(training_raw)==TRAIN_SHA
    train=json.loads(training_raw)
    assert train['ridge']==[160,1.0]
    mod.DEV={'A8':'0'}
    a.destination.mkdir(exist_ok=True)
    def fixed_train(z,work):
        ledger={}
        permitted={(s,k) for s in mod.CAL for k in mod.LOADS}
        donors={s:{k:mod.read_trace(z,s,k,ledger,permitted) for k in mod.LOADS} for s in mod.CAL}
        assert ledger==train['ledger']
        (work/'training.json').write_bytes(training_raw)
        return donors,tuple(train['ridge'])
    mod.train=fixed_train
    with zipfile.ZipFile(a.archive) as z:
        class ReadOnlyMembers:
            def read(self,n):
                if n not in allowed: raise ValueError(f'Unknown member: {n}')
                return z.read(n)
        if a.mode=='lock':
            allowed=set(train['ledger'])|{f'data/mean/A8-{k}.csv' for k in ['P','G','D']}
            mod.lock(ReadOnlyMembers(),a.destination)
            print('reserve_lock_json_sha',digest((a.destination/'lock.json').read_bytes()))
        else:
            allowed={'data/mean/A8-0.csv'}|{f'data/replicates/A8-0_r{i}.csv' for i in [1,2,3]}
            mod.score(ReadOnlyMembers(),a.destination,a.pin)
if __name__=='__main__':
    main()
