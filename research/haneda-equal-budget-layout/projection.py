"""Source roles, disjoint 9x9x9 spatial boxes, and typed original projections."""
import argparse
import hashlib
import itertools
import json
from pathlib import Path
import h5py
import numpy as np

FS = 48000
C = 340
H = 0.04
FREQ = np.array([1840,2760,3670,3680,3690,4600,5520])
PRIMARY = [2,3,4]
DEV = (1,3)
HELD = (2,4)
MD5 = ("4a8c756cadac33326b5bcae02135df95","4389f43bc7b06b9d01c11a8d97c72316",
       "7cec9ca609e48645f0190016a124f22d","a548631f867e2711dd4776a0824f615e")
CENTER = np.array(list(itertools.product((5,14,23,32,41),(7,16,25,34,43),(8,17))),dtype=int)
SHORT = [p for p in itertools.product((-1,0,1),repeat=3) if p!=(0,0,0)]
LONG = [tuple(2*q for q in p) for p in SHORT if sum(q*q for q in p)==1]
OFF = np.array(SHORT+LONG,dtype=int)
CODES = np.array([1,48,2448])
SQUARE = np.sum(OFF*OFF,axis=1)
OLD = np.flatnonzero(SQUARE <= 3)
MOVED = np.flatnonzero(SQUARE >= 2)
assert len(set((CENTER@CODES).tolist())|set(((CENTER[:,None,:]+2*OFF)@CODES).ravel().tolist()))==50*33
assert np.all((7.32<=(2*np.pi*H*FREQ[PRIMARY]/C)**2)&((2*np.pi*H*FREQ[PRIMARY]/C)**2<=7.48))

def project(path, speaker, role, output, lock=None, expected=None):
    if role=="calibration" and speaker not in DEV:raise ValueError("Calibration selection")
    if role in ("donors","targets") and speaker not in HELD:raise ValueError("Held selection")
    if role=="targets":
        if lock is None or expected is None:raise ValueError("Complete forecast file and frozen digest required")
        raw=Path(lock).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError("Forecast digest mismatch")
        bank=json.loads(raw)
        assert bank["centers"]==CENTER.tolist() and bank["frequencies"]==FREQ.tolist()
        assert bank["held"]==list(HELD)
        for source_id in HELD:
            for layout in ("original","relocated","equal_aperture_optimal"):
                group=bank["forecasts"][f"{source_id}/{layout}"]
                for estimator in ("selected","author_directional","full_ridge","directional_residual"):
                    assert np.asarray(group[estimator]).shape==(50,7,2)
    elif lock is not None or expected is not None:
        raise ValueError("Locks belong to held outcome projections")
    digest=hashlib.md5()
    with open(path,"rb") as source:
        while chunk:=source.read(2**20):digest.update(chunk)
    if digest.hexdigest()!=MD5[speaker-1]:raise ValueError("Original content digest")
    with h5py.File(path) as source:
        assert tuple(source["rir"].shape)==(63648,4800)
        assert float(source.attrs["fs"][0])==FS and float(source.attrs["c"][0])==C
        grid=np.asarray(source["grid"]).T.astype(np.float64)
        lattice=np.rint(grid/.02).astype(int)
        assert np.max(abs(grid-.02*lattice))<1e-6 and np.array_equal(lattice@CODES,np.arange(len(grid)))
        meta=dict(speaker=np.array(speaker),centers=CENTER,frequencies=FREQ,
                  source=source.attrs["sp_pos"],origin=source.attrs["mic_array_pos"])
        def coefficient(row):
            signal=source["rir"][int(row),:].astype(np.float64)
            if not np.all(np.isfinite(signal)):raise ValueError("Nonfinite acquired signal")
            return np.fft.rfft(signal)[FREQ//10]
        if role in ("calibration","donors"):
            meta["donors"]=np.array([[coefficient(row) for row in (xyz+2*OFF)@CODES] for xyz in CENTER])
        if role in ("calibration","targets"):
            meta["targets"]=np.array([coefficient(row) for row in CENTER@CODES])
        if lock is not None:meta["forecast_sha256"]=np.array(expected)
    np.savez_compressed(output,**meta)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path)
    parser.add_argument("speaker",type=int,choices=(1,2,3,4))
    parser.add_argument("role",choices=("calibration","donors","targets"))
    parser.add_argument("output",type=Path)
    parser.add_argument("--lock",type=Path)
    parser.add_argument("--expected-sha")
    a=parser.parse_args()
    project(a.archive,a.speaker,a.role,a.output,a.lock,a.expected_sha)
