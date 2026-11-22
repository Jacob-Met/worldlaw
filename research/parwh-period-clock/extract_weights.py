"""Resolve only audited numeric globals in the organizer checkpoint's metadata."""
import hashlib,io,pickle,sys,zipfile
from pathlib import Path
import numpy as np
root=Path(sys.argv[1]);archive=root/'released-GRU_ParWH.npz'
b=archive.read_bytes();assert hashlib.sha256(b).hexdigest()=='ccd1d968c31c358d7af2b9a0eafd43db7bb759d33ed2efa20377ad079fe9f04c'
class InertKey:pass
class InertImpl(tuple):
    def __new__(cls,*args):return super().__new__(cls,args)
def host_array(fun,args,state,aval):
    assert fun is np.core.multiarray._reconstruct
    x=fun(*args);x.__setstate__(state);return x
class NumericOnly(pickle.Unpickler):
    def find_class(self,mod,name):
        items={('numpy','ndarray'):np.ndarray,('numpy','dtype'):np.dtype,
            ('jax._src.array','_reconstruct_array'):host_array,
            ('jax._src.prng','PRNGKeyArray'):InertKey,('jax._src.prng','PRNGImpl'):InertImpl}
        for v in ('numpy._core.multiarray','numpy.core.multiarray'):
            items[v,'_reconstruct']=np.core.multiarray._reconstruct;items[v,'scalar']=np.core.multiarray.scalar
        if mod=='jax._src.prng' and name in ('threefry_seed','threefry_split','threefry_random_bits','threefry_fold_in'):return name
        if (mod,name) not in items:raise ValueError(('unapproved metadata symbol',mod,name))
        return items[mod,name]
with zipfile.ZipFile(io.BytesIO(b)) as z:
    raw=io.BytesIO(z.read('meta.npy'));v=np.lib.format.read_magic(raw);np.lib.format._read_array_header(raw,v)
    obj=NumericOnly(raw).load().item()
names=[k for k in obj if k.startswith('params.')]
tensors={k:np.asarray(obj[k]) for k in names};assert len(tensors)==12 and all(x.dtype==np.float32 and x.size<=256 and np.isfinite(x).all() for x in tensors.values())
out=root/'gru-numeric-weights.npz'
with out.open('xb') as f:np.savez(f,**tensors,nh=int(obj['nh']),nx=int(obj['nx']))
print('CERT',int(obj['nh']),int(obj['nx']),hashlib.sha256(out.read_bytes()).hexdigest(),[(k,v.shape) for k,v in tensors.items()])
