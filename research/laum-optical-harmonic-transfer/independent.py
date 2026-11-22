"""Reconstruct optical spectra with a direct transform and verify every saved prediction."""

from pathlib import Path
from fractions import Fraction
import hashlib
import json
import math
import pickletools
import sys
import numpy as np


def channels(path):
    b = path.read_bytes()
    assert (
        hashlib.sha256(b).hexdigest()
        == "58e0b99b70d0d690891ceb6617b1b52eb34cdcdc3977eeef15ab60d334c0726b"
    )
    start = 10 + int.from_bytes(b[8:10], byteorder="little")
    key = None
    out = {}
    for opcode, value, _ in pickletools.genops(b[start:]):
        if opcode.name == "BINUNICODE" and value in ("hU", "hI", "hX", "hV"):
            key = value
        elif opcode.name == "BINBYTES":
            assert len(value) == 1958400 and key not in out
            out[key] = np.frombuffer(value, dtype="<f8")
    assert set(out) == {"hU", "hI", "hX", "hV"}
    return out


def passive_witness():
    # Exact polynomial coefficient proof in s for two passive electrical RLC networks.
    # Zm=P/s and Ze=R+sL. With b'=cb and Zm'=cP/s, both V/I and U/I agree.
    # Added Ze branch k*s/P has parallel conductance Rm/k, capacitance M/k and
    # reciprocal inductance K/k. Positive components realize positive realness.
    Q = Fraction
    b = Q(3)
    c = Q(2, 5)
    m = Q(1, 10)
    r = Q(2)
    k = Q(200)
    a = (1 - c) * b * b
    alternative_force = c * b
    alternative_mechanical = [c * k, c * r, c * m]
    assert [alternative_force * x for x in [k, r, m]] == [
        b * x for x in alternative_mechanical
    ]
    assert a * c + (c * b) ** 2 == c * b * b
    assert all(x > 0 for x in [c, r / a, m / a, k / a])
    for s in [Q(1, 32), Q(1), Q(11)]:
        z = Q(4) + s / 100
        zm = r + m * s + k / s
        capacitor = m / a
        inductor = a / k
        conductance = r / a
        add = 1 / (conductance + capacitor * s + 1 / (inductor * s))
        assert add == a / zm and b / zm == c * b / (c * zm)
        assert z + b * b / zm == z + add + (c * b) ** 2 / (c * zm)
        assert z + b * b / zm != z + (c * b) ** 2 / (c * zm)
    return {
        "b": "3",
        "c": "2/5",
        "b_prime": "6/5",
        "added_parallel_RLC": {"R": str(a / r), "L": str(a / k), "C": str(m / a)},
        "finite_resistance_mass_stiffness": [str(r), str(m), str(k)],
    }


