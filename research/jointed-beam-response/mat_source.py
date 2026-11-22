"""Project only authorized response-control fields from the nested MATLAB source."""
import hashlib
import math
import struct
import zlib

import numpy as np

def tag(data, pos):
    word = struct.unpack_from("<I", data, pos)[0]
    if word >> 16:
        kind, n = word & 65535, word >> 16
        assert 0 < n <= 4
        return kind, data[pos+4:pos+4+n], pos+8
    n = struct.unpack_from("<I", data, pos+4)[0]
    end = pos+8+n
    assert end <= len(data)
    # Top-level compressed elements are concatenated without 8-byte padding.
    return word, data[pos+8:end], end if word==15 else pos+8+((n+7)//8)*8


SOURCE_SHA256 = "e4bfe248b921edbd23153c24a37c3a9e1556fb1bf59fe6d9e63ae8e2177f1100"


def header(data):
    kind, flags, p = tag(data,0)
    assert kind==6
    cls=struct.unpack_from("<I",flags)[0]&255
    kind,shape,p=tag(data,p)
    assert kind==5
    dims=struct.unpack("<"+"i"*(len(shape)//4),shape)
    _,raw,p=tag(data,p)
    return cls,dims,bytes(raw).decode(),p


def structs(data):
    """Expose child byte slices by name without decoding arrays."""
    cls,shape,_,p=header(data)
    assert cls==2
    _,raw,p=tag(data,p)
    width=struct.unpack_from("<i",raw)[0]
    _,fields,p=tag(data,p)
    names=[bytes(fields[i:i+width]).split(bytes([0]))[0].decode() for i in range(0,len(fields),width)]
    rows=[]
    for _ in range(math.prod(shape)):
        row={}
        for name in names:
            kind,child,p=tag(data,p)
            assert kind==14
            row[name]=child
        rows.append(row)
    assert p==len(data)
    return rows


def vector(data):
    cls,shape,_,p=header(data)
    assert cls==6
    kind,raw,end=tag(data,p)
    assert kind==9 and end==len(data) and min(shape)==1
    return np.frombuffer(raw,dtype="<f8").copy()


def project(raw,read_outcomes=False):
    if hashlib.sha256(raw).hexdigest()!=SOURCE_SHA256:
        raise ValueError("Organizer source digest changed")
    assert raw[:8]==b"MATLAB 5" and raw[126:128]==b"IM"
    kind,top,end=tag(memoryview(raw),128)
    assert end==len(raw)
    if kind==15:
        kind,top,_=tag(memoryview(zlib.decompress(top)),0)
    assert kind==14 and header(top)[2]=="FRdata"
    root,=structs(top)
    assert set(root)=={"ForceControl","ResponseControl"}
    # ForceControl bytes are never traversed numerically in either mode.
    rows=structs(root["ResponseControl"])
    assert len(rows)==8
    allowed=("force","phase") if read_outcomes else ("frequency","amplitude")
    result=[]
    for r in rows:
        assert set(r)=={"frequency","force","amplitude","phase","units"}
        result.append({k:vector(r[k]) for k in allowed})
        assert len({len(v) for v in result[-1].values()})==1
    return result
