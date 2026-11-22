"""Registered affine quadratic Gram estimator for the CED voltage histories."""

import numpy as np
from scipy.interpolate import BSpline
from scipy.linalg import cho_factor, cho_solve


def filtered_history(voltage):
    lags = np.arange(1, 61)
    knots = [1] * 4 + [3, 5, 8, 12, 18, 26, 38, 50] + [60] * 4
    basis = BSpline.design_matrix(lags, knots, 3).toarray()
    basis /= basis.sum(axis=0)
    delayed = np.stack([np.r_[np.zeros(lag), voltage[:-lag]] for lag in lags], axis=1)
    return delayed @ basis


def quadratic_features(history, mean, scale):
    coordinates = np.column_stack([np.ones(len(history)), (history - mean) / scale])
    i, j = np.triu_indices(coordinates.shape[1])
    return coordinates[:, i] * coordinates[:, j] * np.where(i == j, 1., np.sqrt(2))


def fit(features, measured):
    """Fit squared error plus 0.01 times the trace with a free intercept."""
    mean_row = features.mean(axis=0)
    mean_value = measured.mean()
    centered = features - mean_row
    gram = centered.T @ centered / len(features)
    target = centered.T @ (measured - mean_value) / len(features)
    rho = .2
    solver = cho_factor(gram + rho * np.eye(len(target)), lower=True)
    projected = np.zeros_like(target)
    dual = np.zeros_like(target)
    i, j = np.triu_indices(13)
    factors = np.where(i == j, 1., np.sqrt(2))
    for _ in range(18000):
        estimate = cho_solve(solver, target + rho * (projected - dual))
        matrix = np.empty((13, 13))
        matrix[i, j] = (estimate + dual) / factors
        matrix[j, i] = matrix[i, j]
        eigenvalues, vectors = np.linalg.eigh(matrix)
        psd = (vectors * np.maximum(0., eigenvalues - .01 / rho)) @ vectors.T
        previous = projected
        projected = psd[i, j] * factors
        dual += estimate - projected
        if max(np.linalg.norm(estimate - projected), rho * np.linalg.norm(projected - previous)) < 3e-8:
            break
    else:
        raise RuntimeError("The registered solver did not converge")
    return projected, mean_value - mean_row @ projected


def check_refit(recordings, evidence):
    inputs = [np.asarray(recordings[name]) for name in ("u11", "u12")]
    histories = [filtered_history(voltage) for voltage in inputs]
    training = np.vstack([h[60:400] for h in histories])
    mean, scale = training.mean(axis=0), training.std(axis=0)
    features = [quadratic_features(h, mean, scale) for h in histories]
    measured = np.concatenate([recordings["z11"][60:400], recordings["z12"][60:400]])
    coefficients, intercept = fit(np.vstack([x[60:400] for x in features]), measured)
    largest = 0.
    for index, voltage in enumerate(inputs):
        warm = features[index][400:] @ coefficients + intercept
        cold_features = quadratic_features(filtered_history(voltage[400:]), mean, scale)
        cold = cold_features @ coefficients + intercept
        for mode, estimate in (("warm", warm), ("cold", cold)):
            frozen = np.asarray(evidence["series"]["psd"][index][mode])
            largest = max(largest, float(np.max(np.abs(frozen - estimate))))
    if largest > 1e-8:
        raise ValueError(f"The all-training refit differs by {largest} ticks/s")
    return largest
