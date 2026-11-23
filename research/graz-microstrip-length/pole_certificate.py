"""Outward dyadic source-disc certificate for every polynomial-denominator evaluation."""
from fractions import Fraction as Q
from math import isqrt
from matrix_paths import paths

PRECISION = 80
DEN = 1 << PRECISION


def cq(z):
    return (Q(float(z.real)),Q(float(z.imag)))


def sub(a,b):
    return (a[0]-b[0],a[1]-b[1])


def add(a,b):
    return (a[0]+b[0],a[1]+b[1])


def mul(a,b):
    return (a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0])


def squared(z):
    return z[0]*z[0]+z[1]*z[1]


def roots(x):
    num=x.numerator*DEN*DEN;den=x.denominator
    lo=isqrt(num//den)
    hi=lo+(lo*lo*den<num)
    return Q(lo,DEN),Q(hi,DEN)


def certify(sweeps,targets,frequency):
    centers={};radii={}
    for l,s in sweeps.items():
        m=s.mean(axis=0)
        for f in range(len(frequency)):
            for o,i in ((0,0),(0,1),(1,0),(1,1)):
                key=l,f,o,i
                center=cq(m[f,o,i]);centers[key]=center
                max_sq=max(squared(sub(cq(w),center)) for w in s[:,f,o,i])
                radii[key]=roots(max_sq)[1]
    worst=None;count=0;triples=[]
    for target in targets:
        for a,b,c in paths(sweeps,target):
            for u,v,w in sorted({(a,b,c),(c,b,a)}):
                local=None
                for f in range(len(frequency)):
                    keys=((v,f,0,1),(v,f,1,0),(v,f,1,1),(u,f,1,1),(w,f,0,0),(v,f,0,0))
                    aa,bb,h,j,k,m=[centers[key] for key in keys]
                    ar,br,hr,jr,kr,mr=[radii[key] for key in keys]
                    cc,dd=sub(h,j),sub(k,m)
                    cr,dr=hr+jr,kr+mr
                    radius=(roots(squared(aa))[1]*br+roots(squared(bb))[1]*ar+ar*br+
                            roots(squared(cc))[1]*dr+roots(squared(dd))[1]*cr+cr*dr)
                    center_lower=roots(squared(add(mul(aa,bb),mul(cc,dd))))[0]
                    if radius>=center_lower:
                        raise ValueError(f'unqualified raw-scattering pole: target={target}, path={(u,v,w)}, f={f}')
                    ratio=radius/center_lower
                    rec=(ratio,f,radius,center_lower)
                    if local is None or rec[0]>local[0]:local=rec
                    count+=1
                entry={'target_half_mm':target,'path_half_mm':[u,v,w],
                       'worst_frequency_index':local[1],'frequency_hz':float(frequency[local[1]]),
                       'radius_upper_exact':str(local[2]),'centre_magnitude_lower_exact':str(local[3]),
                       'ratio_upper':float(local[0])}
                triples.append(entry)
                if worst is None or local[0]>worst[0]:worst=local[0],entry
    if count!=4784:
        raise ValueError(f'incomplete pole roster {count}')
    return {'quantified_denominators':count,'outward_sqrt_fractional_bits':PRECISION,
            'all_path_maxima':triples,'global_worst':worst[1],
            'scope':'componentwise closed complex discs containing every one of the 25 observed stored S values, centred on the stored complex means; no population or launch-error guarantee'}
