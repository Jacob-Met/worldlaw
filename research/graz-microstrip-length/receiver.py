"""Read only the named paired incident/reflected receiver sweeps."""
import io
from pathlib import PurePosixPath
import re
import zipfile
import numpy as np
import skrf as rf

SOURCE_LENGTHS=(0,1,3,4,6,10)
HELD_LENGTHS=(2,13)
EXPECTED_F=np.linspace(1e9,150e9,299)


def line_name(half_mm):
    return f'line_50__{half_mm//2}_{5*(half_mm%2)}mm'


def read_standard(outer, name, allowed, reference_frequency=None):
    if name not in allowed:
        raise ValueError("standard outside receiver rights")
    path=f'Microstrip_measurements/{name}.zip'
    opaque=outer.read(path)
    with zipfile.ZipFile(io.BytesIO(opaque)) as inner:
        nets=rf.read_zipped_touchstones(inner)
    lookup={}
    prefix=re.escape(name)
    for k,value in nets.items():
        label=PurePosixPath(k).name
        match=re.fullmatch(prefix+r'_([AB])_([0-9]+)(?:\.s2p)?',label,flags=re.IGNORECASE)
        if not match:
            raise ValueError(f'unexpected receiver member: {label}')
        key=(match.group(1).upper(),int(match.group(2)))
        if key in lookup:
            raise ValueError("duplicate wave identity")
        if reference_frequency is None:
            reference_frequency = value.f.copy()
            if (len(reference_frequency) != 299 or np.any(np.diff(reference_frequency) <= 0)
                    or abs(reference_frequency[0]-1e9)>1 or abs(reference_frequency[-1]-150e9)>1):
                raise ValueError("source clock outside the reported 299-point, 1-150 GHz support")
        if not np.array_equal(value.f, reference_frequency):
            raise ValueError("sweep frequency clock differs from other received records")
        if value.s.shape != (299,2,2):
            raise ValueError("two-port sweep shape differs")
        lookup[key]=value.s
    if set(lookup)!={(wave,i) for wave in 'AB' for i in range(1,26)}:
        raise ValueError("incomplete 25-sweep paired receiver roster")
    a=np.stack([lookup['A',i] for i in range(1,26)])
    b=np.stack([lookup['B',i] for i in range(1,26)])
    cond=np.linalg.cond(a)
    if not np.all(np.isfinite(cond)) or np.max(cond)>=1e10:
        raise ValueError("incident-wave inversion failed its numerical gate")
    s=b@np.linalg.inv(a)
    if not np.all(np.isfinite(s)):
        raise ValueError("nonfinite measured scattering parameters")
    return s,float(cond.max()),reference_frequency
