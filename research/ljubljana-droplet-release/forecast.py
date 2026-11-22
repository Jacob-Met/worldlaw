"""Fit coupled contact and height-return laws from preimpact inputs only."""
import argparse
import hashlib
import json
import math
import time
from pathlib import Path

import numpy as np
from scipy.linalg import cho_factor, cho_solve
from scipy.optimize import least_squares, minimize
from scipy.spatial.distance import cdist
from scipy.special import expit

INPUT_SHA = "32f306184b5853470539c962c6c7e7db69c8a26c607fa07202fd7382ad3a792b"
FIT_SHA = "fa309985f359a92edf3f6eafa23f90413fa6c90313511003e9ab873cd95c5150"
G = 9.80665


def verified(path, digest):
    content = Path(path).read_bytes()
    if hashlib.sha256(content).hexdigest() != digest:
        raise ValueError("source projection differs")
    return json.loads(content)


def physical_inputs(x):
    d, u, rho, sigma, mu, pitch, depth = x.T
    r = d / 2
    tau = np.sqrt(rho * r**3 / sigma)
    oh = mu / np.sqrt(rho * sigma * r)
    we = rho * u**2 * r / sigma
    p = np.log(pitch / 200)
    h = (depth - 6) / 19
    frequency = np.column_stack((np.ones(len(x)), p, h, p * h))
    damping = np.column_stack((frequency, np.log(oh / .1), np.log(we / 10)))
    height = G * d / u**2
    return tau, frequency, damping, height


def coupled_response(x, coef, release):
    tau, frequency, damping, height = physical_inputs(x)
    omega = np.exp(np.clip(frequency @ coef[:4], -12, 12)) / tau
    zeta = .001 + .998 * expit(damping @ coef[4:10])
    # The angle at force release approaches zero smoothly as damping approaches one.
    theta = 2 * np.arccos(zeta) if release == "force" else np.pi
    duration = theta / (omega * np.sqrt(1 - zeta**2))
    normal_velocity_ratio = np.exp(-zeta * omega * duration)
    eta = normal_velocity_ratio**2 + coef[10] * height
    return np.column_stack((duration, eta))


def fit_coupled(x, y, fit, release):
    train, target = x[fit], y[fit]
    scales = np.std(target, axis=0, ddof=1)
    def residual(c):
        return ((coupled_response(train, c, release) - target) / scales).ravel()
    lower = [-6] * 4 + [-12] * 4 + [0, -6, 0]
    upper = [6] * 4 + [12] * 4 + [6, 6, 2]
    results = []
    for damping_intercept in (-2., 0., 2.):
        c = np.zeros(11)
        c[[0, 4, 8, 10]] = [0., damping_intercept, .2, .5]
        result = least_squares(residual, c, bounds=(lower, upper), max_nfev=600,
                               ftol=1e-10, xtol=1e-10, gtol=1e-10)
        results.append(result)
    best = min(results, key=lambda result: result.cost)
    return coupled_response(x, best.x, release), {
        "params": best.x.tolist(), "train_scales": scales.tolist(),
        "starts": [[r.status, r.nfev, float(r.cost)] for r in results]}


def fit_gp(x, y, fit):
    train = x[fit]
    average, std = train.mean(axis=0), train.std(axis=0, ddof=1)
    features = (x - average) / np.where(std > 0, std, 1)
    distances = cdist(features[fit], features[fit])
    transfer = cdist(features, features[fit])
    target = y[fit]
    def calculate(params, predict=False):
        length, nugget = np.exp(params)
        kernel = np.exp(-distances / length)
        kernel.flat[::len(kernel) + 1] += nugget
        factor = cho_factor(kernel, check_finite=False)
        k_inv_one = cho_solve(factor, np.ones(len(target)), check_finite=False)
        intercept = k_inv_one @ target / np.sum(k_inv_one)
        error = target - intercept
        alpha = cho_solve(factor, error, check_finite=False)
        variance = max(float(error @ alpha) / len(target), 1e-24)
        if predict:
            return intercept + np.exp(-transfer / length) @ alpha, [length, nugget, intercept, variance]
        return len(target) * np.log(variance) + 2 * np.log(np.diag(factor[0])).sum()
    attempts = [minimize(calculate, np.log([l, n]), method="L-BFGS-B",
                         bounds=[(np.log(.03), np.log(80)), (np.log(1e-6), np.log(20))],
                         options={"maxiter": 90, "ftol": 1e-10}) for l, n in ((.5,.05),(2,.2),(8,.02))]
    best = min(attempts, key=lambda r: r.fun)
    pred, params = calculate(best.x, True)
    return pred, {"length_nugget_intercept_variance": list(map(float, params)),
                  "runs": [[bool(r.success), int(r.nfev), float(r.fun)] for r in attempts]}


def forecasts(records, targets):
    rows = [r for r in records if r["file"] == "01"]
    x = np.array([r["x"] for r in rows])
    train = np.array([r["split"] == "train" for r in rows])
    y = np.full((len(rows), 2), np.nan)
    for i in np.flatnonzero(train):
        y[i] = targets[str(rows[i]["line"])]
    if len(targets) != train.sum() or train.sum() != 748 or not np.isfinite(y[train]).all():
        raise ValueError("training roster/availability differs from its frozen projection")
    controls = {}
    arms = {}
    for release in ("force", "deformation"):
        arms[release], controls[release] = fit_coupled(x, y, train, release)
    tau, frequency, damping, height = physical_inputs(x)
    physical_gp = np.column_stack((np.log(tau), damping[:, 1:], np.log(height)))
    for name, features, normalized in (("author_ie_gp", x, False), ("dimensionless_ie_gp", physical_gp, True)):
        response = y.copy()
        if normalized:
            response[:, 0] /= tau
        pred, fit_receipts = [], []
        for j in (0,1):
            value, receipt = fit_gp(features, response[:,j], train)
            pred.append(value * tau if normalized and j == 0 else value)
            fit_receipts.append(receipt)
        arms[name] = np.column_stack(pred)
        controls[name] = fit_receipts
    mean_t = float(np.mean(y[train,0] / tau[train]))
    mean_eta = float(np.mean(y[train,1]))
    arms["capillary_clock_mean_energy"] = np.column_stack((mean_t*tau,np.full(len(x),mean_eta)))
    # All 748 source training entries contain both fields. This is file availability,
    # independent of the physical rebound status. No row-level event labels exist in the manifest.
    p_present = (train.sum()+.5)/(train.sum()+1)
    return {"source": [INPUT_SHA,FIT_SHA], "fit_receipts": controls, "training_n": int(train.sum()),
            "file_availability_forecast": float(p_present),
            "reference_without_targets": sum(r["file"] == "02" for r in records),
            "rows": [{"line":r["line"], "surface":r["material"], "split":r["split"],
                      "pred":{k:v[i].tolist() for k,v in arms.items()}} for i,r in enumerate(rows)]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("inputs")
    ap.add_argument("training")
    ap.add_argument("output")
    args = ap.parse_args()
    start = time.monotonic()
    product = forecasts(verified(args.inputs,INPUT_SHA),verified(args.training,FIT_SHA))
    data = (json.dumps(product,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()
    Path(args.output).write_bytes(data)
    print(json.dumps({"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"seconds":time.monotonic()-start,
                      "training":product["training_n"],"rows":len(product["rows"]),"fits":product["fit_receipts"]}))
