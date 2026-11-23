"""Exact controls for the population bound and the distinct-block polynomial receiver."""
from fractions import Fraction as F
from itertools import product,permutations
from math import comb,prod
import numpy as np
from cumulant_screen import LOW,HIGH,distinct_statistics
def population(lam):
    s=lambda n:sum(x**n for x in lam)
    k2,k3,k4=2*s(2),8*s(3),48*s(4)
    return k2*k4-F(3,2)*k3**2,12*k2**2-k4
def main():
    for l in product(range(-3,4),repeat=3):
        lo,hi=population(list(map(F,l)));assert lo>=0 and hi>=0
    assert population([F(1)])[0]==population([F(1)])[1]==0
    assert population([F(1),F(2),F(-3)])[0]>0
    a,b=[F(1),F(2),F(3)],[F(9,7),F(22,7),F(11,7)]
    assert sum(a)==sum(b) and sum(x*x for x in a)==sum(x*x for x in b)
    assert 8*sum(x**3 for x in a)==288 and 8*sum(x**3 for x in b)==F(101664,343)
    # For one noncentral chi-square degree, lower numerator is -96*z^2 at noncentrality z.
    z=F(2);k2=2*(1+2*z);k3=8*(1+3*z);k4=48*(1+4*z)
    assert k2*k4-F(3,2)*k3**2==-96*z*z
    # Positive random scale 1 or 2 multiplying chi-square(10)/10; centered quadratic per component.
    n=10;r=[F(1)]+[F(1+2**j,2)*prod(F(n+2*k,n) for k in range(j)) for j in range(1,5)]
    central=[sum(comb(j,k)*(-r[1])**(j-k)*r[k] for k in range(j+1)) for j in range(5)]
    v,t,u=central[2:];assert (u-3*v*v)/v**2-F(3,2)*t*t/v**3==-F(664,1875)
    for K in [4,5,8]:
        B=[[F((i+2)*(j+3)+(i*j)%4,5) for j in range(1,5)] for i in range(K)]
        def literal(terms):
            s=F()
            for c,js in terms:
                tup=list(permutations(range(K),len(js)))
                s+=F(c)*sum(prod(B[i][j-1] for i,j in zip(ix,js)) for ix in tup)/len(tup)
            return s
        expected=np.array([float(literal(x)) for x in [LOW,HIGH]])
        assert np.max(np.abs(expected-distinct_statistics(np.array(B,dtype=float))))<1e-9
    print('343 signed spectra; rank-one equality, unequal same-mean/variance tails, noncentral and random-scale counterexamples; 3 direct distinct-block enumerations')
if __name__=='__main__':main()
