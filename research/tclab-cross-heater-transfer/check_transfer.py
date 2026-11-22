"""Verify the locked forecasts and independently replay the fitted heat balances."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile

import numpy as np
from scipy.integrate import solve_ivp


AUTHOR_SHA256 = "4cb422489a5396e8e4d156fc7b00f89e4bd7cb9a83561aacbbeee046d6c182ed"
FORECAST_SHA256 = "e2c8cf1acab7646e1401c21857ac1ccd1f9536244af4fec69b2d21d18e3d6cb9"
MEMBER = "1_Model/2_Heaters/validation.csv"
ROLES = (
    "paper_energy_gekko", "paper_energy_rk4", "tied_refit", "split",
    "decoupled_refit", "paper_arx_native", "paper_arx_matched", "paper_ann_matched",
    "split_cross_off", "split_swap", "split_delay30", "initial_hold",
)
PARAMETERS = {
    "paper_energy_rk4": [
        5.5992939361,
        5.5992939361,
        20.378532582,
        0.01295874691,
        0.0060915026081,
        20.679715136,
        20.679715136
    ],
    "tied_refit": [
        5.5459023900209905,
        5.5459023900209905,
        20.484661098569727,
        0.012915937117313286,
        0.006052924920503081,
        20.67256468430198,
        20.67256468430198
    ],
    "split": [
        5.708999813652838,
        4.889600474351112,
        16.986746372993913,
        0.012855803993426364,
        0.00591426891708681,
        21.477309714289216,
        16.45813789915174
    ],
    "decoupled_refit": [
        5.414518933737235,
        2.4954566533230453,
        5.414518933737235,
        0.0111238264253449,
        0.006402931937259064,
        16.20305981221016,
        5.000000000000001
    ]
}


def read_checked(path, expected):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"Input failed SHA-256 verification: {path.name}")
    return data


def integrate(times, commands, y0, coefficients, coupling):
    """Integrate each constant-command interval with an independent adaptive solver."""
    u1, u2, us, gain1, gain2, lag1, lag2 = coefficients
    sensor = np.empty((len(times), 2))
    state = np.concatenate([y0, y0])
    sensor[0] = y0
    start = 1
    while start < len(times):
        end = start + 1
        while end < len(times) and np.array_equal(commands[end], commands[start]):
            end += 1
        heat1, heat2 = commands[start]

        def rate(_, v):
            body1, body2, sensor1, sensor2 = v
            k1, k2, room = body1 + 273.15, body2 + 273.15, 296.15
            radiation = 0.9 * 5.67e-8
            flux = 0.0002 * (us * (k2 - k1) + radiation * (k2**4 - k1**4))
            if not coupling:
                flux = 0.0
            left = 0.001 * (u1 * (room - k1) + radiation * (room**4 - k1**4))
            right = 0.001 * (u2 * (room - k2) + radiation * (room**4 - k2**4))
            return [(left + gain1 * heat1 + flux) / 2, (right + gain2 * heat2 - flux) / 2,
                    (body1 - sensor1) / lag1, (body2 - sensor2) / lag2]

        sol = solve_ivp(rate, (times[start - 1], times[end - 1]), state,
                        t_eval=times[start:end], rtol=1e-10, atol=1e-11, method="DOP853")
        if not sol.success:
            raise RuntimeError(sol.message)
        sensor[start:end] = sol.y[2:].T
        state = sol.y[:, -1]
        start = end
    return sensor


def receive(author_zip, forecasts):
    archive = read_checked(author_zip, AUTHOR_SHA256)
    bundle = read_checked(forecasts, FORECAST_SHA256)
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        with z.open(MEMBER) as handle:
            rows = list(csv.DictReader(io.TextIOWrapper(handle, encoding="ascii")))
    times = np.array([float(r["Time"]) for r in rows])
    commands = np.array([[float(r["H1"]), float(r["H2"])] for r in rows])
    truth = np.array([[float(r["T1"]), float(r["T2"])] for r in rows])
    counted = {}
    with np.load(io.BytesIO(bundle), allow_pickle=False) as bank:
        if set(bank.files) != set((*ROLES, "t", "q", "y0")):
            raise ValueError("Forecast roster differs")
        for key, expected in (("t", times), ("q", commands), ("y0", truth[0])):
            if not np.array_equal(bank[key], expected):
                raise ValueError(f"Data and forecast input disagree at {key}")
        for name in ROLES:
            pred = bank[name]
            if pred.shape != truth.shape or not np.isfinite(pred).all():
                raise ValueError(f"Invalid forecast in {name}")
            errors = [[abs(float(p) - float(y)) for p, y in zip(a, b)]
                      for a, b in zip(pred, truth)]
            mae = math.fsum(x for pair in errors for x in pair) / (2 * len(rows))
            reverse = math.fsum(pair[0] for pair in errors[10:60]) / 50
            i, k = max(((i, k) for i in range(len(rows)) for k in range(2)),
                       key=lambda ix: errors[ix[0]][ix[1]])
            counted[name] = {"mae_c": mae, "reverse_sensor1_mae_c": reverse,
                             "worst": [i, k + 1, float(truth[i, k]), float(pred[i, k])]}
        for name, params in PARAMETERS.items():
            replay = integrate(times, commands, truth[0], params, name != "decoupled_refit")
            difference = float(np.max(np.abs(replay - bank[name])))
            counted[name]["independent_max_difference_c"] = difference
            if difference > 1e-4:
                raise ValueError(f"Independent thermal integration differs at {name}: {difference}")
    candidate = counted["split"]
    qualifies = all(counted[b]["mae_c"] - candidate["mae_c"] > 0.05
                    and counted[b]["reverse_sensor1_mae_c"] > candidate["reverse_sensor1_mae_c"]
                    for b in ("paper_energy_gekko", "tied_refit"))
    return {"rows": len(rows), "roles": counted, "qualifies": qualifies}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("author_zip", type=Path)
    parser.add_argument("forecasts", type=Path)
    args = parser.parse_args()
    print(json.dumps(receive(args.author_zip, args.forecasts), indent=2))
