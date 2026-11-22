"""Cyclic coordinate conventions for a sampled full period."""
import hashlib
import numpy as np

def orbit_origin(row, strategy):
    if strategy=='voltage':
        priority=np.roll(row,-1)-np.roll(row,1)
    elif strategy=='field':
        priority=row
    else:
        raise ValueError(strategy)
    ties=np.flatnonzero(priority==priority.max())
    best=int(ties[0])
    # Compare complete cyclic words only for exact ties. If periodic words are
    # identical, either choice produces the same 1024 input values.
    for other in ties[1:]:
        a=np.roll(row,-int(other)); b=np.roll(row,-best)
        diff=np.flatnonzero(a!=b)
        if len(diff) and a[diff[0]]>b[diff[0]]: best=int(other)
    return best

def transforms(rows, material):
    idx=np.arange(rows.shape[1])
    shifts=np.fromiter((1+int(hashlib.sha256(f'MagNet2023-origin-v1|{material}|{i}'.encode()).hexdigest()[:8],16)%1023 for i in range(len(rows))),dtype=np.int64,count=len(rows))
    shifted=np.take_along_axis(rows,(idx[None,:]-shifts[:,None])%len(idx),axis=1)
    out={'original':rows,'rotated':shifted}; records={'r':shifts}
    for role in ['voltage','field']:
        origin=np.array([orbit_origin(row,role) for row in rows],dtype=np.int64)
        second=np.array([orbit_origin(row,role) for row in shifted],dtype=np.int64)
        a=np.take_along_axis(rows,(idx[None,:]+origin[:,None])%len(idx),axis=1)
        b=np.take_along_axis(shifted,(idx[None,:]+second[:,None])%len(idx),axis=1)
        assert a.tobytes()==b.tobytes(),role
        out[role]=a;records[role]=origin
    return out,records
