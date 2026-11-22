"""Read the Figshare release by role. Evaluation kinematics are separately decoded."""
import hashlib
import io
import json
import tarfile
import urllib.request as net
from pathlib import PurePosixPath
import numpy as np
from scipy.io import loadmat

ARCHIVE_SHA='ed27649e51a4132fc24a799bef2d3e0cec6a5b15980b17e19fb392a126da0a51'
TRIALS=(184,185,186,190,191,192,248,249,250,251,252,253,255,256,257)

def original_measurements():
    with net.urlopen('https://api.figshare.com/v2/articles/659465/versions/4',timeout=60) as f:
        metadata=json.load(f)
    item=next(x for x in metadata['files'] if x['id']==1017793)
    with net.urlopen(item.get('downloadUrl') or item['download_url'],timeout=100) as f:
        archive=f.read()
    assert len(archive)==29445451
    assert hashlib.sha256(archive).hexdigest()==ARCHIVE_SHA
    assert hashlib.md5(archive).hexdigest()==item['computed_md5']
    return archive

def named_members(archive):
    with tarfile.open(fileobj=io.BytesIO(archive),mode='r|gz') as z:
        seen=set()
        for member in z:
            if not member.isfile():continue
            path=PurePosixPath(member.name)
            run=int(path.stem)
            assert path.as_posix()==f'data/measurements/{run:05d}.mat' and run in TRIALS and run not in seen
            seen.add(run)
            yield run,z.extractfile(member).read()
        assert seen==set(TRIALS)

def read_inputs(blob,expected_hash):
    assert hashlib.sha256(blob).hexdigest()==expected_hash
    names=['RunID','PullForce','NISampleRate','Speed']
    values=loadmat(io.BytesIO(blob),variable_names=names,squeeze_me=True)
    assert set(values)-{'__header__','__globals__','__version__'}==set(names)
    run=int(values['RunID']);u=np.asarray(values['PullForce'],dtype=float)
    assert u.ndim==1 and np.all(np.isfinite(u))
    return run,u*(-1 if run==184 else 1),float(values['NISampleRate']),float(values['Speed'])

def read_angles(blob,expected_hash):
    assert hashlib.sha256(blob).hexdigest()==expected_hash
    names=['RollAngle','SteerAngle']
    v=loadmat(io.BytesIO(blob),variable_names=names,squeeze_me=True)
    assert set(v)-{'__header__','__globals__','__version__'}==set(names)
    y=np.column_stack([v[n] for n in names]);assert np.all(np.isfinite(y))
    return y

def crop_from_force(u):
    idx=np.flatnonzero(abs(u)>50)
    if not len(idx):raise ValueError('author prefilter has no >50 N event')
    i,j=idx[0]+1,idx[-1]+1
    lo=i+100 if i-1024<=1 else 1
    hi=j-100 if j+1024>=len(u) else len(u)
    if hi-lo+1<1025:raise ValueError('author prefilter scoring window is too short')
    return slice(int(lo)-1,int(hi))

def input_detrend(u):
    return u-np.linspace(np.mean(u[:1024]),np.mean(u[-1025:]),len(u))
