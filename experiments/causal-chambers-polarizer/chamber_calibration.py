"""Use only registered development recordings and the authors' angle-command RNG."""
import argparse
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path

import numpy as np

COLORS = ("white", "red", "green", "blue")
LEVELS = (64, 128, 255)
ARCHIVE_MD5 = "cc49b95d85410e0b5ea3bcd1479428e3"


def load_rows(archive, name):
    member = f"lt_malus_v1/{name}.csv"
    with archive.open(member) as raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as text:
        return list(csv.DictReader(text))


def command_grid():
    """Reproduce the literal random choices and one-decimal rounding in generators/malus.py."""
    rng = np.random.default_rng(42)
    angles = np.arange(-90, 90, .1)
    grids = {}
    for color in COLORS:
        for brightness in LEVELS:
            grids[f"{color}_{brightness}"] = [
                [float(f"{rng.choice(angles):.1f}"), float(f"{rng.choice(angles):.1f}")]
                for _ in range(1000)
            ]
    # The motor controller reports commanded polarizer angles on a 0.1125° grid.
    return {key:(np.rint(np.asarray(values)/.1125)*.1125).tolist() for key,values in grids.items()}


def run(archive_path):
    with archive_path.open("rb") as stream:
        if hashlib.file_digest(stream, "md5").hexdigest() != ARCHIVE_MD5:
            raise ValueError("publisher archive identity mismatch")
    commands = command_grid()
    calibration = {}
    with zipfile.ZipFile(archive_path) as archive:
        for color in COLORS:
            key = f"{color}_128"
            rows = load_rows(archive, key)
            controls = np.asarray(commands[key])
            recorded = np.asarray([[float(r["pol_1"]), float(r["pol_2"])] for r in rows])
            if controls.shape != recorded.shape or np.max(np.abs(controls-recorded)) > 1e-5:
                raise ValueError(f"{key}: recorded commands differ from original generator")
            y = np.asarray([float(r["ir_3"]) for r in rows])
            f = np.cos(np.deg2rad(controls[:,0]-controls[:,1]))**2
            a, b = np.linalg.lstsq(np.column_stack((f, np.ones(len(f)))), y, rcond=None)[0]
            if not np.isfinite(y).all() or not a > 0:
                raise ValueError(f"{key}: invalid physical development scale")
            residual = np.abs(y - (a*f+b))/a
            eps = max(.005, float(np.quantile(residual, .99))+.001)
            calibration[color] = dict(source=key, slope=float(a), intercept=float(b), noise=float(eps))
    return dict(archive_md5=ARCHIVE_MD5, development=calibration,
                target_commands={k:v for k,v in commands.items() if not k.endswith("_128")})


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive", type=Path)
    p.add_argument("out", type=Path)
    a = p.parse_args()
    with a.out.open("x") as output:
        json.dump(run(a.archive), output, separators=(",",":"))
        output.write("\n")
