"""Evaluate the source-released filters on their matched center/donor geometry."""
import hashlib
import importlib.util
import numpy as np
from pathlib import Path
import urllib.request

AUTHOR_URL = "https://raw.githubusercontent.com/sh01k/MeshRIR/ff6a145e3b2631e46e8cd4e47156ad33bff3acb8/example/sf_func.py"
AUTHOR_SHA = "b245382e3d0db6db23a72b7663feb09a8ca402dfe1b82ebde48b71786543a54a"


def load_checked(directory):
    p=Path(directory)/"meshrir_author_sf_func.py"
    source=urllib.request.urlopen(AUTHOR_URL,timeout=40).read()
    if hashlib.sha256(source).hexdigest()!=AUTHOR_SHA:
        raise ValueError("Author sf_func.py digest")
    p.write_bytes(source)
    spec=importlib.util.spec_from_file_location("meshrir_sf",p)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def author_weights(module, frequency, mic, center, source, direction):
    # Positive bin 1 of an untruncated 4-tap filter is precisely the author's
    # requested frequency response. The second bin is a dummy Nyquist value.
    k=2*np.pi*frequency/347.3
    bins=np.full(2,k)
    if direction:
        ray=source-center
        polar=np.arctan2(np.hypot(ray[0],ray[1]),ray[2])
        azimuth=np.arctan2(ray[1],ray[0])
        h=module.kiFilterGenDir(bins,mic,center[None,:],[polar,azimuth],2.0,4,1)
    else:
        h=module.kiFilterGen(bins,mic,center[None,:],4,1)
    return 1j*np.fft.fft(h[:,0,:],axis=0)[1]
