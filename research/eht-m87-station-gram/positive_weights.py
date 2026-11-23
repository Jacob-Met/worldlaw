"""Exact synthetic positive-weight and phase counterexample for three stations."""
from fractions import Fraction
from itertools import combinations
import json


def determinant(matrix):
    if len(matrix) == 1:
        return matrix[0][0]
    return sum((-1)**j * cell * determinant([row[:j] + row[j+1:] for row in matrix[1:]])
               for j, cell in enumerate(matrix[0]))


def check(epsilon):
    e = Fraction(epsilon)
    weights = ((1+e, 1-e), (1-e, 1+e), (1-e*e, 1-e*e))
    fields = ((1, 1), (1, 1), (1, -1))
    assert all(w > 0 for pair in weights for w in pair)
    def cross(i, j, weight_only=False):
        return sum(weights[i][t]*weights[j][t] *
                   (1 if weight_only else fields[i][t]*fields[j][t]) for t in range(2))
    raw = [[cross(i,j) for j in range(3)] for i in range(3)]
    pairs = list(combinations(range(3), 2))
    weight = 2*(1-e*e)
    assert all(cross(i,j,True) == weight for i,j in pairs)
    assert all(determinant([[raw[i][j] for j in indices] for i in indices]) >= 0
               for n in (1,2,3) for indices in combinations(range(3), n))
    assert determinant(raw) == 0
    normalized = [[Fraction(1) if i == j else raw[i][j]/weight
                   for j in range(3)] for i in range(3)]
    assert [normalized[i][j] for i,j in pairs] == [1,e,-e]
    assert determinant(normalized) == -4*e*e
    return dict(epsilon=str(e),common_pair_weight=str(weight),
                station_diagonal_after_common_normalization=[str(raw[i][i]/weight) for i in range(3)],
                normalized_edges=[str(normalized[i][j]) for i,j in pairs],
                unit_diagonal_determinant=str(determinant(normalized)),
                raw_gram_determinant=str(determinant(raw)))


if __name__ == "__main__":
    for epsilon in ("0","1/1000","1/100","1/5","1/2"):
        print(json.dumps(check(epsilon), sort_keys=True))
