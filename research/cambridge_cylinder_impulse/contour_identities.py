"""Exact polynomial check of both contour signs and the planar-divergence correction."""
from fractions import Fraction as F
def one(a,b,k):
    return F(b**(k+1)-a**(k+1),k+1)
def area(rect,p,q):
    x0,x1,y0,y1=rect
    return one(x0,x1,p)*one(y0,y1,q)
def bd(rect,p,q,differential):
    x0,x1,y0,y1=rect
    if differential=='x':return one(x0,x1,p)*(y0**q-y1**q)
    return one(y0,y1,q)*(x1**p-x0**p)
def check():
    outer=(-2,3,-1,4);inner=(-1,1,0,2);n=0
    A=lambda p,q:area(outer,p,q)-area(inner,p,q)
    E=lambda p,q,dr:bd(outer,p,q,dr)-bd(inner,p,q,dr)
    for i in range(5):
        for j in range(5-i):
            for component in ('u','v'):
                if component=='u':
                    mx=-j*A(i+1,j-1) if j else F(0);my=-j*A(i,j)
                    cx=E(i+1,j,'x')-E(i,j+1,'y');cy=E(i,j+1,'x')+E(i+1,j,'y')
                    dx=i*A(i-1,j+1) if i else F(0);dy=-i*A(i,j)
                else:
                    mx=i*A(i,j);my=i*A(i-1,j+1) if i else F(0)
                    cx=E(i,j+1,'x')+E(i+1,j,'y');cy=-E(i+1,j,'x')+E(i,j+1,'y')
                    dx=j*A(i,j);dy=-j*A(i+1,j-1) if j else F(0)
                assert (mx,my)==(cx+dx,cy+dy)
                n+=1
    return n
if __name__=='__main__':print(check(),'exact polynomial rectangle-with-hole checks passed.')
