"""Read only the archived terminal-voltage channel to establish the sweep clock."""

from pathlib import Path
import hashlib
import json
import math
import pickletools
import struct
import sys

import numpy as np

SOURCE = "58e0b99b70d0d690891ceb6617b1b52eb34cdcdc3977eeef15ab60d334c0726b"
HASHES = {
    "hU": "a5c2e5365370e606a35bb7b114cd3c63059a3046739e7e882c08b77e40a09569",
    "hI": "666a044372abd27dad913c92f25990259c99a10f8fc5b7fdead77451a9fd17ba",
    "hX": "be6091e48a6531f686af1eb180d22b5ec0780617b19cb9eda91f2b4d4bf6a93f",
    "hV": "158f3b37b4bde37012a28c7c991f7c0afba798a5c7731dd6eb799fdae411cf30",
}
FS = 48000
N = 4096
L = 5 / math.log(2000)


def extract(path, permitted):
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SOURCE
    start = 10 + struct.unpack("<H", raw[8:10])[0]
    buffers = {}
    current = None
    strings = []
    for op, arg, _ in pickletools.genops(raw[start:]):
        if op.name == "BINUNICODE":
            strings.append(arg)
            if arg in HASHES:
                current = arg
        if op.name == "BINBYTES":
            assert current in HASHES and len(arg) == 244800 * 8
            assert hashlib.sha256(arg).hexdigest() == HASHES[current]
            if current in permitted:
                buffers[current] = np.frombuffer(arg, dtype="<f8")
    assert set(buffers) == set(permitted) and "f8" in strings and "<" in strings
    return buffers, strings


def cut(a, center, extra=0):
    idx = (np.arange(N) + center - 576 + round(FS * extra)) % len(a)
    return a[idx]


def clock(path):
    v, terms = extract(path, {"hU"})
    u = v["hU"]
    assert np.isfinite(u).all()
    center = int(np.argmax(np.abs(u[:FS])))
    base = np.median(np.abs(u))
    pabs = abs(u[center])
    rms = lambda x: float(np.sqrt(np.mean(x * x)))
    signal = rms(cut(u, center))
    noise = [rms(cut(u, center, t)) for t in [0.095, 0.175]]
    out = {
        "source": SOURCE,
        "published_metadata_terms": terms,
        "hU_peak_first_1s": center,
        "hU_global_abspeak_sample": int(np.argmax(np.abs(u))),
        "hU_peak_value": float(u[center]),
        "median_abs_hU": float(base),
        "peak_to_median": float(pabs / base),
        "fundamental_RMS": signal,
        "off_window_RMS": noise,
        "center_samples_rounded": {},
        "center_samples_fractional": {},
        "admitted": bool(
            center < FS * 0.25 and pabs >= 10 * base and signal >= 4 * max(noise)
        ),
    }
    for k in (1, 2, 3):
        t = (center - FS * L * math.log(k)) % len(u)
        out["center_samples_fractional"][str(k)] = t
        out["center_samples_rounded"][str(k)] = round(t) % len(u)
    return out


if __name__ == "__main__":
    out = clock(Path(sys.argv[1]))
    target = Path(sys.argv[2])
    target.write_text(json.dumps(out, indent=2) + "\n")
    print("CLOCK", json.dumps(out), flush=True)
    print(
        "COMPLETE", hashlib.sha256(target.read_bytes()).hexdigest(), target, flush=True
    )
