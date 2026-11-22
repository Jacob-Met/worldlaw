"""Illustrate what a nonnegative-voltage dark sweep can determine.

The terminal convention is positive voltage and current for delivered power.
Voltage and current below use normalized units. This is an exact
nonparametric support witness, not a fitted device or a Bishop model.
"""
from fractions import Fraction
import json


def outgoing_dark_current(voltage, reverse_coefficient):
    reverse_voltage = max(-voltage, 0)
    return -voltage + reverse_coefficient * reverse_voltage**2


def check():
    laws = (0, 2)
    # Algebraically the extra branch is identically zero for all v >= 0.
    for numerator in range(601):
        voltage = Fraction(numerator, 100)
        assert outgoing_dark_current(voltage, laws[0]) == outgoing_dark_current(voltage, laws[1])
    reverse_voltages = (Fraction(-1), Fraction(-1, 2))
    for coefficient, voltage in zip(laws, reverse_voltages):
        assert outgoing_dark_current(voltage, coefficient) == 1
        assert voltage * outgoing_dark_current(voltage, coefficient) < 0
    return {
        'observed_branch': 'all normalized terminal voltages v >= 0',
        'dark_current_laws': ['-v', '-v + 2 max(-v,0)^2'],
        'prescribed_outgoing_current': 1,
        'reverse_voltages': [str(v) for v in reverse_voltages],
        'scope': 'C1 monotone passive terminal counterexample in normalized units; no fit to panels',
    }


if __name__ == '__main__':
    print(json.dumps(check(), sort_keys=True))
