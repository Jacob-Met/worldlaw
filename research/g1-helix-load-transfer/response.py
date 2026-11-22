"""Frozen complex response fits for two fixed-frame hub moment components."""
import numpy as np


def unpack(array):
    v = np.asarray(array, dtype=float)
    if v.shape[-1] != 2 or not np.isfinite(v).all():
        raise ValueError("Invalid complex-vector encoding")
    return v[..., 0] + 1j * v[..., 1]


def pack(array):
    return np.stack([np.real(array), np.imag(array)], axis=-1).tolist()


def response_fits(training, test):
    """Use each training run once. Equivalent complex gain LS equalizes input norms."""
    u = np.transpose([unpack(r["u"]) for r in training])
    y = np.transpose([unpack(r["y"]) for r in training])
    held = np.transpose([unpack(r["u"]) for r in test])
    if u.shape[0] != 2 or u.shape != y.shape or held.shape[0] != 2:
        raise ValueError("Response requires two-component forcing and output vectors")
    gain = np.linalg.norm(u, axis=0)
    target_gain = np.linalg.norm(held, axis=0)
    if np.min(gain) < .1 or np.min(target_gain) < .1:
        raise ValueError("Weak measured forcing")
    forecasts = {}
    diagnostic = {}
    for name, power, equal in (
        ("common_equal_gain", 0, True),
        ("common_absolute", 0, False),
        ("affine_gain", 1, True),
        ("cubic_gain", 2, True),
    ):
        x, xt = u, held
        if power:
            gamma = gain ** power
            mean, spread = np.mean(gamma), np.std(gamma)
            if spread < 1e-6:
                raise ValueError("Excitation amplitudes do not span model")
            x = np.vstack([u, u * ((gamma - mean) / spread)])
            xt = np.vstack([held, held * ((target_gain ** power - mean) / spread)])
        weights = 1 / gain if equal else np.ones_like(gain)
        coeff_t, _, rank, s = np.linalg.lstsq((x * weights).T, (y * weights).T, rcond=1e-10)
        condition = float(s[0] / s[-1])
        if rank != x.shape[0] or condition > 100:
            raise ValueError(f"Unqualified measured basis: {name} {rank} {condition}")
        prediction = coeff_t.T @ xt
        forecasts[name] = {str(r['case']):pack(prediction[:, i]) for i, r in enumerate(test)}
        diagnostic[name] = {"rank":int(rank), "singular_values":s.tolist(), "condition":condition,
                            "fit_rows":len(training), "complex_coefficients":pack(coeff_t.T)}
    return forecasts, diagnostic
