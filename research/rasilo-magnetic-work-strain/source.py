"""The measured MAT is authenticated before projecting its allowed columns."""
import hashlib
from pathlib import Path
import struct
import zlib
import numpy as np

SHA='c52d7ef2b01653b94fbbbffd77167886dd467480224f487c05033ba701f60fd5'
STRESS=np.array([-35,-30,-20,-15,-10,-5,0,5,10,15,40,50,60,70,80,90,100])
ANCHORS=np.array([0,6,9,14])
HELD=np.array([i for i in range(17) if i not in ANCHORS])

def tag(s,p):
    t,n=struct.unpack_from('<II',s,p)
    if t>>16:
        return t&65535,s[p+4:p+4+(t>>16)],p+8
    return t,s[p+8:p+8+n],p+8+(n if t==15 else (n+7)//8*8)

def read(path,mode):
    if mode not in ('forecast','score'):
        raise ValueError('unknown projection')
    raw=Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=SHA:
        raise ValueError('measured source hash mismatch')
    out={}; pos=128
    while pos<len(raw):
        t,v,pos=tag(raw,pos)
        if t==15:
            t,v,_=tag(zlib.decompress(v),0)
        assert t==14
        _,_,k=tag(v,0);_,dim,k=tag(v,k);_,name,k=tag(v,k)
        name=name.decode();typ,body,k=tag(v,k)
        dims=struct.unpack('<'+'i'*(len(dim)//4),dim)
        if name in ('Bx','sigxx'):
            dtype='<i4' if name=='sigxx' else '<f8'
            out[name]=np.frombuffer(body,dtype).astype(float)
        elif name=='Hx' and mode=='forecast':
            assert typ==9 and dims==(100,17)
            out[name]=np.frombuffer(body,'<f8').reshape(dims,order='F').copy()
        elif name=='lamxx':
            assert typ==9 and dims==(100,17)
            columns=ANCHORS if mode=='forecast' else HELD
            out[name]=np.column_stack([np.frombuffer(body[800*j:800*(j+1)],'<f8') for j in columns])
    assert np.array_equal(out['sigxx']/1e6,STRESS)
    assert out['Bx'].shape==(100,) and np.all(np.diff(out['Bx'])>0)
    for values in out.values():
        if not np.isfinite(values).all():
            raise ValueError('nonfinite data in the permitted projection')
    return out