def verify(path, report, streams):
    raw = channels(path)
    assert all(len(x) == 244800 for x in raw.values())
    center = int(np.argmax(abs(raw["hU"][:48000])))
    clock = {
        k: int(round(center - 48000 * 5 * math.log(k) / math.log(2000))) % 244800
        for k in (1, 2, 3)
    }
    t = np.arange(4096)
    length = 4095 / 48000
    angle = np.minimum(t, 4095 - t) / 4095 * np.pi / 0.1
    ramp = angle < np.pi
    window = np.ones(len(t))
    window[ramp] = (1 - np.cos(angle[ramp])) / 2
    wp = np.zeros(len(t))
    wp[ramp] = (
        np.where(t[ramp] < 2048, 1, -1) * np.sin(angle[ramp]) * np.pi / (0.2 * length)
    )
    ids = np.arange(7, 219)
    freq = ids * 48000 / 4096
    assert np.all((freq >= 80) & (freq < 2560))
    basis = np.exp(-2j * np.pi * np.outer(ids, t) / 4096)
    names = ("hU", "hI", "hX", "hV")
    bands = [(2**j * 80, 2 ** (j + 1) * 80) for j in range(5)]
    masks = [(freq >= lo) & (freq < hi) for lo, hi in bands]
    source = json.loads(report.read_text())
    max_bin_error = 0.0
    max_score_error = 0.0
    nvalues = 0
    nrows = 0
    nv = 0
    raw_worst = []
    with np.load(streams, allow_pickle=False) as saved:
        assert np.array_equal(saved["output_hz"], freq)
        for order in (1, 2, 3):
            spectra = []
            for shift in (0, 4560, 8400):
                idx = (clock[order] - 576 + shift + t) % 244800
                A = {n: basis @ (raw[n][idx] * window) for n in names}
                A["d"] = 2j * np.pi * freq * A["hX"] - basis @ (raw["hX"][idx] * wp)
                spectra.append(A)
            base = spectra[0]
            D = base["d"]
            V = base["hV"]
            assert np.allclose(
                saved["observed_order" + str(order)], V, rtol=1e-10, atol=1e-15
            )
            assert np.allclose(
                saved["derivative_order" + str(order)], D, rtol=1e-10, atol=1e-15
            )
            included = []
            for j, mask in enumerate(masks):
                row = source["support"]["rows"][str(order)][j]
                passband = True
                for n, label in zip(names, ["U", "I", "X", "V"]):
                    e = [np.vdot(X[n][mask], X[n][mask]).real for X in spectra]
                    published = row["power"][label]
                    assert np.allclose(
                        e,
                        [published["packet"], *published["background"]],
                        rtol=1e-10,
                        atol=1e-26,
                    )
                    if label in ("X", "V"):
                        passband = passband and e[0] >= 4 * max(e[1:])
                    nv += 3
                assert bool(passband) == row["usable"]
                included.append(passband)
            if order == 1:
                weights = np.zeros_like(freq)
                for use, mask in zip(included, masks):
                    if use:
                        weights[mask] = 1 / np.vdot(V[mask], V[mask]).real
                H = {}
                for name, p in source["H1_parameters"].items():
                    h = np.exp(-2j * np.pi * freq * p["delay_ms"] / 1000)
                    ff = p["frequencies_Hz"]
                    if len(ff) == 3:
                        h = (
                            h
                            * (1 + 1j * freq / ff[0])
                            / (1 + 1j * freq / ff[1])
                            / (1 + 1j * freq / ff[2])
                        )
                    if len(ff) == 1:
                        h = h / (1 + 1j * freq / ff[0])
                    gain = (
                        np.sum(weights * np.conj(h * D) * V)
                        / np.sum(weights * abs(h * D) ** 2)
                    ).real
                    assert math.isclose(gain, p["gain"], rel_tol=1e-10)
                    H[name] = gain * h
                hs = []
                for w0 in freq:
                    w = np.exp(-0.5 * (6 * np.log2(freq / w0)) ** 2) * weights
                    hs.append(np.sum(w * np.conj(D) * V) / np.sum(w * abs(D) ** 2))
                H["local_complex"] = np.array(hs)
            for name, resp in H.items():
                pred = resp * D
                err = pred - V
                diff = np.max(abs(pred - saved[str(order) + "_" + name]))
                max_bin_error = max(max_bin_error, float(diff))
                assert np.allclose(
                    pred, saved[str(order) + "_" + name], rtol=1e-10, atol=2e-15
                )
                nvalues += len(freq)
                for j, mask in enumerate(masks):
                    row = next(
                        r
                        for r in source["band_results"]
                        if r["order"] == order
                        and r["method"] == name
                        and r["band"] == list(bands[j])
                    )
                    ix = np.flatnonzero(mask)
                    which = ix[np.argmax(abs(err[mask]))]
                    worst = row["worst_absolute_bin"]
                    re = np.linalg.norm(err[mask]) / np.linalg.norm(V[mask])
                    max_score_error = max(
                        max_score_error, float(abs(row["normalized_RMS"] - re))
                    )
                    assert (
                        math.isclose(row["normalized_RMS"], re, rel_tol=1e-10)
                        and freq[which] == worst["output_Hz"]
                    )
                    if name == "lead_two_poles" and order > 1:
                        raw_worst.append([order, bands[j], bool(included[j]), worst])
                    nrows += 1
    assert nrows == 75 and nvalues == 3180 and nv == 180
    return {
        "predicted_complex_values": nvalues,
        "score_rows": nrows,
        "power_values": nv,
        "clock": clock,
        "max_complex_discrepancy": max_bin_error,
        "max_score_discrepancy": max_score_error,
        "candidate_worst_all_unfiltered_transfer_bands": raw_worst,
        "passive_witness": passive_witness(),
    }


if __name__ == "__main__":
    inp, report, pred, out = map(Path, sys.argv[1:])
    v = verify(inp, report, pred)
    out.write_text(json.dumps(v, indent=2) + "\n")
    print("INDEPENDENT", json.dumps(v), flush=True)
    print("COMPLETE", hashlib.sha256(out.read_bytes()).hexdigest(), out, flush=True)
