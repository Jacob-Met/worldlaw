"""Reconstruct exact forecast vectors from source counts and IEEE binary64 coefficients."""
import math, struct
def profile(rows,coeff):
    # Fixed arithmetic path shared by producer and compact forecast decoder.
    a=[math.fsum(c*x for c,x in zip(coeff,v)) for v in zip(*rows)]
    mu=math.fsum(a)/len(a);sd=math.sqrt(math.fsum((x-mu)**2 for x in a)/len(a))
    assert sd>0 and math.isfinite(sd)
    return [(x-mu)/sd for x in a]
def packed(v):return struct.pack('<%dd'%len(v),*v)
