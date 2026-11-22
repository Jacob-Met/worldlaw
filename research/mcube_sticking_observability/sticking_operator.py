"""Exact planar single-point sticking with a fixed positive support mobility.

Use work-conjugate coordinates z=(v_x,v_y,ell*omega) and
w=(F_x,F_y,M/ell). The constant 3x3 matrix H represents an ellipsoidal
support law in these scaled coordinates. Actual point velocities include
any rotation of either contacting body.
"""
from fractions import Fraction as Q

from sticking_control import stick_twist


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def matvec(matrix, x):
    return tuple(dot(row, x) for row in matrix)


def contact_basis(r, ell):
    if ell <= 0:
        raise ValueError("Reference length must be positive")
    return ((1, 0, -r[1]/ell), (0, 1, r[0]/ell))


def check_mobility(h):
    if len(h)!=3 or any(len(row)!=3 for row in h):
        raise ValueError("Expected a 3 by 3 mobility")
    a,b,c = h[0]
    _,d,e = h[1]
    _,_,f = h[2]
    if b!=h[1][0] or c!=h[2][0] or e!=h[2][1]:
        raise ValueError("Mobility must be symmetric")
    if min(a, a*d-b*b, a*(d*f-e*e)-b*(b*f-c*e)+c*(b*e-c*d)) <= 0:
        raise ValueError("Mobility must be positive definite")


def solve_stick(r, u, ell, h):
    """Return z and the scaled virtual force. Its direction is observable.

    Physical use additionally requires compressive force, friction-cone
    consistency and continued contact. The scale of an actual force is free.
    """
    check_mobility(h)
    bx, by = contact_basis(r,ell)
    hx, hy = matvec(h,bx), matvec(h,by)
    cxx, cxy, cyy = dot(bx,hx), dot(bx,hy), dot(by,hy)
    det = cxx*cyy - cxy*cxy
    if det<=0:
        raise ValueError("Sticking compatibility matrix is singular")
    fx = (cyy*u[0]-cxy*u[1])/det
    fy = (cxx*u[1]-cxy*u[0])/det
    return tuple(fx*x+fy*y for x,y in zip(hx,hy)), (fx,fy)


def radius_equation(r, u, force):
    """Return A, B for the candidate squared torsion radius A*c²=B.

    This equation tests collinearity only. An opposite, tensile or zero
    measured force still needs independent rejection.
    """
    def cross(a,b):
        return a[0]*b[1]-a[1]*b[0]
    jr = (-r[1],r[0])
    a = cross(u,force)
    b = dot(jr,u)*cross(jr,force)-dot(r,r)*a
    return a,b


def qualify():
    ell=Q(45,1000)
    cases=0
    h1=((Q(1),Q(0),Q(0)),(Q(0),Q(1),Q(0)),(Q(0),Q(0),Q(1)))
    h2=((Q(2),Q(1,3),Q(-1,4)),(Q(1,3),Q(4,3),Q(2,7)),(Q(-1,4),Q(2,7),Q(3,2)))
    for h in (h1,h2):
        for ry in (Q(-9,250),Q(-1,50),Q(0),Q(1,50),Q(9,250)):
            r=(-ell,ry)
            b=contact_basis(r,ell)
            for y in (-2,-1,0,1,2):
                f=(Q(1),Q(y,5))
                wrench=tuple(f[0]*x+f[1]*y for x,y in zip(*b))
                for k in (Q(1,50),Q(7,100)):
                    z=tuple(k*v for v in matvec(h,wrench))
                    u=matvec(b,z)
                    got,virtual=solve_stick(r,u,ell,h)
                    assert got==z and virtual==(k*f[0],k*f[1])
                    scaled=tuple(tuple(Q(9)*v for v in row) for row in h)
                    assert solve_stick(r,u,ell,scaled)[0]==z
                    if h==h1:
                        unscaled=stick_twist(r,u,ell)
                        assert unscaled==(z[0],z[1],z[2]/ell)
                        a,bb=radius_equation(r,u,f)
                        assert a*ell**2==bb
                    cases+=1
    a,b=radius_equation((-ell,Q(0)),(Q(1),Q(0)),(Q(2),Q(0)))
    assert a==b==0
    try:
        solve_stick((-ell,Q(0)),(Q(1),Q(0)),ell,((1,0,0),(0,-1,0),(0,0,1)))
    except ValueError:
        pass
    else:
        raise AssertionError("Indefinite mobility accepted")
    print(f"{cases} exact-rational cases passed, including anisotropy, cross-coupling, common-scale invariance and centered non-identification.")


if __name__=='__main__':
    qualify()
