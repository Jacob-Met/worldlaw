"""Build causal original-rate reservoir features and stable training-only linear readouts."""
import hashlib
import itertools
import json
from pathlib import Path
import sys
import zipfile
import numpy as np
from oger_reference import node,qualify


def qr_update(old, states, target):
    block=np.column_stack((np.ones(len(states)),states,target))
    if old is not None:
        block=np.vstack((old,block))
    return np.linalg.qr(block,mode='r')


def coefficients(r, n):
    return np.linalg.lstsq(r[:,:-1],r[:,-1],rcond=n*np.finfo(float).eps)[0]


def training(root, gas):
    src={'CO':'ethylene_CO.txt','methane':'ethylene_methane.txt'}[gas]
    n=json.loads((root/'chronology-source.json').read_text())[src]['train_rows']
    dev_start=(n*7)//10
    weights_sha=qualify(root)
    model=node(root);rfit=rfull=None
    previous_second=-1
    picked=[];ids=[]
    with zipfile.ZipFile(root/'uci322-original.zip') as z,z.open(src) as stream:
        assert b'Ethylene conc (ppm)' in stream.readline()
        lo=0
        while lo<n:
            count=min(20000,(dev_start if lo<dev_start else n)-lo)
            raw=np.loadtxt(itertools.islice(stream,count),usecols=(0,2,*range(3,19)),ndmin=2)
            assert raw.shape==(count,18) and np.isfinite(raw).all()
            h=model._execute(raw[:,2:])
            sec=np.floor(raw[:,0]).astype(np.int64);mask=np.flatnonzero(np.diff(np.r_[previous_second,sec])>0);previous_second=sec[-1]
            picked.append(h[mask]);ids.append(lo+mask)
            rfull=qr_update(rfull,h,raw[:,1])
            if lo+count==dev_start:rfit=rfull.copy()
            lo+=count
    selected=np.concatenate(ids)
    out=root/f'oger-training-{gas}.npz'
    with out.open('xb') as fp:
        np.savez_compressed(fp,ids=selected,state=np.concatenate(picked),
            fit_inner=coefficients(rfit,dev_start),fit_full=coefficients(rfull,n),
            n=np.array(n),dev_start=np.array(dev_start),weight_sha=np.array(weights_sha))
    print('TRAINED_OGER',gas,n,dev_start,len(selected),hashlib.sha256(out.read_bytes()).hexdigest(),flush=True)


if __name__=='__main__':
    training(Path(sys.argv[1]),sys.argv[2])
