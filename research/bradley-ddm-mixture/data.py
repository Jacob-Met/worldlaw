"""Read the authenticated Section 5 parent and calibration preparations."""
import ast
import csv
import hashlib
import io
import re
import zipfile

import numpy as np


ARCHIVE_SHA256 = "b73d27b4a383dba28b1e1e71ad78a45910cd11cbbef2ef4c5dc7c149d6a01182"
SECTION = "Section_5_Bimodal_240nm_1100_nm/"
RECIPES = {0: .50, 1: .01, 2: 1., 3: 0., 4: .10, 5: .0002, 6: .001,
           7: .25, 8: .05, 9: .005, 10: .025, 11: .70}
PARENTS = (3, 2)
CALIBRATION = (5, 1, 4, 11)
DEVELOPMENT = (6, 10, 7)
RESERVE = (9, 8, 0)


def array_field(lines, label):
    line = next(line for line in lines if line.startswith(label + ":"))
    return np.asarray(ast.literal_eval(line.split(":", 1)[1]), dtype=float)


def table_values(lines):
    row = next(line for line in lines if line.startswith("| Value"))
    return [float(x) for x in row.split("|")[2:-1]]


class Source:
    def __init__(self, path):
        with open(path, "rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        if digest != ARCHIVE_SHA256:
            raise ValueError(f"Unrecognized publisher archive {digest}")
        self.archive = zipfile.ZipFile(path)
        self.members = [n for n in self.archive.namelist() if n.startswith(SECTION)]
        records = csv.DictReader(io.StringIO(self.archive.read("File_Info.csv").decode("utf-8-sig")))
        seen = set()
        for row in records:
            if row["Section"] != "5":
                continue
            pos, repeat = int(row["Position"]), int(row["Number"])
            percent = re.fullmatch(r"([0-9.]+)% large particles", row["Description"])
            if not percent or abs(float(percent[1])/100 - RECIPES[pos]) > 1e-15:
                raise ValueError(f"Source composition mismatch at position {pos}")
            if (pos, repeat) in seen:
                raise ValueError("Repeated preparation/video key")
            seen.add((pos, repeat))
        expected = {(p, r) for p in RECIPES for r in range(1, 6)}
        if seen != expected:
            raise ValueError("Incomplete 12-preparation, five-video roster")
        self.opened = []

    def read(self, pos, repeat, suffix):
        if pos not in PARENTS + CALIBRATION:
            raise ValueError("Sealed preparation")
        if suffix == "_fit_result.txt" and pos not in PARENTS:
            raise ValueError("Mixture fit is outside the prediction contract")
        matches = [n for n in self.members if f"Pos{pos}_{repeat}_" in n and n.lower().endswith(suffix)]
        if len(matches) != 1:
            raise ValueError(f"Expected one {pos}/{repeat}/{suffix} member")
        self.opened.append(matches[0])
        return self.archive.read(matches[0])

    def parent_fit(self, pos, repeat):
        lines = self.read(pos, repeat, "_fit_result.txt").decode().splitlines()
        q, t = array_field(lines, "q"), array_field(lines, "tau")
        single = lines[lines.index("Single Spike fit"):lines.index("Cumulant 3rd order fit")]
        cumulant = lines[lines.index("Cumulant 3rd order fit"):lines.index("Fit Statistics:")]
        spectrum = lines[lines.index("CONTIN fit result:"):]
        if "IQUAD : 2" not in spectrum or "N_GRIDPOINTS : 50" not in spectrum:
            raise ValueError("Unexpected author CONTIN quadrature")
        rows = []
        for line in spectrum:
            columns = line.split("|")
            if len(columns) == 5:
                try:
                    rows.append(tuple(float(x) for x in columns[1:4]))
                except ValueError:
                    continue
        if len(rows) != 50:
            raise ValueError("Incomplete CONTIN table")
        grid, weights, _ = np.asarray(rows).T
        if min(weights) < 0 or sum(weights) <= 0:
            raise ValueError("Invalid released spectrum")
        stat = next(line for line in lines if line.startswith("| Single Spike") and line.count("|") >= 5)
        reduced_chi2 = float(stat.split("|")[-2])
        return dict(q=q, t=t, reduced_chi2=reduced_chi2, D=table_values(single)[0], A=array_field(single, "A(q)"),
                    B=array_field(single, "B(q)"), Ac=array_field(cumulant, "A(q)"),
                    cumulants=table_values(cumulant), grid=grid, weights=weights/weights.sum())

    def matrix(self, pos, repeat, suffix, t, bins):
        data = np.loadtxt(io.BytesIO(self.read(pos, repeat, suffix)))
        if data.ndim != 2 or data.shape[1] != 257:
            raise ValueError("Expected one lag column and 256 Fourier annuli")
        i = np.searchsorted(data[:, 0], t)
        if not np.array_equal(data[i, 0], t):
            raise ValueError("Acquisition lag grid mismatch")
        values = data[i][:, bins + 1].T
        if not np.isfinite(values).all():
            raise ValueError("Nonfinite source measurement")
        return values


def anchored(curve):
    return curve - curve[..., :1]


def read_course(path):
    source = Source(path)
    fits = [[source.parent_fit(pos, rep) for rep in range(1, 6)] for pos in PARENTS]
    q, t = fits[0][0]["q"], fits[0][0]["t"]
    if any(not np.array_equal(f["q"], q) or not np.array_equal(f["t"], t) for group in fits for f in group):
        raise ValueError("Unequal pure fit supports")
    bins = np.rint(q * 512 * .433 / (2*np.pi)).astype(int)
    if list(bins) != list(range(36, 71)) or len(t) != 124 or (t[0], t[-1]) != (.01, 31.35):
        raise ValueError("Unexpected registered support")
    y = {}
    for pos in PARENTS + CALIBRATION:
        videos = []
        for rep in range(1, 6):
            raw = source.matrix(pos, rep, "_fft_ut.txt", t, bins)
            videos.append(raw)
            if pos in PARENTS:
                fit = fits[PARENTS.index(pos)][rep-1]
                stderr = source.matrix(pos, rep, "_fft_sterr.txt", t, bins)
                forward = fit["B"][:, None] + fit["A"][:, None] * -np.expm1(
                    -fit["D"] * q[:, None]**2 * t[None, :])
                chisq = np.sum(((raw-forward)/stderr)**2)/(raw.size - 2*q.size - 1)
                # D is printed with only four significant digits in the author fit.
                if abs(chisq - fit["reduced_chi2"]) > .002:
                    raise ValueError(f"Published fit disagrees with raw annuli at {pos}/{rep}")
        y[RECIPES[pos]] = anchored(np.stack(videos))
    source.archive.close()
    return q, t, bins, fits, y, source.opened
