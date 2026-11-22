"""Fit a relative optical response on the fundamental and score two untouched orders."""

from pathlib import Path
import hashlib
import json
import sys

import numpy as np
from scipy.optimize import least_squares
from support import BANDS, F, N, FS, T, W, WP, inspect

ACTIVE = (F >= 80) & (F < 2560)
f = F[ACTIVE]
MASKS = [(f >= a) & (f < b) for a, b in BANDS]


def transform(kind, p):
    if kind == "gain":
        return np.ones_like(f, dtype=complex)
    tau_ms, *fc = p
    shift = np.exp(-2j * np.pi * f * tau_ms / 1000)
    if kind == "delay":
        return shift
    if kind == "pole":
        return shift / (1 + 1j * f / np.exp(fc[0]))
    fz, fp1, fp2 = np.exp(fc)
    return shift * (1 + 1j * f / fz) / ((1 + 1j * f / fp1) * (1 + 1j * f / fp2))


def fit(D, V, usable):
    weight = np.zeros_like(f)
    for yes, mask in zip(usable, MASKS):
        if yes:
            weight[mask] = 1 / np.linalg.norm(V[mask])
    fits = {}
    parameters = {}
    for kind, initial in [
        ("gain", [[]]),
        ("delay", [[]]),
        ("pole", [[90], [500], [3000]]),
        (
            "lead_two_poles",
            [
                [100, 400, 1800],
                [400, 100, 2500],
                [1700, 240, 6000],
                [6000, 100, 600],
                [80, 800, 8000],
                [350, 350, 350],
            ],
        ),
    ]:

        def eval_at(p):
            b = transform(kind, p) * D
            bw = weight * b
            gain = float(np.vdot(bw, weight * V).real / np.vdot(bw, bw).real)
            error = weight * (gain * b - V)
            return gain, np.concatenate((error.real, error.imag))

        if kind == "gain":
            bestp = []
            loss = float(np.linalg.norm(eval_at([])[1]))
            attempts = 1
        else:
            nf = len(initial[0])
            lower = [-2] + nf * [np.log(25)]
            upper = [2] + nf * [np.log(20000)]
            loss = float("inf")
            attempts = 0
            for t in np.linspace(-1.8, 1.8, 13):
                for starts in initial:
                    p0 = [t, *np.log(starts)]
                    run = least_squares(
                        lambda p: eval_at(p)[1],
                        p0,
                        bounds=(lower, upper),
                        ftol=1e-10,
                        xtol=1e-10,
                        gtol=1e-10,
                        max_nfev=320,
                    )
                    cost = float(np.linalg.norm(run.fun))
                    attempts += 1
                    if cost < loss:
                        loss = cost
                        bestp = run.x
        g = eval_at(bestp)[0]
        fits[kind] = g * transform(kind, bestp)
        parameters[kind] = {
            "gain": g,
            "delay_ms": float(bestp[0]) if len(bestp) else 0,
            "frequencies_Hz": np.exp(bestp[1:]).tolist(),
            "starts": attempts,
            "sum_normalized_squared_training_error": loss**2,
        }
    # Weighted local complex least squares. All reference frequencies come from H1.
    kernels = np.exp(-0.5 * (np.log2(f[:, None] / f[None, :]) / (1 / 6)) ** 2) * (
        weight[None, :] ** 2
    )
    fits["local_complex"] = (kernels @ (np.conj(D) * V)) / (kernels @ (abs(D) ** 2))
    return fits, parameters


def controls():
    # A non-bin-centred sinusoid with nonzero boundary values checks the finite-window term.
    freq = 729.67
    x = np.sin(2 * np.pi * freq * T + 0.39)
    v = 2 * np.pi * freq * np.cos(2 * np.pi * freq * T + 0.39)
    X = np.fft.rfft(W * x)
    V = np.fft.rfft(W * v)
    d = 2j * np.pi * F * X - np.fft.rfft(WP * x)
    err = np.linalg.norm((d - V)[ACTIVE]) / np.linalg.norm(V[ACTIVE])
    plain = np.linalg.norm((2j * np.pi * F * X - V)[ACTIVE]) / np.linalg.norm(V[ACTIVE])
    assert err < 1e-4 and plain > 100 * err, (err, plain)
    assert np.allclose(
        transform("lead_two_poles", [0.25, *np.log([100, 100, 600])]),
        transform("pole", [0.25, np.log(600)]),
    )
    return {
        "windowed_derivative_relative_rms": float(err),
        "omitting_boundary_term": float(plain),
    }


