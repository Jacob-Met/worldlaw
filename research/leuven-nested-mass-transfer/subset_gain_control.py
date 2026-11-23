"""Exact gain and subset-transfer controls. No experimental response is used."""
from fractions import Fraction as F
from resolvent_control import mult, transpose, inv2


def diag(*entries):
    return [[F(x) if i == j else F(0) for j in range(len(entries))]
            for i, x in enumerate(entries)]


def check():
    # Two calibration ports, third port withheld in both sensing and driving.
    b = [[F(1), F(0)], [F(0), F(1)], [F(1), F(1)]]
    # Effective core is the inverse of the local dynamic stiffness.
    stiffness = [[F(4), F(-1)], [F(-1), F(3)]]
    core = inv2(stiffness)
    left, right, at_sites = diag(2, 3, 5), diag(7, 11, 13), diag(17, 19)
    field = mult(mult(left, b), at_sites)
    measured = mult(mult(mult(mult(left, b), core), transpose(b)), right)
    w = [F(7, 2), F(11, 3), F(13, 5)]
    homogeneous = mult(measured, diag(*(1 / x for x in w)))
    inverse_field = inv2(field[:2])
    def extract(block):
        return mult(mult(inverse_field, [r[:2] for r in block[:2]]),
                    transpose(inverse_field))
    fitted = extract(homogeneous)
    naive = extract(measured)
    results = []
    for site, hidden in enumerate([4, 3]):
        fitted_subset = 1 / inv2(fitted)[site][site]
        actual = left[2][2] * b[2][site] ** 2 * right[2][2] / hidden
        prediction = field[2][site] ** 2 * fitted_subset * w[2]
        naive_subset = 1 / inv2(naive)[site][site]
        naive_prediction = field[2][site] ** 2 * naive_subset
        assert prediction == actual and naive_prediction != actual
        results.append(dict(site=site, exact=str(actual), naive=str(naive_prediction)))
    return results


if __name__ == '__main__':
    print(check())
