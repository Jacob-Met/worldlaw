"""Load only authorized individual MeshRIR v1.2 members and preserve their three-dimensional identities."""
import hashlib
import io
import itertools
from pathlib import Path
import re
import zipfile
import numpy as np

BINS=np.array([256,512,1024,1536,2048,2560,3072])
HZ=BINS*(48000/32768)
assert np.array_equal(HZ,np.array([375,750,1500,2250,3000,3750,4500]))
OFFSETS=list(itertools.product(range(-1,2),repeat=3))
DONOR_OFFSETS=[q for q in OFFSETS if q!=(0,0,0)]


class Geometry:
    def __init__(self,archive):
        with open(archive,"rb") as stream:
            md5=hashlib.md5()
            while block:=stream.read(2**20):
                md5.update(block)
        if md5.hexdigest()!="2cb598eb44bb9905560c545db7af3432":
            raise ValueError("Unexpected MeshRIR v1.2 archive")
        self.z=zipfile.ZipFile(archive)
        self.members={Path(v.filename).name:v for v in self.z.infolist()
                      if not v.is_dir() and "__MACOSX" not in v.filename.split("/")}
        self.ir={}
        for name,info in self.members.items():
            match=re.fullmatch(r"ir_(?:.*_)?(\d+)\.npy",name)
            if match:
                self.ir[int(match.group(1))]=info
        assert len(self.ir)==3969
        self.position=self.array("pos_mic.npy")
        self.source=self.array("pos_src.npy").reshape(3)
        axis=[np.unique(np.round(self.position[:,i],8)) for i in range(3)]
        assert [len(a) for a in axis]==[21,21,9]
        assert all(np.allclose(np.diff(a),.05,rtol=0,atol=1e-7) for a in axis)
        lookup={tuple(np.searchsorted(axis[i],round(v[i],8)) for i in range(3)):idx
                for idx,v in enumerate(self.position)}
        assert len(lookup)==3969
        self.cubes=[]
        for center in itertools.product(range(1,21,3),range(1,21,3),range(1,9,3)):
            ids=[lookup[tuple(a+b for a,b in zip(center,o))] for o in DONOR_OFFSETS]
            self.cubes.append((center,lookup[center],ids))
        assert len({m for _,mid,ids in self.cubes for m in [mid,*ids]})==3969

    def array(self,name):
        return np.load(io.BytesIO(self.z.read(self.members[name])),allow_pickle=False)

    def response(self,member_id):
        a=np.load(io.BytesIO(self.z.read(self.ir[member_id])),allow_pickle=False)
        assert a.shape==(1,32768) and np.isrealobj(a) and np.all(np.isfinite(a))
        return np.fft.rfft(a[0])[BINS]
