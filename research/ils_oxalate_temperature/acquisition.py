"""Pinned access to the ILS TG data and author-provided processing grid."""
import hashlib
import re
import urllib.request

import numpy as np
import rdata

REV="a46be10f6073c94c103888056bcf2caea0f78b37"
ROOT="https://raw.githubusercontent.com/cran/ILS/"+REV+"/"
TG_BLOB="29d6bea812b9a95589704c61775e2c609eac3734"


def fetch(path):
    with urllib.request.urlopen(ROOT+path,timeout=40) as response:
        return response.read()


def read_array():
    example=fetch("man/ils.fqcs.Rd").decode()
    compact=re.sub(r"\s+","",example)
    assert "seq(from=40,to=850,length.out=1000)" in compact
    assert "ils.fqcdata(TG,p=7,argvals=delta)" in compact and "Mass/" in compact
    raw=fetch("data/TG.RData")
    assert len(raw)==496800 and hashlib.sha1(b"blob 496800\0"+raw).hexdigest()==TG_BLOB
    container=rdata.conversion.convert(rdata.parser.parse_data(raw))
    assert set(container)=={"TG"}
    value=container["TG"]
    assert value.shape==(15,1000,7)
    grid=np.linspace(40.,850.,1000)
    coord={}
    if hasattr(value,"coords"):
        for axis,key in enumerate(value.dims):
            if key not in value.coords:continue
            names=list(map(str,value.coords[key].values))
            coord[str(axis)]={"name":str(key),"first":names[:2],"last":names[-2:]}
            # Labels on the file's physical temperature axis overrule an undocumented
            # numerical assumption. Generic R row/column labels carry no temperature.
            nums=[]
            for name in names:
                try:nums.append(float(name))
                except ValueError:break
            if axis==1 and len(nums)==1000:
                if nums!=list(range(1000)) and nums!=list(range(1,1001)):
                    if np.max(abs(np.array(nums)-grid))>0.005: raise ValueError("stored numerical axis disagrees with published temperature grid: "+str(coord["1"]))
            if axis in (0,2) and all(re.fullmatch(r"[^\d]*\d+",name) for name in names):
                ids=[int(re.search(r"\d+$",name).group()) for name in names]
                if ids!=list(range(1,len(names)+1)) and ids!=list(range(len(names))):raise ValueError("nonsequential specimen/group labels: "+str(coord[str(axis)]))
    return grid,np.asarray(value),dict(git_blob=TG_BLOB,sha256=hashlib.sha256(raw).hexdigest(),
        processing_grid_example_sha256=hashlib.sha256(example.encode()).hexdigest(),coordinate_labels=coord,
        shape=list(value.shape),rdata_version=rdata.__version__)


def training_only():
    g,all_tg,receipt=read_array()
    stop=int(np.searchsorted(g,280.,side="right"))
    reference={group:all_tg[:,:,group-1].copy() for group in [2,3,4,5]}
    early={group:all_tg[:5,:stop,group-1].copy() for group in [1,6,7]}
    del all_tg
    for arr in [*reference.values(),*early.values()]:
        if not np.isfinite(arr).all():raise ValueError("nonfinite permitted inputs")
    return g,reference,early,receipt
