"""Exact survey-distance equivalences and the response of the archived hybrid's radial kernel."""
import collections
import csv
import hashlib
import io
import itertools
import json
import pathlib
import sys
from fractions import Fraction
import numpy as np

def study(geometry,params,gfunctions):
    rows=list(csv.DictReader(io.StringIO(geometry)))
    assert [int(x['BHE ID']) for x in rows]==list(range(1,41))
    xy={int(x['BHE ID']):tuple(Fraction(x[n]) for n in ('X','Y')) for x in rows}
    def dist2(i,j):return sum((a-b)**2 for a,b in zip(xy[i],xy[j]))
    hidden=(13,26,29,33,35); groups={}
    for src in hidden:
        ds=collections.defaultdict(list)
        for dest in xy:
            if dest!=src:ds[dist2(src,dest)].append(dest)
        groups[src]=[v for v in ds.values() if len(v)>1]
    assert groups[13]==groups[35]==[]
    assert groups[26]==groups[33]==[[24,25],[35,36]]
    assert groups[29]==[[26,30]]
    assert dist2(24,26)==dist2(25,26)==Fraction('80.6229')
    assert dist2(24,33)==dist2(25,33)==Fraction('572.4898')
    assert dist2(24,29)==Fraction('323.7565') and dist2(25,29)==Fraction('82.2649')
    days=[30,90,180,365,730,1460,2190]
    # Physical (binary) distance follows archived g_Matrix, independent of Fraction equivalence.
    def calc(dst,src):
        x,y=map(float,xy[dst]);u,v=map(float,xy[src]);r=((x-u)**2+(y-v)**2)**.5
        args=(r,0,params['diamB']/2,params['length']/2,params['length'],params['lm'],params['Cm'])
        return [float(gfunctions.g_FullScale(*args,86400.*t)) for t in days]
    result={}
    for src in hidden:
        s1,s2=calc(24,src),calc(25,src);diff=[a-b for a,b in zip(s1,s2)]
        result[str(src)]={'distance_squared_m2':[str(dist2(24,src)),str(dist2(25,src))],'well24':s1,'well25':s2,'difference':diff}
    for i in ('26','33'):assert max(map(abs,result[i]['difference']))<1e-12
    assert abs(result['29']['difference'][3])>.001
    return {'equal_source_distance_classes':groups,'receiver_pair':[24,25],'days':days,'full_scale_unit_line_load_step_kelvin_per_W_per_m':result}
