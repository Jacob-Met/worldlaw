"""Frozen transfer functions for a recorded twenty-panel series string.

The target is the simultaneous array-minus-selected-panel voltage. Site irradiance
and one surface temperature stand in for the unobserved nineteen panel states.
"""
import numpy as np
from scipy.optimize import least_squares
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.isotonic import IsotonicRegression


def inverse_profile(current, voltage):
    order = np.argsort(current, kind='stable')
    indices = np.array_split(order, min(len(order), 97))
    x = np.array([np.median(current[i]) for i in indices])
    y = np.array([np.median(voltage[i]) for i in indices])
    x, inv = np.unique(x, return_inverse=True)
    y = np.bincount(inv, weights=y) / np.bincount(inv)
    y = IsotonicRegression(increasing=False).fit_transform(x, y)
    return x, y


def fit_components(calibrations):
    components = {}
    for panel, curves in calibrations.items():
        profiles = []
        samples = []
        for current, voltage, irr, temp in curves:
            x, y = inverse_profile(current, voltage)
            profiles.append((x, y, irr))
            samples.append((x, y, np.full(len(x), irr), np.full(len(x), temp)))
        current, voltage, irr, temp = [np.concatenate(parts) for parts in zip(*samples)]

        def current_residual(p):
            iph, log_i0, rs, log_rsh, a, beta = p
            diode_v = voltage + current * rs
            nvt = a * (temp + 273.15) / 316.15
            predicted = (iph * irr / 1000.0
                         - np.exp(log_i0 + beta * (temp - 43.0)) * np.expm1(np.clip(diode_v / nvt, -65., 65.))
                         - diode_v / np.exp(log_rsh))
            return predicted - current

        opt = least_squares(current_residual, [.15, -18., 1., 5., .40, .04],
                            bounds=([.002, -40., 0., 0., .12, -.15],
                                    [.5, -4., 50., 12., 2., .30]),
                            loss='soft_l1', f_scale=.006, max_nfev=300)
        components[panel] = (profiles, opt.x, opt.nfev, opt.status)
    return components


def component_voltage(current, irr, temp, component, bishop):
    profiles, p, _, _ = component
    weights = np.array([1. / (.15 + abs(np.log(irr / g)))**2 for _, _, g in profiles])
    curves = [np.interp(current * g / irr, x, y) for x, y, g in profiles]
    empirical = np.average(curves, axis=0, weights=weights)
    iph, log_i0, rs, log_rsh, a, beta = p
    # Explicit numerical approximation on a fixed diode-voltage domain. The
    # authenticated Bishop entry point uses its zero-avalanche limiting model.
    grid = np.linspace(-12., 9., 2101)
    ig, vg, _ = bishop(grid, iph * irr / 1000., np.exp(log_i0 + beta * (temp - 43.)),
                       rs, np.exp(log_rsh), a * (temp + 273.15) / 316.15,
                       breakdown_factor=0., breakdown_voltage=-np.inf)
    physical = np.interp(current, ig[::-1], vg[::-1])
    return np.array([empirical, physical])


def primary_and_controls(components, panel, current, irr, temp, bishop):
    by_panel = {j: component_voltage(current, irr, temp, v, bishop)
                for j, v in components.items()}
    typical = np.mean(list(by_panel.values()), axis=0)
    # Panel 4 has no Test 1 light curve. It is selected (and removed) in the
    # final three runs. Calibration on other runs imputes only its contribution.
    selected = by_panel.get(panel, typical)
    total = sum(by_panel.values()) + typical - selected
    return total[0], total[1], 19. * typical[0]


def acquisition_features(current, irr, temp, condition):
    # All arms see the same raw current and sweep fraction. No voltage, predicted
    # MPP, selected probe, array voltage or separately smoothed current is used.
    n = len(current)
    x = np.arange(n) / max(1, n - 1)
    prev = np.r_[current[0], current[:-1]]
    return np.column_stack((current, current / irr * 1000., x, current - prev,
                            np.full(n, irr), np.full(n, temp),
                            np.full(n, condition == 'S1'), np.full(n, condition == 'S2')))


def estimator():
    return HistGradientBoostingRegressor(learning_rate=.075, max_iter=160,
                                         max_leaf_nodes=24, min_samples_leaf=35,
                                         l2_regularization=1., early_stopping=False,
                                         random_state=241122)
