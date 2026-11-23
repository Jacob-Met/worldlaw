"""Independent continuum audit using rational stereographic direction samples with Lipschitz remainder."""
from fractions import Fraction as F
from math import factorial
import json
N=160
B=1024
S=10**10
def ceil(x):return -((-x.numerator)//x.denominator)
def floor(x):return x.numerator//x.denominator
def cosine(m,u):
    # Midband alpha^2=37/5. Evaluate cosine by an even Taylor enclosure.
    t=F(37,5)*(F(m*u,B))**2
    ans=F(1);term=F(1)
    for j in range(1,18):
        term*= -t/F((2*j)*(2*j-1));ans+=term
    radius=t**18/factorial(36)
    return (floor((ans-radius)*S),ceil((ans+radius)*S))
def prod(p,q):
    vals=[a*b for a in p for b in q]
    return (min(vals)//S,-((-max(vals))//S))
def nearest(num,den):return min(B,(abs(num)*2*B+den)//(2*den))
c=[cosine(1,i) for i in range(B+1)]
d=[cosine(2,i) for i in range(B+1)]
worst=0;where=None
for i in range(N):
    for j in range(i,N):
        # u,v=(i+1/2,j+1/2)/N; (2u,2v,1-u^2-v^2)/(1+u²+v²).
        den=(2*N)**2+(2*i+1)**2+(2*j+1)**2
        p=[nearest(4*N*(2*i+1),den),nearest(4*N*(2*j+1),den),nearest(2*(2*N)**2-den,den)]
        a,b,z=[c[x] for x in p]
        pair=[prod(a,b),prod(a,z),prod(b,z)];triple=prod(prod(a,b),z)
        nums=[6*S+sum(d[x][t] for x in p)+6*sum(u[t] for u in pair)+3*triple[t] for t in(0,1)]
        if max(map(abs,nums))>worst:worst=max(map(abs,nums));where=(i,j,p)
# The stereographic map has Jacobian operator norm 2/(1+u²+v²)<=2.
# For the nearest cell center, the direction distance is <=sqrt(2)/N.
# Component rounding adds <=sqrt(3)/(2B). All kernel gradients w.r.t alpha*d
# have total norm <= (1+3 sqrt(2)+sqrt(3)/2) < 613/100.
assert F(142,100)**2>2 and F(174,100)**2>3
assert 1+3*F(142,100)+F(174,200)<=F(613,100)
assert F(274,100)**2>F(187,25) and F(27,10)**2<F(183,25)
delta_alpha=F(2,25)/(2*F(27,10))
angular=F(274,100)*(F(142,100)/N+F(174,100)/(2*B))
total=F(worst,6*S)+F(613,100)*(angular+delta_alpha)+F(1,25)
assert total<F(9,10)
print(json.dumps(dict(cells=N*N,unique_symmetry_cells=N*(N+1)//2,component_grid=B,
                     midband_sample= str(F(worst,6*S)),angular_and_round=str(angular),alpha_shift=str(delta_alpha),
                     upper=str(total),upper_float=float(total),worst_sample=where,
                     source_statistic="no measured files or responses accessed")))
