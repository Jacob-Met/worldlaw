"""Compile the unchanged tagged C++ VQF with a minimal in-memory array wrapper."""
import ctypes
import hashlib
import shutil
import subprocess
import urllib.request
from pathlib import Path

import numpy as np

PIN="86ba56bdd3158b9b05f9f9fe5596866ba326438c"
SOURCE={"vqf.hpp":"9486604463fc561254e3ae8d19ddabb41fa6f0be","vqf.cpp":"4be221af5d50284f5246ccaab02165f4242baac7"}
WRAPPER=r"""
#include "vqf.hpp"
#include <type_traits>

static_assert(std::is_same<vqf_real_t,double>::value,"required native float64");
extern "C" int run_vqf(int n,double dt,const double* g,const double* a,const double* m,
    int end_mag,double* q,unsigned char* bad) {
    if(n<1 || dt<=0 || end_mag<0 || end_mag>n) return 1;
    VQF filter(dt);
    for(int i=0;i<n;i++){
        if(i<end_mag) filter.update(g+3*i,a+3*i,m+3*i);
        else filter.update(g+3*i,a+3*i);
        filter.getQuat9D(q+4*i);
        bad[i]=filter.getMagDistDetected();
    }
    return 0;
}
"""


def load_native(directory):
    path=Path(directory)
    for name,blob in SOURCE.items():
        with urllib.request.urlopen(f"https://raw.githubusercontent.com/dlaidig/vqf/{PIN}/vqf/cpp/{name}",timeout=30) as f:data=f.read()
        assert hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()==blob
        (path/name).write_bytes(data)
    (path/'array_wrapper.cpp').write_text(WRAPPER)
    so=path/'vqf_fixed.so'
    subprocess.run([shutil.which("g++"),"-std=c++17","-O2","-fPIC","-shared",
                  str(path/'vqf.cpp'),str(path/'array_wrapper.cpp'),"-o",str(so)],check=True)
    lib=ctypes.CDLL(str(so))
    ptr=np.ctypeslib.ndpointer(dtype=np.float64,ndim=2,flags='C_CONTIGUOUS')
    pbad=np.ctypeslib.ndpointer(dtype=np.uint8,ndim=1,flags='C_CONTIGUOUS')
    lib.run_vqf.argtypes=[ctypes.c_int,ctypes.c_double,ptr,ptr,ptr,ctypes.c_int,ptr,pbad]
    lib.run_vqf.restype=ctypes.c_int
    return lib


def estimate(lib,dt,gyro,acc,mag,magnetic_samples=None):
    arrays=[np.ascontiguousarray(x,dtype=np.float64) for x in (gyro,acc,mag)]
    n=len(gyro);assert all(x.shape==(n,3) and np.isfinite(x).all() for x in arrays)
    out=np.empty((n,4));bad=np.empty(n,dtype=np.uint8)
    end=n if magnetic_samples is None else int(magnetic_samples)
    assert lib.run_vqf(n,dt,*arrays,end,out,bad)==0
    assert np.isfinite(out).all() and abs(np.linalg.norm(out,axis=1)-1.).max()<1e-9
    return out,bad
