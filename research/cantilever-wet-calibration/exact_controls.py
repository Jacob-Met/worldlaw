"""Exact controls for identifiability under the two-term immersed-beam model."""
from fractions import Fraction as Q
import json


def polynomial(t, alpha, beta, rho, xi, dry_square):
    return (1 + alpha * rho) * t**4 + beta * xi * t**3 - dry_square


def bisect_wet(alpha, beta, rho, xi, dry_square):
    low, high = Q(0), Q(1)
    while polynomial(high, alpha, beta, rho, xi, dry_square) < 0:
        high *= 2
    for _ in range(48):
        middle = (low + high) / 2
        if polynomial(middle, alpha, beta, rho, xi, dry_square) < 0:
            low = middle
        else:
            high = middle
    return low, high


def solve(a, b, c, d, p, q):
    det = a*d - b*c
    if not det:
        return det, None
    return det, ((d*p - b*q)/det, (a*q - c*p)/det)


def calibrate(w, s, rho_s, xi_s):
    rows = [(iw**4 - rho_s*js**4, iw**3 - xi_s*js**3, js**4-iw**4)
            for iw, js in zip(w, s)]
    return solve(*rows[0][:2], *rows[1][:2], rows[0][2], rows[1][2])


def main():
    gauges = 0
    wet_roots = 0
    stable_reference = []
    for alpha, beta in [(Q(1,4),Q(1,3)), (Q(2,5),Q(4,3)), (Q(1,2),Q(2,5))]:
        for s in [Q(7,8), Q(9,8), Q(3,2)]:
            d = s - alpha * (1-s)
            scale = s/d
            new_alpha, new_beta = alpha/d, scale*beta
            assert all(k > 0 for k in (d, scale, new_alpha, new_beta))
            assert new_alpha != alpha and scale != 1
            for rho, xi in [(Q(1),Q(1)),(Q(3,2),Q(3,4)),(Q(7,3),Q(11,7))]:
                rho_new = s*rho + (1-s)
                assert rho_new > 0
                assert (rho_new == rho) == (rho == 1)
                assert (xi**2/rho_new == xi**2/rho) == (rho == 1)
                assert 1+new_alpha*rho_new == scale*(1+alpha*rho)
                assert new_beta*xi == scale*beta*xi
                gauges += 1
                for dry in [Q(25), Q(1444)]:
                    assert scale*dry != dry
                    old = bisect_wet(alpha,beta,rho,xi,dry)
                    new = bisect_wet(new_alpha,new_beta,rho_new,xi,scale*dry)
                    assert old == new
                    assert polynomial(old[0],alpha,beta,rho,xi,dry) <= 0
                    assert polynomial(old[1],alpha,beta,rho,xi,dry) >= 0
                    wet_roots += 1
                assert (scale*1444)/(scale*25) == Q(1444,25)
    # Choose exact wet roots first, then derive a physical second fluid for a=b=1.
    water = [Q(2),Q(3)]
    second = [Q(8,5),Q(5,2)]
    dry_sq = [2*t**4+t**3 for t in water]
    _, (A,xi_s) = solve(second[0]**4, second[0]**3, second[1]**4, second[1]**3, *dry_sq)
    rho_s = A-1
    assert rho_s > 0 and xi_s > 0
    det, ab = calibrate(water,second,rho_s,xi_s)
    assert det and ab == (1,1)
    assert all(polynomial(t, *ab, rho_s, xi_s, F) == 0 for t,F in zip(second,dry_sq))
    # Scale wet t by one half. The second known fluid differs, yet beta's column vanishes.
    degenerate = [t/2 for t in water]
    bad_det, bad_solution = calibrate(water,degenerate,Q(31),Q(8))
    assert bad_det == 0 and bad_solution is None
    for beta in [Q(1,3),Q(1),Q(4)]:
        F = [2*t**4+beta*t**3 for t in water]
        assert all(polynomial(t,1,beta,31,8,f) == 0 for t,f in zip(degenerate,F))
        stable_reference.append([str(beta),list(map(str,F))])
    print(json.dumps(dict(coefficient_checks=gauges, identical_root_brackets=wet_roots,
        dry_square=list(map(str,dry_sq)),wet_sqrt_angular_frequency=list(map(str,second)),
        second_density=str(rho_s),second_xi=str(xi_s),second_viscosity=str(xi_s**2/rho_s),
        full_rank_determinant=str(det),fitted_a_b=list(map(str,ab)),
        singular_determinant=str(bad_det),singular_beta_and_dry=stable_reference,
        measured_frequencies_used=0),sort_keys=True))


if __name__ == '__main__':
    main()
