"""Uniform rational certificate for relocation of six axial donors on a cubic grid."""
from fractions import Fraction as F
from math import factorial
import json

N=64
S=10**10
alpha_squared=(F(183,25),F(187,25))
w=(F(-1,2),F(-3),F(-1,2))
eta=F(1,100)
def floor(v):return v.numerator//v.denominator
def ceiling(v):return -floor(-v)
def cover(lo,hi):return (floor(lo*S),ceiling(hi*S))
def times(x,y):
    p=[v*u for v in x for u in y]
    return (min(p)//S,-((-max(p))//S))
def cos_sqrt(a,b,m):
    # cos(m sqrt(t)) has derivative magnitude at most m^2/2, including at zero.
    mid=(a+b)/2
    z=m*m*mid
    terms=18
    p=sum((-z)**j/factorial(2*j) for j in range(terms+1))
    # Taylor through degree 2*terms+1 (the last odd term is zero).
    radius=z**(terms+1)/factorial(2*terms+2)+F(m*m,2)*(b-a)/2
    return cover(max(F(-1),p-radius),min(F(1),p+radius))
# u_i=d_i^2, sum u_i=1. These cells cover the continuous closed simplex.
cosine=[]
double=[]
for i in range(N):
    lo=alpha_squared[0]*i/N
    hi=alpha_squared[1]*(i+1)/N
    cosine.append(cos_sqrt(lo,hi,1));double.append(cos_sqrt(lo,hi,2))
max_error=F(0);worst=None;count=0
for i in range(N):
    for j in range(i,N):
        for k in range(max(j,N-3-i-j),min(N-1,N-i-j)+1):
            ids=(i,j,k);a,b,c=(cosine[t] for t in ids)
            pairs=[times(a,b),times(a,c),times(b,c)]
            triple=times(times(a,b),c)
            lo=1+F(sum(double[t][0] for t in ids),6*S)+F(sum(x[0] for x in pairs),S)+F(triple[0],2*S)
            hi=1+F(sum(double[t][1] for t in ids),6*S)+F(sum(x[1] for x in pairs),S)+F(triple[1],2*S)
            bound=max(abs(lo),abs(hi))
            if bound>max_error:max_error,worst=bound,(ids,lo,hi)
            count+=1
lower=F(781,500);upper=F(79,50)
assert lower**2<alpha_squared[0]/3 and upper**2>alpha_squared[1]/3
delta=max(F(355,226)-lower,upper-F(333,212))
assert delta<eta
total=max_error+eta*sum(map(abs,w))
assert total<F(4,5)
print(json.dumps(dict(grid=N,order=18,q=S,band=list(map(str,alpha_squared)),weights=list(map(str,w)),
                      simplex_sorted_cells=count,worst_cell=worst[0],worst_interval=list(map(str,worst[1:])),
                      continuum_model_error=str(max_error),noise_error=str(eta*sum(map(abs,w))),
                      relocated_total_upper=str(total),upper_float=float(total),original_lower="1",old_donor_upper=str(delta))))
