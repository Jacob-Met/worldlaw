"""Reconstruct the unloading certificate independently from three equioscillation equations."""
from fractions import Fraction as F
import argparse
import itertools
import json
from pathlib import Path


def solve(matrix, right):
    rows = [list(row)+[value] for row,value in zip(matrix,right)]
    n = len(rows)
    for i in range(n):
        pivot = next(j for j in range(i,n) if rows[j][i])
        rows[i],rows[pivot] = rows[pivot],rows[i]
        denom = rows[i][i]
        rows[i] = [x/denom for x in rows[i]]
        for j in range(n):
            if i != j:
                scale = rows[j][i]
                rows[j] = [v-scale*u for v,u in zip(rows[j],rows[i])]
    return [row[-1] for row in rows]


def recount(record):
    left = F(record["lower_t"])
    # The endpoints tie, giving beta/alpha. Stationarity fixes the interior node.
    b_over_a = -(1+left)/(1+left+left**2)
    midpoint = -2/(3*b_over_a)
    ts = [left,midpoint,F(1)]
    values = [[F(1),t**2,t**3] for t in ts]
    peak_fit = solve(values,[F(1),F(-1),F(1)])
    dual = solve(list(zip(*values)),[F(1),F(0),F(0)])
    gain = peak_fit[0]
    assert gain == F(record["free_compliance_gain"]) == sum(abs(x) for x in dual)
    assert dual == list(map(F,record["intercept_weights"]))
    assert ts == list(map(F,record["nodes"]))
    assert [x/gain for x in peak_fit] == list(map(F,record["unit_intercept_polynomial"]))
    assert F(record["extremum_absolute_value"]) == 1/gain
    assert F(record["minimum_load_fraction"]) == left**3
    assert 2*peak_fit[1]+3*peak_fit[2]*midpoint == 0
    assert F(record["known_compliance_gain"]) == solve([[F(1),left**2],[F(1),F(1)]],[F(1),F(-1)])[0]
    # Both indistinguishable laws can have nonnegative intercept and coefficients.
    center = [abs(x)+1 for x in peak_fit]
    plus = [x+y for x,y in zip(center,peak_fit)]
    minus = [x-y for x,y in zip(center,peak_fit)]
    for i in range(1001):
        t = left + (1-left)*F(i,1000)
        row = (1,t*t,t**3)
        error = sum(x*y for x,y in zip(peak_fit,row))
        assert abs(error) <= 1
    assert min(plus+minus)>0 and (plus[0]-minus[0])/2==gain
    # Any signed noise on the three nodes lies inside the bound, and a corner attains it.
    corners=[sum(w*s for w,s in zip(dual,signs)) for signs in itertools.product((-1,1),repeat=3)]
    assert max(corners) == gain and min(corners) == -gain
    return dict(lower=str(left), gain=str(gain), nodes=list(map(str,ts)),
                exact_grid_points=1001, noise_corners=len(corners),
                indistinguishable_nonnegative_models=[list(map(str,minus)),list(map(str,plus))])


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("certificate", type=Path)
    args = p.parse_args()
    rows=json.loads(args.certificate.read_text())
    assert [F(x["lower_t"]) for x in rows]==[F(1,2),F(4,5),F(9,10),F(19,20)]
    print(json.dumps([recount(row) for row in rows],indent=2))
