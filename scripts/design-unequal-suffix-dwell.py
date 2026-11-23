"""Construct an exact common-history packet for the twelve-pulse unequal-dwell suffix class."""
from fractions import Fraction as F
from itertools import permutations
from pathlib import Path
import json
import sys

import numpy as np
from scipy.optimize import linprog

H = 12
EPS = F(1, 10)
LEFT = ('y0','x0','z0')
RIGHT = ('z1','x1','y1')


def leaves(length):
    for triple in (LEFT, RIGHT):
        for order in permutations(triple):
            for a in range(1, length-1):
                for b in range(1, length-a):
                    yield tuple(zip(order, (a,b,length-a-b)))


def construct(catalog):
    if F(catalog['noiseBound']) != EPS:
        raise ValueError('this twelve-pulse course uses noise 1/10')
    names = catalog['commands']
    rates = np.array([law['vertices'] for law in catalog['laws']],dtype=float)
    eq = np.zeros((2,13))
    eq[0,:4],eq[1,4:8] = 1,1
    bounds = [(0,None)]*8 + [(None,None)]*5
    obj = np.zeros(13)
    obj[-1] = 1
    def clean(law,t,acc):
        row = np.zeros(13)
        row[4*law:4*law+4] = acc
        row[8+2*law],row[9+2*law] = 1,t
        return row
    def constraints(m,g,word):
        a,b = [],[]
        def tube(row,radius):
            a.extend((row,-row))
            b.extend((radius,radius))
        acc = g*rates[:,:,names.index('group')].copy()
        t = m+g
        for law in (0,1):
            tube(clean(law,0,0),float(EPS))
            tube(clean(law,m,0),float(EPS))
            group = clean(law,t,acc[law])
            group[-1] = -1
            tube(group,float(EPS))
        for command,n in word:
            t += n
            acc += n*rates[:,:,names.index(command)]
            tube(clean(0,t,acc[0])-clean(1,t,acc[1]),float(2*EPS))
        return a,b
    def lp(problem,direction,fixed=None):
        a,b = problem
        box = bounds if fixed is None else bounds[:-1]+[(float(fixed),float(fixed))]
        ans = linprog(direction*obj,A_ub=a,b_ub=b,A_eq=eq,b_eq=[1,1],bounds=box,method='highs')
        if ans.status not in (0,2):
            raise RuntimeError(ans.message)
        return ans
    def rat(x):
        return F(float(x)).limit_denominator(1000000)
    def key(world):
        # Marginal sums determine the fourth mass in each family.
        return tuple(str(rat(world[i])) for i in (0,1,2,4,5,6,8,9,10,11))
    archive = {}
    prefixes = []
    for m in range(1,H-3):
        for g in range(1,H-m-2):
            words = list(leaves(H-m-g))
            models = [constraints(m,g,w) for w in words]
            s = F(g,2)-EPS
            results = [lp(p,0,s) for p in models]
            if any(not q.success for q in results):
                lo = max(rat(lp(p,1).fun) for p in models)
                hi = min(rat(-lp(p,-1).fun) for p in models)
                if lo > hi:
                    raise ValueError(f'no shared prefix across all choices at {m},{g}: {lo}>{hi}')
                s = (lo+hi)/2
                results = [lp(p,0,s) for p in models]
            indices = []
            for result in results:
                if not result.success:
                    raise ValueError(f'common prefix reconstruction failed at {m},{g}')
                state = key(result.x)
                if state not in archive:
                    archive[state] = len(archive)
                indices.append(archive[state])
            prefixes.append([m,g,str(s),indices])
    return {'schema':'worldlaw.twelve-pulse-dwell-obstruction/v1','catalog':catalog,'horizon':H,'noiseBound':str(EPS),
            'worldPairs':list(archive),'prefixes':prefixes}


if __name__=='__main__':
    source=json.loads(Path(sys.argv[1]).read_text())
    data=construct(source['catalog'])
    Path(sys.argv[2]).write_text(json.dumps(data,separators=(',',':'))+'\n')
