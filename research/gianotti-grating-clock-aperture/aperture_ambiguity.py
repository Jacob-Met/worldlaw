"""Conditional weak-scattering controls for three compact, equal-shaped subgratings."""
import cmath
import json
import math
from fractions import Fraction


def amplitude(weights, detuning, phases):
    """Return the discrete factor multiplying the common subgrating Fourier transform."""
    return sum(weight * cmath.exp(1j * (j * detuning + phase))
               for j, (weight, phase) in enumerate(zip(weights, phases)))


def controls():
    # Each subgrating can have the same compact, even, real envelope with integral one.
    # Place disjoint copies at positions 0, 1, 2. A continuous phase field can be
    # constant on each subgrating and rise by pi only in the gap before the third.
    weights = (1, 2, 4)
    reverse = weights[::-1]
    coefficients = lambda seq: [sum(seq[j] * seq[j + lag] for j in range(3 - lag))
                                for lag in range(3)]
    assert coefficients(weights) == coefficients(reverse) == [21, 10, 4]
    # The zero-strain spectral power therefore agrees for every detuning, as does
    # any common shift of detuning. No sampled-frequency extrapolation is needed.
    def changed(seq):
        return Fraction((seq[0] + seq[1] - seq[2]) ** 2, sum(seq) ** 2)
    a, b = changed(weights), changed(reverse)
    assert (a,b) == (Fraction(1,49), Fraction(25,49))
    for seq, value in [(weights,a),(reverse,b)]:
        computed = abs(amplitude(seq,0,[0,0,math.pi]) / sum(seq)) ** 2
        assert abs(computed - float(value)) < 1e-14
    return {"unloaded_autocorrelation": coefficients(weights),
            "normalized_loaded_resonant_powers": [str(a),str(b)],
            "loading": "Identical phase field with the delay in the second gap.",
            "scope": "Weak scalar reflection with unknown longitudinal coupling. This is an existence result for that class."}


if __name__ == "__main__":
    print(json.dumps(controls(), sort_keys=True))
