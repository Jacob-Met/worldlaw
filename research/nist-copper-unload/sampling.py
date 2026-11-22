"""Sharp bounds for a finite rational cube-root-load sampling design."""
from fractions import Fraction as F
import argparse
import json


def finite_design(nodes):
    """Return coefficients for estimating the intercept from the actual sample locations."""
    ts = sorted(set(map(F, nodes)))
    if not ts or ts[0] < 0:
        raise ValueError("supply nonnegative cube-root load coordinates")
    if ts[0] == 0:
        return {"gain": "1", "nodes": ["0"], "weights": ["1"]}
    if len(ts) < 3:
        return {"gain": "unbounded", "nodes": list(map(str,ts)), "weights": []}
    left, right = ts[0], ts[-1]
    ratio = (right**2-left**2)/(right**3-left**3)

    def arch(t):
        return t**2-ratio*t**3

    # The extrema of the arch over the observed grid give both minimax certificates.
    mid = max(ts[1:-1], key=arch)
    low, high = arch(left), arch(mid)
    assert arch(right) == low and high > low > 0
    gain = (high+low)/(high-low)
    a = mid**2*right**2*(right-mid)
    b = -left**2*right**2*(right-left)
    c = left**2*mid**2*(mid-left)
    weights = [v/(a+b+c) for v in (a,b,c)]
    assert sum(map(abs,weights)) == gain
    return {"gain": str(gain), "nodes": list(map(str,(left,mid,right))),
            "weights": list(map(str,weights))}


if __name__ == "__main__":
    arg = argparse.ArgumentParser(description=__doc__)
    arg.add_argument("nodes", nargs="+", help="cube-root load, decimal or fraction")
    print(json.dumps(finite_design(arg.parse_args().nodes),indent=2))
