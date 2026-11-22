"""Sharp orientation bounds for ideal centered ellipsoids in unbounded Stokes flow.

The returned mobility is 16*pi*mu times vertical speed divided by force.
This program consumes no measurements or meshes.
"""
from fractions import Fraction as F
from itertools import pairwise
from math import isqrt, prod
import json


def directed_sqrt(value, scale, upper):
    """Return an integer directed bound for scale * sqrt(value)."""
    square = value * scale**2
    lower = isqrt(square.numerator // square.denominator)
    return lower + int(upper and lower**2 < square)


def principal_mobility(axes, cells=4096, scale=10**10):
    """Enclose each positive integral by endpoint bounds on its factors."""
    axes = tuple(map(F, axes))
    length = min(axes)
    squares = [(axis / length)**2 for axis in axes]
    edges = []
    for index in range(cells + 1):
        x2 = F(index, cells)**2
        factors = [1 + (b - 1) * x2 for b in squares]
        numerators = [2 * (1 + b * x2 / f) for b, f in zip(squares, factors)]
        edges.append((prod(factors), numerators))
    intervals = []
    for k in range(3):
        lo = hi = 0
        for (d0, n0), (d1, n1) in pairwise(edges):
            lo += directed_sqrt(n0[k]**2 / d1, scale, False)
            hi += directed_sqrt(n1[k]**2 / d0, scale, True)
        factor = cells * scale * length
        intervals.append((lo / factor, hi / factor))
    return intervals


def mix(intervals, weights):
    assert all(w >= 0 for w in weights) and sum(weights) == 1
    return tuple(sum(w * interval[i] for w, interval in zip(weights, intervals))
                 for i in (0, 1))


def plain(pair):
    return {'rational': list(map(str, pair)), 'decimal': list(map(float, pair))}


def run():
    same_axes = (3, 2, 1)
    intervals = principal_mobility(same_axes)
    middle_weights = (0, 1, 0)
    mixed_weights = (F(27, 32), 0, F(5, 32))
    moments = [sum(w / F(a)**2 for w, a in zip(q, same_axes))
               for q in (middle_weights, mixed_weights)]
    assert moments == [F(1, 4)] * 2
    middle, mixed = [mix(intervals, q) for q in (middle_weights, mixed_weights)]
    gap = (mixed[0] - middle[1], mixed[1] - middle[0])
    assert gap[0] > 0

    # Vertical shear z <- z + 3*x/2 maps a unit ball to another ellipsoid.
    # Its shape matrix has eigenvalues 4, 1, 1/4 and the indicated vertical weights.
    sheared_axes = (F(2), F(1), F(1, 2))
    sheared = mix(principal_mobility(sheared_axes), (F(4, 5), 0, F(1, 5)))
    sphere = F(8, 3)
    assert sheared[1] < sphere or sheared[0] > sphere
    sphere_interval = principal_mobility([1, 1, 1])
    assert all(lo <= sphere <= hi for lo, hi in sphere_interval)
    return {
        'model': 'centered homogeneous no-slip ellipsoid; unbounded Stokes flow; vertical force and horizontal projection',
        'mobility_units': '16*pi*mu*U_vertical/F',
        'cells': 4096,
        'decimal_sqrt_scale': 10**10,
        'same_body': {
            'axes': list(same_axes), 'area_over_pi': 3,
            'q_middle': list(map(str, middle_weights)),
            'q_mixed': list(map(str, mixed_weights)),
            'principal': list(map(plain, intervals)),
            'middle': plain(middle), 'mixed': plain(mixed),
            'mixed_minus_middle': plain(gap),
            'unavoidable_max_absolute_error_lower': str(gap[0] / 2),
        },
        'identical_horizontal_silhouette_different_bodies': {
            'vertical_shear': '3/2', 'volume_over_pi': '4/3',
            'projection': 'unit disk', 'projected_diameter': 2,
            'gravity_weights': ['4/5', '0', '1/5'],
            'sphere_exact': str(sphere), 'sheared': plain(sheared),
        },
    }


if __name__ == '__main__':
    print(json.dumps(run(), indent=2, sort_keys=True))
