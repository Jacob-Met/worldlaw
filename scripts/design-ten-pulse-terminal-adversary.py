"""Find physical collision witnesses on the two exceptional ten-pulse category words."""
from fractions import Fraction as F
from functools import lru_cache
from itertools import combinations_with_replacement,product
import json
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import linprog

def build(catalog):
    names=catalog['commands']
    vertices=[l['vertices'] for l in catalog['laws']]
    if F(catalog['noiseBound'])!=F(1,10) or any(F(x).denominator!=1 for v in vertices for row in v for x in row):
        raise ValueError('this finite course requires its integral rate catalog and noise 1/10')
    raw=np.array(vertices,dtype=int)
    baseline=tuple(names.index(c) for c in ['ref','group'])
    suffix=tuple(names.index(c) for c in ['x0','y0','z0','x1','y1','z1'])
    mu=(np.array([1,2,1,2])@raw[0]+np.array([2,1,2,1])@raw[1])/12
    box=[(0,None)]*8+[(None,None)]*4
    eq=np.array([[1]*4+[0]*8,[0]*4+[1]*4+[0]*4]);cost=np.zeros(12)
    @lru_cache(None)
    def physics(c):
        counts=np.array(c,dtype=int);t=sum(c);acc=raw@counts
        coeff=np.zeros((2,12))
        for l in range(2):
            coeff[l,4*l:4*l+4]=acc[l];coeff[l,8+2*l]=1;coeff[l,9+2*l]=t
        observed=counts@mu
        return np.array([coeff[0],-coeff[0],coeff[1],-coeff[1]]),np.array([.1+observed,.1-observed]*2),coeff[0]-coeff[1]
    def counts(seq):
        return tuple(seq.count(i) for i in range(8))
    @lru_cache(None)
    def subcounts(c):
        return list(product(*(range(n+1) for n in c)))
    bank={}
    def cover(first,second,last):
        # Each submultiset is the prefix of some order within its command block.
        count1=counts(first)
        hist=set(subcounts(count1))
        for sub in subcounts(counts(second)):
            hist.add(tuple(x+y for x,y in zip(count1,sub)))
        rows=[physics(c) for c in sorted(hist)]
        final=physics(counts(first+second+(last,)))[2]
        mat=np.vstack([q[0] for q in rows]+[final,-final])
        rhs=np.concatenate([q[1] for q in rows]+[[.2,.2]])
        result=linprog(cost,A_ub=mat,b_ub=rhs,A_eq=eq,b_eq=[1,1],bounds=box,method='highs')
        if not result.success:
            raise ValueError(f'no grouped physical witness for {first,second,last}: {result.message}')
        state=tuple(str(F(float(result.x[i])).limit_denominator(1000000))
                    for i in (0,1,2,4,5,6,8,9,10,11))
        if state not in bank:
            bank[state]=len(bank)
        return bank[state]
    roots=[]
    for first,second in ((baseline,suffix),(suffix,baseline)):
        for word1 in combinations_with_replacement(first,5):
            for word2 in combinations_with_replacement(second,4):
                for last in second:
                    roots.append(cover(word1,word2,last))
    return {'schema':'worldlaw.ten-pulse-terminal-adversary/v1','catalog':catalog,
            'worldPairs':list(bank),'roots':roots}


if __name__=='__main__':
    source=json.loads(Path(sys.argv[1]).read_text())
    packet=build(source['catalog'])
    Path(sys.argv[2]).write_text(json.dumps(packet,separators=(',',':'))+'\n')
    print(json.dumps(dict(roots=len(packet['roots']),worldPairs=len(packet['worldPairs']))))
