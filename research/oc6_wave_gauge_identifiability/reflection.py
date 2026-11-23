"""Check the two reflection-modulus conditions against five complex gauge ordinates."""
import math
import numpy as np

from geometry import POSITIONS, PIVOT, SCALE, matrix, modes


def compatibility(x_model, y, periods, low_reflection, high_reflection):
    """All lengths are full-scale metres except x_model, which is in model metres."""
    if not 0 <= low_reflection < 1 or not 0 < high_reflection < 1:
        raise ValueError("Require positive high-frequency reflection and both ratios below one")
    y = np.asarray(y, dtype=complex)
    x_model = np.asarray(x_model, dtype=float)
    if x_model.shape != (5,) or y.shape != (5,):
        raise ValueError("Require five matched position/complex ordinate pairs")
    if not np.all(np.isfinite(y)) or not np.all(np.isfinite(x_model)):
        raise ValueError("Nonfinite input")
    x = (x_model - PIVOT) * SCALE
    # Wang uses exp(-ikx) for forward waves. Conjugate the geometry module's kernel.
    A = matrix(x, modes(*periods)).conj()
    keep = [0, 2, 3, 4, 5]
    base = A[:, keep]
    inverse = np.linalg.solve(base, np.eye(5))
    b = inverse @ y
    u = inverse @ A[:, 1]
    if abs(abs(u[0]) - 1) > 1e-10:
        raise ArithmeticError("Missing conjugate-pair null symmetry")

    # t is the omitted backward-bound coefficient. The first ratio forces
    # |t| = rho |b0-u0*t|. Parameterize that circle in the complex plane.
    rho = low_reflection * high_reflection
    denominator = 1 - rho**2 * abs(u[0])**2
    center = -rho**2 * b[0] * u[0].conjugate() / denominator
    radius = rho * abs(b[0]) / denominator
    ratio = low_reflection / high_reflection
    # The second parity equality is |p_plus| = ratio * |p_minus|.
    # Its squared difference on the first circle is a constant plus one sinusoid.
    p = b[3] - u[3] * center
    q = ratio * (b[4] - u[4] * center)
    beta = -u[3]
    delta = -ratio * u[4]
    offset = abs(p)**2 - abs(q)**2 + radius**2 * (abs(beta)**2 - abs(delta)**2)
    coefficient = p.conjugate() * beta - q.conjugate() * delta
    amplitude = 2 * radius * abs(coefficient)
    lower, upper = offset - amplitude, offset + amplitude
    solutions = []
    if amplitude and abs(offset) <= amplitude:
        angle = math.acos(np.clip(-offset / amplitude, -1, 1))
        for sign in (1, -1):
            theta = -np.angle(coefficient) + sign * angle
            t = center + radius * np.exp(1j * theta)
            z = np.empty(6, dtype=complex)
            z[1] = t
            z[keep] = b - u * t
            solutions.append([[float(v.real), float(v.imag)] for v in z])

    # Any perturbation bounded by eps in every complex gauge changes the two
    # crossed coefficients by at most their inverse-row 1-norms times eps,
    # plus the backward bound term. Eliminate t using the first equality.
    row_gain = np.sum(np.abs(inverse), axis=1)
    cross_multiplier = abs(u[3]) + ratio * abs(u[4])
    t_factor = rho / (1 - rho * abs(u[0]))
    residual = abs(abs(b[3]) - ratio * abs(b[4]))
    intercept = residual - cross_multiplier * t_factor * abs(b[0])
    slope = row_gain[3] + ratio * row_gain[4] + cross_multiplier * t_factor * row_gain[0]

    author = A[:, [0, 2, 3]]
    author_fit = np.linalg.lstsq(author, y, rcond=None)[0]
    return {
        "gamma_modulus": float(rho),
        "cross_reverse_ratio": float(ratio),
        "first_circle_center_m": [float(center.real),float(center.imag)],
        "first_circle_radius_m": float(radius),
        "second_squared_residual_range_m2": [float(lower), float(upper)],
        "nominal_compatible": bool(lower <= 0 <= upper),
        "degenerate_constant_residual": bool(amplitude == 0),
        "nondegenerate_solutions": solutions,
        "required_complex_gauge_perturbation_lower_m": float(max(0, intercept) / slope),
        "zero_back_bound_coefficients_m": [[float(v.real),float(v.imag)] for v in b],
        "author_three_coefficients_m": [[float(v.real),float(v.imag)] for v in author_fit],
        "author_three_gauge_residuals_m": [float(abs(v)) for v in author @ author_fit - y],
    }


def self_check():
    x = POSITIONS["center"]
    periods = (10.54, 11.85)
    r_low, r_high = .001, .029
    A = matrix((np.array(x) - PIVOT) * SCALE, modes(*periods)).conj()
    low = r_low * np.exp(.4j)
    high = r_high * np.exp(-.8j)
    forward = .019 + .012j
    cross = .25 - .18j
    exact = np.array([forward, forward*high*low.conjugate(), .03+.02j,
                      -.005+.01j, cross*low.conjugate(), cross*high])
    result = compatibility(x, A @ exact, periods, r_low, r_high)
    assert result["nominal_compatible"] and result["required_complex_gauge_perturbation_lower_m"] == 0
    assert min(np.max(np.abs(np.array([complex(*s) for s in sol]) - exact))
               for sol in result["nondegenerate_solutions"]) < 1e-10
    bad = exact.copy()
    bad[4] += .1
    result = compatibility(x, A @ bad, periods, r_low, r_high)
    assert not result["nominal_compatible"]
    assert 0 < result["required_complex_gauge_perturbation_lower_m"] <= .10000000001
    # With exactly zero low-frequency reflection, both mirrored co-bound and
    # forward-cross coefficients vanish. The unique square solution qualifies.
    first = np.array([1+.2j, 0, .1+.03j, -.2j, 0, .12-.07j])
    answer = compatibility(x, A @ first, periods, 0, r_high)
    assert answer["degenerate_constant_residual"]
    assert answer["required_complex_gauge_perturbation_lower_m"] < 1e-12
