"""Synthetic controls (no experimental response files)."""
from fractions import Fraction as F
import numpy as np
from model import yld,axis_slopes,curves,invert_terminal,GRID
from model import required_uni
n=(F(12,13),F(5,13));u=(F(4,5),F(3,5));a=F(15,16)
assert n[0]<a and n[1]<a and (sum(n)**2)/2<a*a
radial=a/sum(x*y for x,y in zip(n,u))
assert radial==F(325,336)
# Unit square yield and distinct quadratic plastic potential at sigma=(1/2,1).
# Convex potential grad=(sigma_x,sigma_y/10). Positive dissipation coexists
# with a violated RD associated-flow lower limit.
sigma=(F(1,2),F(1));rate=(sigma[0],sigma[1]/10)
W=sum(a*b for a,b in zip(sigma,rate))
assert W==F(7,20) and W<rate[0]
for m in (4,6,8):
    f=lambda v:yld(np.ones(8),m,v)
    for ang in np.linspace(0,np.pi,47):
        x,y=np.cos(ang),np.sin(ang)
        assert abs(f([x*x,y*y,x*y])-1)<2e-13
    assert np.max(abs(axis_slopes(f)-.5))<3e-8
for v in (.1,.7,10):
    assert abs(invert_terminal(np.full_like(GRID,20),v/20)-v)<1e-10
a=np.array([[0.,0.],[.1,2.],[.05,3.],[.2,5.]])
assert abs(required_uni(a,.15)-(.1+.05*(11/3+13/3)/2))<1e-10
print("synthetic circle/slab, nonassociation, 141 rotated Yld cases, 3 inversions, first excursion passed")
