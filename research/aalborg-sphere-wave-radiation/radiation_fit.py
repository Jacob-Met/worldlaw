"""Finite-memory causal map from vertical motion to the three wave gauges."""
import numpy as np

RADIUS = 0.15
DT = 0.002
MEMORY_ROWS = 2280
MODEL_FAMILIES = ("constant_area", "cap_tied", "opposite_cubic", "free_pair", "free_asymmetric")
KNOT_STEPS = (40, 80)
RIDGES = (1.e-7, 1.e-4, 1.e-1)


def increments(x):
    return np.diff(x, prepend=x[0])


def lag_basis(q, step):
    """Triangular finite impulse-response basis at integer multiples of step."""
    n = len(q)
    columns = [np.convolve(q, np.arange(step, 0, -1) / step)[:n]]
    triangle = 1 - np.abs(np.arange(-step, step + 1) / step)
    regular = np.convolve(q, triangle)[:n]
    for centre in range(step, MEMORY_ROWS + 1, step):
        offset = centre - step
        column = np.zeros(n)
        if offset >= n:
            columns.append(column)
            continue
        keep = min(n - offset, MEMORY_ROWS - offset + 1)
        if centre + step <= MEMORY_ROWS:
            column[offset:] = regular[:n-offset]
        else:
            short_kernel = triangle[:keep]
            column[offset:] = np.convolve(q, short_kernel)[:n-offset]
        columns.append(column)
    return np.column_stack(columns)


def basis_cache(z, step):
    x = z / RADIUS
    s = np.clip(x, -1., 1.)
    return {
        "linear": lag_basis(increments(x), step),
        "s": lag_basis(increments(s), step),
        "s2": lag_basis(increments(s**2), step),
        "s3": lag_basis(increments(s**3), step),
    }


def matrix(b, family):
    if family == "constant_area":
        return b["linear"]
    if family == "cap_tied":
        return b["s"] - b["s3"] / 3
    if family == "opposite_cubic":
        return b["s"] + b["s3"] / 3
    if family == "free_pair":
        return np.column_stack((b["s"], b["s3"]))
    if family == "free_asymmetric":
        return np.column_stack((b["linear"], b["s2"], b["s3"]))
    raise ValueError(family)


def fit_all(x, target):
    """Column-RMS scaling and per-gauge intercept use training rows only."""
    avg = x.mean(axis=0)
    ymean = target.mean(axis=0)
    x0 = x - avg
    scale = np.sqrt(np.mean(x0**2, axis=0))
    scale[scale < 1e-12] = 1.
    x0 /= scale
    gram = x0.T @ x0 / len(x0)
    rhs = x0.T @ (target - ymean) / len(x0)
    for ridge in RIDGES:
        beta = np.linalg.solve(gram + ridge*np.eye(len(gram)), rhs) / scale[:,None]
        yield ridge, (ymean - avg @ beta), beta


def heldout_development(low, mid):
    scores = {}
    dev_y = mid[:,:,1:]
    for step in KNOT_STEPS:
        source = [basis_cache(x[:,0], step) for x in low]
        future = [basis_cache(x[:,0], step) for x in mid]
        for family in MODEL_FAMILIES:
            train_x = np.vstack([matrix(b, family) for b in source])
            future_x = np.vstack([matrix(b, family) for b in future])
            for ridge, intercept, beta in fit_all(train_x, np.vstack(low[:,:,1:])):
                pred = (future_x @ beta + intercept).reshape(dev_y.shape)
                diff = pred - dev_y
                per_gauge = np.sqrt(np.mean(diff**2,axis=(0,1)))
                i,t,g=np.unravel_index(np.abs(diff).argmax(),diff.shape)
                scores[(family,step,ridge)] = dict(
                    rms_m=float(np.sqrt(np.mean(diff**2))),
                    per_gauge_rms_m=per_gauge.tolist(),worst=dict(
                        rep=int(i)+1,time_s=float(t*DT),gauge=int(g)+1,
                        pred_m=float(pred[i,t,g]),obs_m=float(dev_y[i,t,g])),
                )
    return scores
