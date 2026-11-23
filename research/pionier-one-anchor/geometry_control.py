from fractions import Fraction as F
# u,v are coordinates of the normalized relative orbit after omega.
# Unknown angular scale a, c=cos(i), A=a*sin(i), z=rho^2; squared coordinates permit an exact test.
def forecast(z0,A2,u0,v0,u1,v1):
    radius02=u0*u0+v0*v0
    if not radius02: raise ValueError('zero reference radius')
    scale2=(z0+A2*v0*v0)/radius02
    if A2<0 or scale2<A2: raise ValueError('anchor and angular spectroscopic scale incompatible')
    return scale2*(u1*u1+v1*v1)-A2*v1*v1
def interval(z0,u0,v0,u1,v1):
    if not u0:raise ValueError('edge-on singular anchor needs a separate limit')
    endpoints=(z0*u1*u1/(u0*u0),z0*(u1*u1+v1*v1)/(u0*u0+v0*v0))
    return min(endpoints),max(endpoints)
def check():
    tested=0
    for u0,v0,u1,v1 in [(F(2,5),F(7,9),F(-3,7),F(11,10)),(F(5,3),F(0),F(0),F(-3,10)),(F(-4,5),F(4,5),F(4,5),F(-4,5))]:
        for scale2 in (F(7,4),F(12)):
            for c2 in map(F,[0,F(1,5),F(2,3),1]):
                A2=scale2*(1-c2)
                z0=scale2*(u0*u0+c2*v0*v0)
                z1=scale2*(u1*u1+c2*v1*v1)
                assert forecast(z0,A2,u0,v0,u1,v1)==z1
                low,high=interval(z0,u0,v0,u1,v1)
                assert low<=z1<=high
                tested+=1
    return tested

if __name__=="__main__":
    print("EXACT_CONTROLS",check())
