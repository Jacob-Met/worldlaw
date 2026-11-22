"""Source-only injection and noise qualification using exactly training phantom 1 and water."""
import hashlib
import io
import itertools
import json
import urllib.request
from collections import defaultdict

import numpy as np
from scipy.io import loadmat, whosmat

ROOT = "https://raw.githubusercontent.com/alexdenker/ktc2023_postprocessing/5f0b13f807d3482e964f236ada6e86b5c66477f5/ChallengeData/level_1/"


def read(name, size, sha, variables):
    with urllib.request.urlopen(ROOT+name, timeout=40) as f:
        b=f.read(size+1)
    assert len(b)==size and hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()==sha
    schema=whosmat(io.BytesIO(b))
    print(json.dumps({"name":name,"size":size,"sha256":hashlib.sha256(b).hexdigest(),"fields":schema}),flush=True)
    return loadmat(io.BytesIO(b),variable_names=variables)


def describe(j, volt, comparison=None):
    assert j.shape==(32,76) and volt.shape==(31,76)
    assert np.isfinite(j).all() and np.isfinite(volt).all()
    assert np.all((j!=0).sum(0)==2) and np.allclose(j.sum(0),0,rtol=0,atol=1e-13)
    groups=defaultdict(list)
    for i,col in enumerate(j.T):
        endpoints=tuple(np.flatnonzero(col))
        groups[endpoints].append(i)
    repeat_diffs=[]
    for pair,ids in groups.items():
        for i,k in itertools.combinations(ids,2):
            a=j[pair[0],k]/j[pair[0],i]
            delta=volt[:,k]-a*volt[:,i]
            idx=int(np.argmax(np.abs(delta)))
            repeat_diffs.append(dict(pair=[int(x+1) for x in pair], columns=[i,k], repeated_drive_gain=float(a),rmse_V=float(np.mean(np.abs(delta)**2)**.5),identical_raw=bool(np.array_equal(volt[:,k],volt[:,i])),max_abs_V=float(np.abs(delta[idx])),worst_edge=idx+1,actual_V=float(volt[idx,k]),predicted_V=float(a*volt[idx,i])))
    spread=[r["rmse_V"] for r in repeat_diffs]
    arr=volt if comparison is None else volt-comparison
    print(json.dumps(dict(observations=volt.size,observed_signed_range_V=[float(volt.min()),float(volt.max())],dtype=str(volt.dtype),abs_current_mA_minmax=[float(np.min(np.abs(j[j!=0]))),float(np.max(np.abs(j)))],raw_signs=[int(np.sum(volt<0)),int(np.sum(volt>0))],unique_unoriented_drives=len(groups),group_multiplicities={str(i):sum(len(g)==i for g in groups.values()) for i in sorted(set(map(len,groups.values())))},repeated_pairs=len(repeat_diffs),identical_raw_vectors=sum(r['identical_raw'] for r in repeat_diffs),repeat_rmse_V_min_median_max=[float(x) for x in np.percentile(spread,[0,50,100])],worst_repeat=max(repeat_diffs,key=lambda r:r['rmse_V']),signal_rms=float(np.mean(arr**2)**.5),groups={str(k+1):[i+1 for i in v] for k,v in enumerate(groups.values()) if len(v)>1})),flush=True)


def main():
    ref=read("ref.mat",19121,"712400865cb405d88730144db2f4774a0dcaac0c",["Injref","Mpat","Uelref"])
    data=read("data1.mat",40584,"1448d1f56ce290b51d9deea6bfc1af8506aeda6b",["Inj","Mpat","Uel"])
    j0=ref["Injref"];v0=ref["Uelref"].reshape(76,31).T
    j=data.get("Inj",j0); y=data["Uel"].reshape(76,31).T
    print(json.dumps(dict(phantom_current_present="Inj" in data,current_diff_max_mA=float(np.max(np.abs(j-j0))),mask_or_eval_files_read=0)),flush=True)
    describe(j0,v0);describe(j,y,v0)


if __name__=="__main__":
    main()
