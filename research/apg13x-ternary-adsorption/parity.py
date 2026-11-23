"""Exact competitive-Langmuir counterexample with identical complete binary faces."""
from fractions import Fraction as F
from itertools import product

def mixture(parity, partial):
    q=[F(0)]*3
    for bits in product(range(2), repeat=3):
        if sum(bits)%2 != parity:continue
        b=[1+3*j for j in bits]
        total=1+sum(k*p for k,p in zip(b,partial))
        for i in range(3):
            q[i]+=F(1,4)*b[i]*partial[i]/total
    return q

def main():
    for i in range(3):
        dims=[j for j in range(3) if j!=i]
        for parity in [0,1]:
            counts={}
            for v in product(range(2),repeat=3):
                if sum(v)%2==parity:
                    k=tuple(v[j] for j in dims);counts[k]=counts.get(k,0)+1
            assert len(counts)==4 and set(counts.values())=={1}
        p=[F(5,2),F(7,3),F(11,5)];p[i]=0
        assert mixture(0,p)==mixture(1,p)
    even,odd=[mixture(z,[F(1)]*3) for z in range(2)]
    assert even==[F(23,80)]*3 and odd==[F(53,182)]*3
    assert even[0]-odd[0]==F(-27,7280)
    print('Identical two-dimensional affinity marginals on each face, ternary component difference:',even[0]-odd[0])
if __name__=='__main__':main()
