"""Target-free prediction of steady normal stress from linear spectra and flow curves."""

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.optimize import linprog


def matched_spectra(dynamic, temperature):
    """Direct at 0/50 C, interpolate pointwise log modulus halfway at 25 C."""
    low, high = (20, 30) if temperature == 25 else (temperature, temperature)
    omega, gp, gpp = (np.asarray(v, float) for v in dynamic[str(low)])
    other_omega, other_gp, other_gpp = (np.asarray(v, float) for v in dynamic[str(high)])
    if np.any(omega <= 0) or np.any(np.diff(omega) <= 0):
        raise ValueError("unsorted or nonpositive angular frequencies")
    if not np.array_equal(omega, other_omega):
        raise ValueError("interpolation requires matched frequency coordinates")
    if min(gp.min(), gpp.min(), other_gp.min(), other_gpp.min()) <= 0:
        raise ValueError("positive moduli required")
    return omega, np.sqrt(gp * other_gp), np.sqrt(gpp * other_gpp)


def interpolate_log(x, y, evaluation, low_power, high_power):
    order = np.argsort(x)
    x, y = np.log(x[order]), np.log(y[order])
    q = np.log(evaluation)
    result = np.interp(q, x, y)
    result += low_power * np.minimum(q - x[0], 0)
    result += high_power * np.maximum(q - x[-1], 0)
    return np.exp(result)


def slope_controls(rates, viscosity):
    """Flow-curve slope, constrained to Steller's monotone/shear-thinning domain."""
    x = np.log(rates)
    tau = rates * viscosity
    slope = PchipInterpolator(x, np.log(tau)).derivative()(x)
    n = np.clip(slope, 1e-8, 1.0)
    return {
        "steller17": 12 * tau * np.sqrt(1 - n) / (1 + n) ** 4,
        "steller26": 14 * tau * (1 - n) / (1 + 6 * n),
        "sharma_mckinley": 2 * tau * np.sqrt(1 - n**2) * n ** -1.4,
        "wagner_slope": 3 * tau * (1 - n),
    }, slope


def kernels(omega, rates, relaxation, damping):
    """Memory modes exp(-t/lambda) with strain damping exp(-b*gamma*t)."""
    lam, b = np.meshgrid(relaxation, damping, indexing="ij")
    lam, b = lam.ravel(), b.ravel()
    w = omega[:, None] * lam
    z = rates[:, None] * lam
    a = 1 + b * z
    storage = w**2 / (1 + w**2)
    loss = w / (1 + w**2)
    viscosity = lam / a**2
    n1 = 2 * z**2 / a**3
    # Last coefficient is a Newtonian background viscosity in Pa s.
    return (np.column_stack((storage, np.zeros(len(omega)))),
            np.column_stack((loss, omega)), np.column_stack((viscosity, np.ones(len(rates)))),
            np.column_stack((n1, np.zeros(len(rates)))))


def solve_envelope(omega, gp, gpp, rates, viscosity, relaxation=None, damping=None):
    if relaxation is None:
        relaxation = np.geomspace(1e-4, 1e3, 36)
    if damping is None:
        damping = np.array([0, .01, .03, .1, .3, 1, 3])
    storage, loss, visc, normals = kernels(omega, rates, relaxation, damping)
    obs = np.concatenate((gp, gpp, viscosity))
    design = np.vstack((storage, loss, visc)) / obs[:, None]
    scale = design.max(axis=0)
    design = design / scale
    normals = normals / scale
    objective = np.zeros(design.shape[1] + 1)
    objective[-1] = 1.
    both = np.vstack((design, -design))
    rhs = np.r_[np.ones(len(obs)), -np.ones(len(obs))]
    minimax = linprog(objective, A_ub=np.column_stack((both, -np.ones(len(rhs)))),
                      b_ub=rhs, bounds=(0, None), method="highs")
    if not minimax.success:
        raise ValueError(minimax.message)
    residual = np.abs(design @ minimax.x[:-1] - 1)
    best = float(max(minimax.fun, residual.max()))
    tolerance = max(.08, 1.10 * best) + 1e-7
    lo, hi = [], []
    for c in normals:
        ends = []
        for sign in (1., -1.):
            result = linprog(sign * c / c.max(), A_ub=both, b_ub=rhs + tolerance,
                             bounds=(0, None), method="highs")
            if not result.success or (both @ result.x - rhs - tolerance).max() > 5e-6:
                raise ValueError("invalid conditional endpoint " + result.message)
            ends.append(float(c @ result.x))
        lo.append(ends[0])
        hi.append(ends[1])
    lo, hi = np.asarray(lo), np.asarray(hi)
    if (lo < -1e-7).any() or (lo > hi + 1e-5).any():
        raise ValueError("inconsistent numerical endpoints")
    return {"minimax": normals @ minimax.x[:-1], "conditional_lower": lo,
            "conditional_upper": hi, "conditional_midpoint": (lo + hi) / 2,
            "minimum_relative_input_error": best, "relative_tolerance": tolerance,
            "max_input_residual_by_channel": [float(a.max()) for a in
              np.split(residual, [len(omega), 2 * len(omega)])]}


def predict(dynamic, temperature, rates, viscosity):
    rates, viscosity = np.asarray(rates), np.asarray(viscosity)
    if np.any(np.diff(rates) <= 0) or min(rates.min(), viscosity.min()) <= 0:
        raise ValueError("positive strictly ordered source rates and positive viscosity required")
    w, gp, gpp = matched_spectra(dynamic, temperature)
    controls, slope = slope_controls(rates, viscosity)
    gp_at = interpolate_log(w, gp, rates, 2, 0)
    gpp_at = interpolate_log(w, gpp, rates, 1, 0)
    # Steller describes polynomial regression in log shear stress but gives no
    # unique order for these six curves. Leave out one torque row at a time.
    x, y = np.log(rates), np.log(rates * viscosity)
    candidates = []
    for degree in range(2, 6):
        residuals = []
        for idx in range(len(x)):
            keep = np.arange(len(x)) != idx
            model = np.polynomial.Polynomial.fit(x[keep], y[keep], degree)
            residuals.append(float(model(x[idx]) - y[idx]))
        candidates.append((np.mean(np.square(residuals)), degree))
    order = min(candidates)[1]
    curve = np.polynomial.Polynomial.fit(x, y, order)
    poly_slope = curve.deriv()(x)
    n = np.clip(poly_slope, 1e-8, 1.)
    controls["steller17_polynomial"] = 12 * rates * viscosity * np.sqrt(1 - n) / (1 + n)**4
    controls["steller26_polynomial"] = 14 * rates * viscosity * (1 - n) / (1 + 6*n)
    controls["laun"] = 2 * gp_at * (1 + (gp_at / gpp_at)**2)**.7
    return {**solve_envelope(w, gp, gpp, rates, viscosity), **controls,
            "unconstrained_local_slope": slope, "polynomial_slope": poly_slope, "torque_only_polynomial_order": order, "extrapolated_saos": (rates < w.min()) | (rates > w.max())}
