"""Independent checks of the mobility integral, silhouette inversion and mean-operand identities."""
from fractions import Fraction as F
from math import sqrt
import hashlib
import json

import mpmath as mp

from orientation_bounds import run


def carlson_mobility(axes):
    # Carlson's definitions of R_F and R_D on [0,infinity) give
    # chi = 2*RF and alpha_i = 2*RD(other two squares, own square)/3.
    aa = [mp.mpf(str(a))**2 for a in axes]
    chi = 2 * mp.elliprf(*aa)
    return [chi + 2 * aa[k] * mp.elliprd(aa[(k+1)%3], aa[(k+2)%3], aa[k]) / 3
            for k in range(3)]


def solve(matrix, rhs):
    rows = [list(map(F, row)) + [F(b)] for row, b in zip(matrix, rhs)]
    for j in range(len(rows)):
        pivot = next(k for k in range(j, len(rows)) if rows[k][j])
        rows[j], rows[pivot] = rows[pivot], rows[j]
        divisor = rows[j][j]
        rows[j] = [x/divisor for x in rows[j]]
        for k in range(len(rows)):
            if k != j:
                multiplier = rows[k][j]
                rows[k] = [a-multiplier*b for a,b in zip(rows[k],rows[j])]
    return [row[-1] for row in rows]


def audit():
    mp.mp.dps = 55
    result = run()
    a = (3,2,1)
    m = carlson_mobility(a)
    for integral, reference in zip(result['same_body']['principal'],m):
        bound = list(map(F, integral['rational']))
        assert float(bound[0]) < reference < float(bound[1])
    projected_mobility = sum(w*x for w,x in zip((mp.mpf(27)/32,0,mp.mpf(5)/32),m))
    ms = carlson_mobility((2,1,'0.5'))
    shear = (4*ms[0]+ms[2])/5
    assert 2.548207 < shear < 2.550051
    # The matrix maps orientation squares to sum, weighted B-trace and
    # weighted inverse-B trace. Those two moments are supplied by silhouette
    # trace and determinant when the three-dimensional shape is known.
    squares = list(map(F,(9,4,1)))
    inverse = [1 / x for x in squares]
    matrix = [[F(1)]*3,squares,inverse]
    count = 0
    for i in range(17):
        for j in range(17-i):
            q = [F(i,16), F(j,16), F(16-i-j,16)]
            trace = sum(squares) - sum(w*b for w,b in zip(q,squares))
            det = 36*sum(w*p for w,p in zip(q,inverse))
            assert solve(matrix,[1,sum(squares)-trace,det/36]) == q
            count += 1
    # The normalized determinant is the square of the area divided by pi*abc.
    middle_trace = F(14)-4
    mixed_trace = F(14)-(F(27,32)*9+F(5,32))
    assert middle_trace != mixed_trace and (middle_trace,mixed_trace)==(10,F(25,4))
    # The sphere has identical upper and lower projected radii at every pose.
    # A sphere and its vertical shear have top-left unit shape block and det 1.
    t = F(3,2)
    assert (1+t*t)-t*t == 1
    assert F(4)+F(1,4) == 2+t*t
    # Paired Be and A_r values at a common time may be replaced by a single
    # shared-mean operand; products of separately computed means change them.
    ar=(F(1,4),F(1))
    mean_ar=sum(ar)/2
    mean_inverse=sum(1/v for v in ar)/2
    assert mean_ar*mean_inverse == F(25,16)
    return {
        'same_ellipsoid_middle':mp.nstr(m[1],24),
        'same_ellipsoid_mixed':mp.nstr(projected_mobility,24),
        'sheared_sphere':mp.nstr(shear,24),
        'sphere':mp.nstr(mp.mpf(8)/3,24),
        'exact_orientation_reconstructions':count,
        'trace_different_at_equal_area':list(map(str,(middle_trace,mixed_trace))),
        'separate_mean_inflation_example':str(mean_ar*mean_inverse)
    }


if __name__=='__main__':
    print(json.dumps(audit(),indent=2,sort_keys=True))
