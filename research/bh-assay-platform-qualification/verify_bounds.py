"""Recompute what the reported unsigned bands identify under an absolute-point reading."""
from fractions import Fraction as F
from math import sqrt


def checked_summary():
    counts = (228, 105, 51)
    edges = tuple(map(F, (0, 5, 10))) + (F("13.2"),)
    n = sum(counts)
    assert n == 6 * 64
    mean_bounds = tuple(sum(c * e for c, e in zip(counts, edges[i:])) / n
                        for i in (0, 1))
    mse_bounds = tuple(sum(c * e**2 for c, e in zip(counts, edges[i:])) / n
                       for i in (0, 1))
    assert mean_bounds == (F(345, 128), F(1193, 160))

    # Two hypothetical releases. The individual 96-well inputs and absolute
    # differences (including a maximum of 13.2 points) agree exactly.
    differences = [F(2)] * 228 + [F(7)] * 105 + [F(12)] * 50 + [F("13.2")]
    source = [F(50)] * n
    plus = [s + d for s, d in zip(source, differences)]
    minus = [s - d for s, d in zip(source, differences)]
    for targets in (plus, minus):
        observed = [abs(t - s) for s, t in zip(source, targets)]
        assert sum(d < 5 for d in observed) == 228
        assert sum(5 <= d < 10 for d in observed) == 105
        assert sum(10 <= d <= F("13.2") for d in observed) == 51
        assert all(0 <= t <= 100 for t in targets)
    assert all(x - s == s - y for s, x, y in zip(source, plus, minus))

    # For a different construction, even the source and every unsigned
    # residual are identical across both worlds, but every class can change.
    # Use a common source slightly ABOVE the threshold for large residuals
    # so that both candidate worlds remain within [0,100].
    threshold_source = [F(10) + d / 2 for d in differences]
    same = [s + d for s, d in zip(threshold_source, differences)]
    opposite = [s - d for s, d in zip(threshold_source, differences)]
    assert all(0 <= y <= 100 for y in same + opposite)
    assert all(s > 10 and y > 10 for s, y in zip(threshold_source, same))
    assert all(s > 10 and y < 10 for s, y in zip(threshold_source, opposite))
    return mean_bounds, tuple(sqrt(x) for x in mse_bounds)


if __name__ == "__main__":
    mae, rmse = checked_summary()
    print("Unsigned identity MAE outer bounds", *(float(x) for x in mae))
    print("Unsigned identity RMSE outer bounds", *rmse)
    print("Signed effects opposite. Threshold disagreement ranges from 0/384 to 384/384.")
