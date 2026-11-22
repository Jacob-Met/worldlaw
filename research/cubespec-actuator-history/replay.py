#!/usr/bin/env python3
"""Reproduce the published training-only CubeSpec study from the organizer's immutable files."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
AMPLITUDES = (100, 200, 300)


def obtain(url, destination, sha):
    if destination.is_file():
        content = destination.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=120) as response:
            content = response.read()
    if hashlib.sha256(content).hexdigest() != sha:
        raise ValueError(f"Unexpected source digest for {destination}")
    if not destination.exists():
        destination.write_bytes(content)


def training_only(source, output):
    with zipfile.ZipFile(source) as whole, zipfile.ZipFile(output, "w") as train:
        for amp in AMPLITUDES:
            for variable in ("u", "y"):
                member = f"{variable}_{amp}mV_train.npy"
                train.writestr(member, whole.read(member))


def verify(result, frozen, training, output):
    import numpy as np

    expected = frozen["verified_development"]["model_means_by_amp_um"]
    cells = []
    for amp in AMPLITUDES:
        with np.load(output / f"development-streams-{amp}mV.npz", allow_pickle=False) as streams:
            truth = streams["truth_m"][100:].astype(float)
            for model, values in expected.items():
                err = 1e6 * (streams[model + "_m"][100:].astype(float) - truth)
                rmse = np.empty((3, 3, 2))
                for sensor, realization, period in np.ndindex(rmse.shape):
                    row = err[:, sensor, realization, period]
                    rmse[sensor, realization, period] = math.sqrt(math.fsum(x*x for x in row) / len(row))
                program_cells = np.asarray(result["scores_um"][amp][model]["channels_realizations_periods"])
                if np.max(np.abs(rmse - program_cells)) > 2.5e-6:
                    raise ValueError(f"{model} raw forecasts disagree with the calculated stream scores.")
                if abs(rmse.mean() - values[str(amp)]) > 2.5e-6:
                    raise ValueError(f"{model} at {amp} mV differs from its frozen development score.")
                cells.extend(rmse.ravel())
    scale = np.asarray(result["fit_100mV_voltage_rms"])
    memory = []
    with np.load(training, allow_pickle=False) as data:
        for amp in AMPLITUDES:
            voltages = data[f"u_{amp}mV_train"][-1000:, :, :, 1]
            for sensor, realization in np.ndindex(3, 6):
                v = voltages[:, sensor, realization]
                excursion = np.maximum.accumulate(v) - np.minimum.accumulate(v)
                for ratio in (.25, .5, 1.0):
                    hits = np.flatnonzero(excursion >= 2 * ratio * scale[sensor])
                    memory.append(int(hits[0]) + 1 if hits.size else None)
    if len(cells) != 486 or len(memory) != 162 or None in memory or max(memory) != 19:
        raise ValueError("Development coverage or stop-initialization controls differ from the frozen study.")
    if not np.isfinite(cells).all():
        raise ValueError("A forecast has a non-finite score.")
    scores = result["scores_um"]
    means = {mode: np.mean([scores[a]["correction_" + mode]["mean"] for a in AMPLITUDES])
             for mode in ("gain", "clip", "lag", "play")}
    diag = np.array([scores[a][f"bla_{a}mV"]["mean"] for a in AMPLITUDES])
    stopped = np.array([scores[a]["correction_play"]["mean"] for a in AMPLITUDES])
    authors = list(frozen["model_sha256"])
    strongest = {a: min(authors, key=lambda name: scores[a][name]["mean"]) for a in AMPLITUDES}
    best = np.array([scores[a][strongest[a]]["mean"] for a in AMPLITUDES])
    gate = (
        1 - stopped.mean()/diag.mean() >= .01 and
        1 - means["play"]/min(means[name] for name in ("gain","clip","lag")) >= .005 and
        np.sum(stopped < diag) >= 2 and np.min(1-stopped/diag) >= -.02 and
        stopped.mean() < best.mean()
    )
    if gate:
        raise ValueError("The frozen negative gate changed; investigate the exact replay.")
    return {"rmse_cells": len(cells), "stop_states_checked": len(memory),
            "latest_initial_state_erasure_sample": max(memory), "best_saved_model": strongest,
            "correction_mean_rmse_um": means, "held_test_gate_passed": False}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--output", required=True, type=Path,
                     help="Directory for authenticated sources, six training arrays, forecasts and the report")
    args = cli.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    frozen = json.loads((HERE / "frozen_result.json").read_text())
    base = f"https://raw.githubusercontent.com/merijnfloren/fsm-benchmark-data/{frozen['data_commit']}"
    source = output / "organizer_data.npz"
    obtain(base + "/data/combined_data.npz", source, frozen["source_sha256"])
    models = output / "models"
    models.mkdir(exist_ok=True)
    for name, sha in frozen["model_sha256"].items():
        obtain(f"{base}/baseline_results/models/{name}.zip", models / (name + ".zip"), sha)
    train = output / "training_only.npz"
    training_only(source, train)
    library = output / "stops.so"
    subprocess.run(["g++", "-O3", "-std=c++17", "-fPIC", "-shared", str(HERE/"stops.cpp"),
                    "-o", str(library)], check=True)
    # The saved models are float32. Equinox correctly rejects a float64 skeleton.
    os.environ.update(JAX_ENABLE_X64="0", JAX_PLATFORMS="cpu", OPENBLAS_NUM_THREADS="1",
                      OMP_NUM_THREADS="1", MKL_NUM_THREADS="1")
    from actuator_history import fit

    result = fit(train, models, library, output)
    result["verification"] = verify(result, frozen, train, output)
    (output / "development_result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["verification"], indent=2))


if __name__ == "__main__":
    main()
