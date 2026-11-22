"""Qualify motion-channel harmonic packets at the frozen clock and fixed noise controls."""

from pathlib import Path
import hashlib
import json
import sys

import numpy as np

from clock import FS, N, cut, extract

BANDS = [(80, 160), (160, 320), (320, 640), (640, 1280), (1280, 2560)]
F = np.fft.rfftfreq(N, 1 / FS)
T = np.arange(N) / FS
s = T / T[-1]
W = np.ones(N)
WP = np.zeros(N)
for q, idx, sign in ((s, s < 0.1, 1), (1 - s, s > 0.9, -1)):
    phase = np.pi * q[idx] / 0.1
    W[idx] = (1 - np.cos(phase)) / 2
    WP[idx] = sign * np.pi / (0.2 * T[-1]) * np.sin(phase)


def spectra(arrays, center, offset=0):
    x = cut(arrays["hX"], center, offset)
    v = cut(arrays["hV"], center, offset)
    X = np.fft.rfft(W * x)
    V = np.fft.rfft(W * v)
    D = 2j * np.pi * F * X - np.fft.rfft(WP * x)
    return dict(
        X=X,
        V=V,
        D=D,
        U=np.fft.rfft(W * cut(arrays["hU"], center, offset)),
        I=np.fft.rfft(W * cut(arrays["hI"], center, offset)),
    )


def inspect(path, clock):
    assert clock["admitted"]
    arrays, _ = extract(path, {"hU", "hI", "hX", "hV"})
    assert all(np.isfinite(x).all() for x in arrays.values())
    blocks = {}
    diagnostics = {}
    for order, center in clock["center_samples_rounded"].items():
        main = spectra(arrays, center)
        sides = [spectra(arrays, center, t) for t in (0.095, 0.175)]
        rows = []
        for low, high in BANDS:
            bins = (F >= low) & (F < high)
            energy = {}
            for k in ["X", "V", "U", "I"]:
                values = [float(np.sum(abs(a[k][bins]) ** 2)) for a in (main, *sides)]
                energy[k] = {
                    "packet": values[0],
                    "background": values[1:],
                    "relative_to_larger_background": values[0] / max(values[1:]),
                }
            rows.append(
                {
                    "output_band_Hz": [low, high],
                    "drive_band_Hz": [low / int(order), high / int(order)],
                    "bins": int(bins.sum()),
                    "power": energy,
                    "usable": all(
                        energy[k]["relative_to_larger_background"] >= 4
                        for k in ("X", "V")
                    ),
                }
            )
        blocks[order] = main
        diagnostics[order] = rows
    counts = {key: sum(r["usable"] for r in val) for key, val in diagnostics.items()}
    return blocks, {
        "conditional_on_source_clock": True,
        "source": clock["source"],
        "rows": diagnostics,
        "usable_counts": counts,
        "admitted": all(k >= 3 for k in counts.values()),
    }


if __name__ == "__main__":
    path, clock_path, out = map(Path, sys.argv[1:])
    result = inspect(path, json.loads(clock_path.read_text()))[1]
    out.write_text(json.dumps(result, indent=2) + "\n")
    for k, rows in result["rows"].items():
        print(
            "ORDER",
            k,
            [
                (
                    a["output_band_Hz"],
                    a["usable"],
                    [
                        round(a["power"][c]["relative_to_larger_background"], 4)
                        for c in ["X", "V"]
                    ],
                )
                for a in rows
            ],
            flush=True,
        )
    print(
        "ADMITTED",
        result["admitted"],
        "COMPLETE",
        hashlib.sha256(out.read_bytes()).hexdigest(),
        out,
    )
