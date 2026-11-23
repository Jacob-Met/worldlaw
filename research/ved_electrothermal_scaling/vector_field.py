"""Check the Appendix A vector-field transformation over signed rational states."""
from fractions import Fraction as Q
import itertools
import json

def field(x, bias, gain, external):
    result = []
    for i, (pos, vel, temp, y) in enumerate(x):
        w, quality, alpha, beta, zeta, tau, kappa, mass = (
            (3, 7, 2, 5, 4, Q(1,5), 2, 3),
            (5, 11, 3, 6, 2, Q(1,6), -3, 4),
        )[i]
        u = bias[i] + gain[i][0]*x[0][3] + gain[i][1]*x[1][3]
        result.append((vel, -w*w*pos-Q(w,quality)*vel+alpha*temp+external[i]/mass,
                       -beta*temp+zeta*u*u, -y/tau+kappa*vel))
    return result

def scaled(rows, a):
    return [tuple(a*v for v in row) for row in rows]

def check():
    states = [(tuple(map(Q,(1,2,-1,3))),tuple(map(Q,(-2,0,1,-4)))),
              (tuple(map(Q,(0,0,0,0))),tuple(map(Q,(0,0,0,0))))]
    count = misses = 0
    for x,a,b1,b2,k,g,f in itertools.product(states, (Q(1,3),Q(2)),(-2,0,3),(-3,0,2),(0,2),(-1,0,1),(0,3)):
        b = (Q(b1),Q(b2))
        gains = [(Q(k),Q(g)),(Q(-2),Q(-k))]
        forcing = (Q(f),Q(-2*f))
        expected = scaled(field(x,b,gains,forcing),a*a)
        got = field(scaled(x,a*a),[a*v for v in b],scaled(gains,1/a),[a*a*v for v in forcing])
        assert got == expected
        wrong = field(scaled(x,a*a),[a*v for v in b],gains,[a*a*v for v in forcing])
        misses += int(wrong != expected)
        count += 1
    assert 0 < misses < count
    return dict(rational_fields=count,unscaled_gain_falsifiers=misses,scientific_values=0)

if __name__ == '__main__':
    print(json.dumps(check(),sort_keys=True))