def run(path, clock):
    fixture = controls()
    data, support = inspect(path, clock)
    assert support["admitted"]
    observations = {
        k: {a: x[ACTIVE] for a, x in block.items()} for k, block in data.items()
    }
    train = observations["1"]
    h, params = fit(train["D"], train["V"], [r["usable"] for r in support["rows"]["1"]])
    rows = []
    means = {}
    archive = {"output_hz": f}
    for k, region in observations.items():
        V = region["V"]
        D = region["D"]
        archive["observed_order" + k] = V
        archive["derivative_order" + k] = D
        bymethod = {}
        for method, response in h.items():
            pred = response * D
            err = pred - V
            archive[k + "_" + method] = pred
            bandrows = []
            for b, mask in enumerate(MASKS):
                idx = np.flatnonzero(mask)
                index = int(idx[np.argmax(abs(err[idx]))])
                obs = V[index]
                point = pred[index]
                row = {
                    "order": int(k),
                    "band": BANDS[b],
                    "method": method,
                    "usable": support["rows"][k][b]["usable"],
                    "normalized_RMS": float(
                        np.linalg.norm(err[mask]) / np.linalg.norm(V[mask])
                    ),
                    "worst_absolute_bin": {
                        "output_Hz": float(f[index]),
                        "drive_Hz": float(f[index] / int(k)),
                        "observed": [float(obs.real), float(obs.imag)],
                        "predicted": [float(point.real), float(point.imag)],
                        "absolute_error": float(abs(err[index])),
                    },
                }
                rows.append(row)
                bandrows.append(row)
            act = [r["normalized_RMS"] for r in bandrows if r["usable"]]
            bymethod[method] = float(np.mean(act))
        means[k] = bymethod
    candidate = "lead_two_poles"
    base = [m for m in h if m != candidate]
    order_ratios = {
        k: means[k][candidate] / min(means[k][m] for m in base) for k in ("2", "3")
    }
    per_band = []
    for k in (2, 3):
        for b in BANDS:
            sub = [
                r for r in rows if r["order"] == k and r["band"] == b and r["usable"]
            ]
            if not sub:
                continue
            a = next(r["normalized_RMS"] for r in sub if r["method"] == candidate)
            comp = min(r["normalized_RMS"] for r in sub if r["method"] != candidate)
            per_band.append({"order": k, "band": b, "ratio": a / comp})
    return {
        "fixture": fixture,
        "support": support,
        "H1_parameters": params,
        "band_results": rows,
        "mean_normalized_RMS": means,
        "order_ratio_to_strongest": order_ratios,
        "band_ratio_to_strongest": per_band,
        "primary_pass": all(a <= 0.95 for a in order_ratios.values())
        and all(r["ratio"] <= 1.10 for r in per_band),
    }, archive


if __name__ == "__main__":
    path, clk, out, streams = map(Path, sys.argv[1:])
    result, archive = run(path, json.loads(clk.read_text()))
    np.savez_compressed(streams, **archive)
    for k, v in result["mean_normalized_RMS"].items():
        print("ORDER", k, v, flush=True)
    print(
        "RATIO",
        result["order_ratio_to_strongest"],
        result["band_ratio_to_strongest"],
        "PASS",
        result["primary_pass"],
        flush=True,
    )
    print("FIXTURES", result["fixture"], "H1", result["H1_parameters"], flush=True)
    out.write_text(json.dumps(result, indent=2) + "\n")
    for file in (out, streams):
        print(
            "COMPLETE", hashlib.sha256(file.read_bytes()).hexdigest(), file, flush=True
        )
