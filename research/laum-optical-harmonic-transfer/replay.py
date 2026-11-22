"""Replay the LAUM single-sweep conditional readout comparison from public Git objects."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

import numpy as np

HERE = Path(__file__).resolve().parent
URL = "https://github.com/antonin-novak/LAUM_Loudspeaker_Parameters_Measurement.git"
VERSIONS = {
    "current": "13fbaaf1d0b7d065565b0b15e11ca912898cf298",
    "first": "08c17c61a6d077a151a46314a32735d4e2c63420",
}


def checkout(out, label):
    repo = out / label
    if not repo.exists():
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(
            ["git", "fetch", "--depth", "1", URL, VERSIONS[label]], cwd=repo, check=True
        )
        subprocess.run(
            ["git", "checkout", "-q", "--detach", "FETCH_HEAD"], cwd=repo, check=True
        )
    sha = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo, text=True
    ).strip()
    assert sha == VERSIONS[label]
    # A pinned HEAD alone would permit local modifications to the scientific inputs.
    subprocess.run(["git", "diff", "--quiet", "HEAD", "--", "."], cwd=repo, check=True)
    assert not subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard"], cwd=repo
    ).strip()
    return repo


def main(out):
    out.mkdir(parents=True, exist_ok=True)
    repo = checkout(out, "current")
    old = checkout(out, "first")
    data = repo / "data" / "test_meas.npy"
    expected = json.loads((HERE / "observed.json").read_text())
    env = dict(
        os.environ,
        OPENBLAS_NUM_THREADS="1",
        OMP_NUM_THREADS="1",
        MPLBACKEND="Agg",
        PYTHONDONTWRITEBYTECODE="1",
    )

    def run(script, *arguments):
        subprocess.run(
            [sys.executable, str(HERE / script), *map(str, arguments)],
            env=env,
            check=True,
        )

    run("clock.py", data, out / "clock.json")
    run("support.py", data, out / "clock.json", out / "support.json")
    run(
        "transfer.py",
        data,
        out / "clock.json",
        out / "transfer.json",
        out / "streams.npz",
    )
    run(
        "independent.py",
        data,
        out / "transfer.json",
        out / "streams.npz",
        out / "independent.json",
    )
    for folder, kind in [(repo, "frac"), (old, "mass-spring")]:
        target = out / ("author-" + kind + ".json")
        run("author.py", folder, kind, target)
        original = expected["author"][kind]
        now = json.loads(target.read_text())
        assert now["commit"] == original["commit"] and now["n_fit_bins"] == 9980
        np.testing.assert_allclose(
            [now["Bl"], now["resonance_Hz"], now["input_impedance_relative_rms"]],
            [
                original["Bl"],
                original["resonance_Hz"],
                original["input_impedance_relative_rms"],
            ],
            rtol=1e-6,
            atol=1e-10,
        )
    got = json.loads((out / "transfer.json").read_text())
    want = expected["transfer"]
    assert len(got["band_results"]) == len(want["band_results"]) == 75
    for a, b in zip(got["band_results"], want["band_results"]):
        assert [a[k] for k in ["order", "band", "method", "usable"]] == [
            b[k] for k in ["order", "band", "method", "usable"]
        ]
        np.testing.assert_allclose(
            a["normalized_RMS"], b["normalized_RMS"], rtol=1e-5, atol=1e-10
        )
        assert (
            a["worst_absolute_bin"]["output_Hz"] == b["worst_absolute_bin"]["output_Hz"]
        )
    assert got["support"]["usable_counts"] == {"1": 5, "2": 3, "3": 3}
    assert got["primary_pass"] is False and want["primary_pass"] is False
    audit = json.loads((out / "independent.json").read_text())
    assert [
        audit[k] for k in ["predicted_complex_values", "score_rows", "power_values"]
    ] == [3180, 75, 180]
    assert audit["passive_witness"] == expected["independent"]["passive_witness"]
    print(
        "VERIFIED three packet centers, 180 band powers, 75 normalized errors, 3180 complex predictions, two unchanged author estimators and the passive witness. Primary comparison failed for orders two and three.",
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    main(parser.parse_args().output.resolve())
