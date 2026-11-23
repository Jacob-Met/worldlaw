"""Source-only finite-time bound for a rigid shape in an observed-period response."""
import cmath
import math
from fractions import Fraction as F
# The unit test uses the exact 3/4/5 rotation rational point, a positive scale,
# and an exact finite set of inputs with time-varying forcing.
def forward(point,chi,co,si,ratio):
    x,y=point[0]-chi[0],point[1]-chi[1]
    return (chi[0]+co*x-si*y/ratio,chi[1]+si*ratio*x+co*y)
def verify():
    r=F(1003,1000);co=F(3,5);si=F(4,5)
    assert co*co+si*si==1
    cases=0
    for x in range(-4,5):
        for y in range(-4,5):
            p=(F(x),F(y));o=(F(0),F(0))
            base=forward(p,o,co,si,F(1))
            traj=forward(p,o,co,si,r)
            dx,dy=traj[0]-base[0],traj[1]-base[1]
            assert (dx,dy)==(si*(1-1/r)*p[1],si*(r-1)*p[0])
            assert dx*dx+dy*dy<=si*si*(r-1)**2*(p[0]**2+p[1]**2)
            for z in [F(-2),F(0),F(3)]:
                h=(z,F(1));g=(F(4),-z)
                two=forward(forward(p,h,co,si,r),g,co,si,r)
                common=forward(p,h,co*co-si*si,2*co*si,r)
                jump=forward((h[0]-g[0],h[1]-g[1]),o,co,si,r)
                assert two==tuple(g[i]+common[i]-h[i]+jump[i] for i in range(2))
                cases+=1
    return cases
if __name__=="__main__":print("Exact moving-input identities verified:",verify())
