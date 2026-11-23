"""Exact polynomial checks and a finite-sampling nonuniqueness witness."""
from fractions import Fraction as F
from math import comb


def times(a,b):
    c=[F(0)]*(len(a)+len(b)-1)
    for i,x in enumerate(a):
        for j,y in enumerate(b):c[i+j]+=x*y
    return c


def evaluate(coeff,x):
    return sum(v*x**i for i,v in enumerate(coeff))


def verify():
    # After a shared positive RMS constant is removed, the paper's signs
    # make the second harmonic positive and the fourth harmonic negative.
    for m in range(1,49):
        c1=F(comb(2*m,m-1),4**m)
        c2=-F(comb(2*m,m-2) if m>=2 else 0,4**m)
        assert c2==c1*(F(3,m+2)-1)
    nodes=[F(1,4),F(1,2),F(3,4),F(1)]
    u=[F(0),F(1)]
    for a in nodes:u=times(u,times([-a,F(1)],[-a,F(1)]))
    assert all(evaluate(u,a)==0 for a in nodes)
    # All nonconstant monomial second-harmonic coefficients are nonzero.
    head=[F(0)]+[c*4**m/comb(2*m,m-1) for m,c in enumerate(u) if m]
    y=[F(0)]+[-v*F(comb(2*m,m-2) if m>=2 else 0,4**m)
              for m,v in enumerate(head) if m]
    witness=[]
    for a in nodes:
        from_integral=3*sum(c*a**m/(m+2) for m,c in enumerate(u))
        assert evaluate(y,a)==from_integral>0
        witness.append(str(from_integral))
    return {"degrees_checked":48,"nodes":[str(a) for a in nodes],"second_harmonic_identical":True,
            "fourth_harmonic_difference":witness}


if __name__=="__main__":
    import json
    print(json.dumps(verify(),sort_keys=True))
