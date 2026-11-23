"""Read the public file's condition metadata while retaining numeric work vectors as opaque byte strings."""
import hashlib,io,json,pickle,struct,sys,zipfile
from pathlib import Path
SRC='65b4ab2c8e4883d6e23cef127727967c85036427864ec0b7474176b5a5fa5b8b'
class Dtype:
    def __init__(self,kind,*args):self.kind=kind;self.endian='<'
    def __setstate__(self,s):self.endian=s[1]
class Array:
    def __setstate__(self,s):
        version,shape,dtype,fortran,body=s
        assert version==1 and not fortran
        self.shape,self.dtype,self.body=shape,dtype,body
class Scalar:
    def __init__(self,d,b):self.dtype=d;self.body=b
    def read(self):
        codes={'f8':'d','f4':'f','i8':'q','i4':'i'}
        assert self.dtype.kind in codes and self.dtype.endian in ('<','>','=')
        return struct.unpack(self.dtype.endian+codes[self.dtype.kind],self.body)[0]
def reconstruct(subtype,shape,dtype):
    assert subtype is Array and shape==(0,)
    return Array()
class Restricted(pickle.Unpickler):
    def find_class(self,module,name):
        return {('numpy','dtype'):Dtype,('numpy','ndarray'):Array,('numpy.core.multiarray','_reconstruct'):reconstruct,('numpy.core.multiarray','scalar'):Scalar}[(module,name)]
def scalar(v):return v.read() if isinstance(v,Scalar) else v
def load_archive(filename):
    p=Path(filename);assert hashlib.sha256(p.read_bytes()).hexdigest()==SRC
    with zipfile.ZipFile(p) as z:
        assert z.namelist()==['results.npy']
        with z.open('results.npy') as f:
            assert f.read(6)==b'\x93NUMPY';v=f.read(2);n=int.from_bytes(f.read(2 if v[0]==1 else 4),'little');header=f.read(n).decode()
            assert "'descr': '|O'" in header and "'shape': ()" in header
            result=Restricted(f).load()
    assert result.shape==() and len(result.body)==1
    return result.body[0]
def roster(filename):
    payload=load_archive(filename);assert set(payload)=={'L','O'}
    rows=[]
    for sig,by_amp in payload.items():
        for amp,by_time in by_amp.items():
            for time,record in by_time.items():
                assert set(record)=={'W','lambda_i','lambda_f','lambda_i_err','lambda_f_err','tau_p'},set(record)
                w=record['W'];assert isinstance(w,Array) and w.dtype.kind in ('f8','f4') and len(w.shape)==1
                assert len(w.body)==w.shape[0]*int(w.dtype.kind[1:])
                vals={k:scalar(v) for k,v in record.items() if k!='W'}
                rows.append(dict(protocol=sig,amplitude=scalar(amp),duration=scalar(time),count=w.shape[0],dtype=w.dtype.kind,work_bytes_sha256=hashlib.sha256(w.body).hexdigest(),**vals))
    return rows
if __name__=='__main__':
    rows=roster(sys.argv[1]);print('METADATA_ONLY',json.dumps(rows,sort_keys=True));print('WORK_VALUES_DECODED',0)
