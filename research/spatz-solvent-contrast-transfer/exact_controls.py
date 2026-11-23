from fractions import Fraction as F
def solve(y,r):
    x,z,w=y
    a,b=r
    g=lambda v,r:v*(1+r)/(1-r)
    s=(g(z,b)-g(x,a))/(z*z-x*x)
    t=g(x,a)-s*x*x
    assert s>0 and t>0 and 4*s*t>=1
    u=s*w*w+t
    return (u-w)/(u+w),4*s*t
interval=[(F(3,4),F(4,3),F(21,20)),(F(5,4),F(5,3),F(29,20))]
assert all(v*v-u*u==1 for u,v in zip(*interval))
def package(i,j):
    # Common nonnegative, unit-mass, two-energy resolution operator.
    a=F(3,10);rs=[(a+i,a+j),(a-i,a-j)]
    assert all(sum(k)/2==a for k in zip(*rs))
    result=[solve(y,r) for y,r in zip(interval,rs)]
    return sum(k[0] for k in result)/2,[k[1] for k in result]
low=package(-F(3,25),-F(4,25))
high=package(F(3,25),F(5,25))
assert high[0]-low[0]>F(7,1000)
print(low,high,high[0]-low[0])

from itertools import product
# Exact rational field transfer comparison for general non-symmetric real SL(2).
controls=0
for h,b,c,k,y in product((F(2,3),F(5,2)),(F(-2,3),F(0),F(4,7)),(F(-1,2),F(0),F(2,5)),(F(1,3),F(1),F(5,4)),(F(3,4),F(4,3),F(29,20))):
    d=(1+b*c)/h
    num=(k*h-y*d)**2+(k*b*y+c)**2
    den=(k*h+y*d)**2+(k*b*y-c)**2
    R=num/den
    s=(d*d+k*k*b*b)/(2*k)
    t=(k*k*h*h+c*c)/(2*k)
    assert 4*s*t-1==(k*k*h*b+c*d)**2/(k*k)
    assert R<1 and y*(1+R)/(1-R)==s*y*y+t
    v=(s*y*y+t-y)/(s*y*y+t+y)
    assert R==v
    controls+=1
print("MATRIX",controls)
# Realizability at a single energy k: a,b,c,d via a Cholesky factor of the
# positive 2x2 column Gram matrix with diagonal 2kt,2ks and determinant k^2.
print("ASSESSMENT",{"empirical_rows":0,"claim":"Pointwise real unimodular relaxation. One shared physical potential across energies is not established.","measurement":"two equal positive normalized energy weights"})
