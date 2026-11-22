"""Target-informed differential preprocessing from the 2022 paper, with explicit numerical choices."""

import numpy as np
from scipy.optimize import minimize_scalar


def squared_error(reference, target):
    residual = reference - target
    return np.mean(residual * residual, dtype=np.float64)


def grid_minimum(objective, grid):
    scores = np.asarray([objective(value) for value in grid])
    index = int(np.argmin(scores))
    left, right = grid[max(0, index - 1)], grid[min(index + 1, len(grid) - 1)]
    result = minimize_scalar(objective, bounds=(left, right), method="bounded",
                             options={"xatol": 1e-10})
    return min([(float(grid[index]), float(scores[index])), (float(result.x), float(result.fun))],
               key=lambda pair: (pair[1], pair[0]))


def fit_author_procedure(bank, target, sampling_hz, carrier_hz):
    """Use all observed target samples for RMSE, with no target-dependent cropping."""
    bank = np.asarray(bank, np.float64)
    target = np.asarray(target, np.float64)
    if bank.ndim != 2 or target.shape != bank.shape[1:] or len(bank) == 0:
        raise ValueError("invalid reference bank or target shape")
    if not np.all(np.isfinite(bank)) or not np.all(np.isfinite(target)):
        raise ValueError("nonfinite received trace")
    index = int(np.argmin([squared_error(trace, target) for trace in bank]))
    reference = bank[index]
    ticks = np.arange(len(target), dtype=float)
    def dilate(factor):
        return np.interp(ticks / factor, ticks, reference, left=0., right=0.)
    factor, _ = grid_minimum(lambda s: squared_error(dilate(s), target),
                             np.linspace(.95, 1.05, 201))
    stretched = dilate(factor)
    def translate(shift):
        return np.interp(ticks - shift, ticks, stretched, left=0., right=0.)
    radius = sampling_hz / carrier_hz
    shift, _ = grid_minimum(lambda d: squared_error(translate(d), target),
                            np.linspace(-radius, radius, 201))
    translated = translate(shift)
    norm = np.dot(translated, translated)
    amplitude = max(0., np.dot(translated, target) / norm) if norm else 0.
    fitted = translated * amplitude
    return {"reference": index, "factor": factor, "shift_samples": shift,
            "amplitude": float(amplitude)}, (reference, stretched, translated, fitted)


if __name__ == "__main__":
    t = np.arange(3500)
    x = np.sin(t * .059) * np.exp(-((t-1300)/430)**2)
    bank = np.stack([np.zeros_like(x), x, -x])
    exact, stages = fit_author_procedure(bank, x, 1e6, 4e4)
    assert exact["reference"] == 1 and all(np.array_equal(stage, x) for stage in stages)
    target = .86*x
    params, stages = fit_author_procedure(bank, target, 1e6, 4e4)
    errors = [squared_error(trace, target) for trace in stages]
    assert params["reference"] == 1 and max(np.diff(errors)) <= 1e-15
    assert abs(np.dot(stages[-2], target - stages[-1])) < 1e-10
    assert 0 < errors[-1] < .001*errors[0]
    print("identity and conditional amplitude projection passed", params, errors)
