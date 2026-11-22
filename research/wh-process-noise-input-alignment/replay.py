"""Reproduce the WH Process Noise command and measured-input alignment checks."""

import argparse
from collections import Counter
import csv
import hashlib
import io
import itertools
import json
from pathlib import Path
import shutil
import tempfile
import urllib.request
import zipfile

import numpy as np

from inputs import project


ARCHIVE = ("https://data.4tu.nl/file/1f194001-affa-4459-870a-ad9e9d9146f9/"
           "2dbbc046-1ac2-43b2-bf4e-53b5a4be8b96")
SWEEP = "WH_SineSweepInput_meas"
ROOT = "WienerHammersteinFiles/"
PINS = json.loads(Path(__file__).with_name("source.json").read_text())


def check(condition, message):
    if not condition:
        raise ValueError(message)


def read_member(archive, name, sha):
    raw = archive.read(ROOT + name)
    check(hashlib.sha256(raw).hexdigest() == sha, f"Source mismatch in {name}")
    return raw


def hash_column(values):
    return hashlib.sha256(np.ascontiguousarray(values, dtype="<f8")).digest()


def alignment(u):
    """Compare u[t+lag,j] against u[t,0], trimming five samples at both ends."""
    u = np.asarray(u, dtype=np.float64)
    lags = np.arange(-2, 3)
    rows = []
    for j in range(1, u.shape[1]):
        quarters = []
        offset = 5
        for count in map(len, np.array_split(np.arange(len(u) - 10), 4)):
            base = u[offset:offset + count, 0]
            residuals = [base - u[offset + d:offset + d + count, j] for d in lags]
            quarters.append([np.dot(v, v) for v in residuals])
            offset += count
        totals = np.sum(quarters, axis=0)
        best = np.argmin(totals)
        check(np.all(np.argmin(quarters, axis=1) == best), f"Quarter instability at {j}")
        rms = np.sqrt(totals / (len(u) - 10))
        rows.append({"column": j, "lag": int(lags[best]), "rms_unshifted": float(rms[2]),
                     "rms_aligned": float(rms[best])})
    return rows


def inspect_mat(archive, pin):
    name = pin["name"]
    values = project(read_member(archive, name + ".mat", pin["sha256"]))
    r, u = values["r"], values["u"]
    check(list(r.shape) == pin["shape"] and r.shape == u.shape, name + " shape")
    check(values["fs"].size == 1 and values["fs"].item() == 78125, name + " sample rate")
    commands = {hash_column(x) for x in r.T}
    check(len(commands) == pin["commands"], name + " distinct commands")
    periods = {"WH_Triangle_meas": 16384, "WH_Triangle2_meas": 2048}
    if name in periods:
        period = periods[name]
        for col in r.T:
            check(np.all(col.reshape(-1, period) == col[:period]), name + " period")
    return commands, alignment(u) if name == SWEEP else None


def csv_sweep(archive):
    stream = io.BytesIO(read_member(archive, SWEEP + ".csv", PINS["csv_sha"]))
    header = next(csv.reader([stream.readline().decode("utf-8-sig")]))
    labeled = [(i, v.strip().lower()) for i, v in enumerate(header) if v.strip()]
    check(labeled == [(0, "r"), (100, "u"), (200, "y"), (300, "fs")], "CSV columns")
    ru = np.loadtxt(stream, delimiter=",", usecols=range(200), quotechar='"')
    check(ru.shape == (64161, 200), "CSV shape")
    check(np.all(ru[:, :100] == ru[:, :1]), "CSV reference identity")
    return alignment(ru[:, 100:])


def replay(path):
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    check(digest == PINS["archive_sha256"], "Organizer archive checksum differs")
    commands = {}
    with zipfile.ZipFile(path) as archive:
        for pin in PINS["mat"]:
            bank, rows = inspect_mat(archive, pin)
            commands[pin["name"]] = bank
            if rows is not None:
                mat = rows
        csv_rows = csv_sweep(archive)
    pairs = list(itertools.combinations(commands, 2))
    check(all(commands[a].isdisjoint(commands[b]) for a, b in pairs), "Shared full command")
    check(len(csv_rows) == len(mat) == len(PINS["csv99"]) == 99, "Sweep coverage")
    max_difference = 0.
    for a, b, frozen in zip(mat, csv_rows, PINS["csv99"]):
        check(a["column"] == b["column"] == frozen["column"], "Column identity")
        check(a["lag"] == b["lag"] == frozen["lag"], "Lag mismatch")
        for field in ("rms_aligned", "rms_unshifted"):
            check(abs(b[field] - frozen[field]) < 1e-10, "CSV RMS recount")
            max_difference = max(max_difference, abs(a[field] - b[field]))
    check(max_difference < 2e-5, "MAT/CSV disagreement exceeds text-rounding allowance")
    return {"archive_sha256": digest, "sampling_hz": 78125, "cross_file_pairs": len(pairs),
            "pairs_sharing_full_commands": 0, "same_reference_columns": 100,
            "lags": dict(Counter(r["lag"] for r in mat)), "all_four_quarters_agree": True,
            "max_cross_format_rms_delta_volts": max_difference,
            "worst_unaligned_mat": max(mat, key=lambda r: r["rms_unshifted"]),
            "worst_aligned_mat": max(mat, key=lambda r: r["rms_aligned"]),
            "numeric_y_columns": 0, "independent_noise_campaign_gate": "unqualified",
            "mat_columns": mat, "csv_columns": csv_rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Local copy of the original organizer ZIP")
    parser.add_argument("--details", action="store_true", help="Include all 99 MAT/CSV comparisons")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        path = args.archive
        if path is None:
            path = Path(tmp) / "process-noise.zip"
            with urllib.request.urlopen(ARCHIVE, timeout=180) as remote, path.open("wb") as local:
                shutil.copyfileobj(remote, local)
        result = replay(path)
    if not args.details:
        for key in ("mat_columns", "csv_columns"):
            del result[key]
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
