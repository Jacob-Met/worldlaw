"""Exact sup-norm sensitivity of the zero-load unloading intercept."""
import argparse
from fractions import Fraction
import json


def certificate(lower):
    """Use t=(P/Pmax)^(1/3), lower <= t <= 1, for h=r+A*t^2+B*t^3."""
    one = Fraction(1)
    if not 0 < lower < one:
        raise ValueError("lower must be strictly between zero and one")
    ratio = (one - lower**2) / (one - lower**3)
    mid = 2 / (3 * ratio)
    nodes = (lower, mid, one)
    assert lower < mid < one

    def shape(t):
        return t**2 - ratio*t**3

    bottom = shape(lower)
    top = shape(mid)
    assert bottom == shape(one) and top == 4/(27*ratio**2)
    # shape'(t)=t*(2-3*ratio*t) has only one zero in the open interval.
    amplitude = (top-bottom)/(top+bottom)
    quadratic = -2/(top+bottom)
    cubic = -ratio*quadratic

    def extremizer(t):
        return 1 + quadratic*t**2 + cubic*t**3

    assert tuple(map(extremizer, nodes)) == (amplitude, -amplitude, amplitude)
    cofactors = (mid**2*(1-mid), -lower**2*(1-lower),
                 lower**2*mid**2*(mid-lower))
    determinant = sum(cofactors)
    assert determinant == (mid-lower)*(1-lower)*(1-mid)*(lower*mid+lower+mid)
    weights = tuple(x/determinant for x in cofactors)
    assert [sum(w*t**k for w,t in zip(weights,nodes)) for k in (0,2,3)] == [1,0,0]
    assert sum(map(abs, weights)) == 1/amplitude
    return dict(lower_t=str(lower), minimum_load_fraction=str(lower**3),
                nodes=list(map(str,nodes)), intercept_weights=list(map(str,weights)),
                unit_intercept_polynomial=list(map(str,(one,quadratic,cubic))),
                extremum_absolute_value=str(amplitude), free_compliance_gain=str(1/amplitude),
                known_compliance_gain=str((1+lower**2)/(1-lower**2)))


WINDOWS = (Fraction(1,2), Fraction(4,5), Fraction(9,10), Fraction(19,20))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lower", type=Fraction, help="lower cube-root load fraction")
    args = parser.parse_args()
    windows = [args.lower] if args.lower is not None else WINDOWS
    print(json.dumps([certificate(lower) for lower in windows], indent=2))
