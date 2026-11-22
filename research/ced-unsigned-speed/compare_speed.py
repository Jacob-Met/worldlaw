"""Replay the frozen CED forecasts against the organizer's original MAT v4 data."""

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import urllib.request
import zipfile


DATA_URL = "https://uu.diva-portal.org/smash/get/diva2:1165531/FULLTEXT01.zip"
ARCHIVE_SHA = "4379a002295891865ebbf9da15fd1ce253c4ba6586954db525ed6d63d8bb223e"
MAT_SHA = "102c8d8012d6e850d50c13227b8c2280fe69f8bc4a845177f8bc3d761d152c89"
FORECASTS = Path(__file__).with_name("frozen_forecasts.json")


def checked(data, expected):
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("The supplied data differ from the registered source")
    return data


def read_recordings(path=None):
    if path is None:
        with urllib.request.urlopen(DATA_URL, timeout=60) as response:
            data = response.read()
    else:
        data = path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(checked(data, ARCHIVE_SHA))) as archive:
        source = checked(archive.read("DATAUNIF.MAT"), MAT_SHA)
    arrays = {}
    position = 0
    while position < len(source):
        orders = []
        for byte_order in "<>":
            dtype, rows, columns, imaginary, length = struct.unpack_from(byte_order + "5i", source, position)
            if dtype in (0, 1000) and (rows, columns, imaginary, length) == (500, 1, 0, 4):
                orders.append(byte_order)
        if len(orders) != 1:
            raise ValueError("Unexpected MAT v4 vector header")
        name = source[position + 20:position + 24].rstrip(b"\0").decode()
        arrays[name] = struct.unpack_from(orders[0] + "500d", source, position + 24)
        position += 4024
    if position != len(source) or set(arrays) != {"u11", "u12", "z11", "z12"}:
        raise ValueError("Unexpected recording inventory")
    return arrays


def rms(errors):
    return math.sqrt(math.fsum(value * value for value in errors) / len(errors))


def compare(recordings, evidence):
    names = {"psd": "psd", "dyno_author_runtime": "dyno_author_runtime",
             "dyno_pilot_runtime": "dyno_author_runtime"}
    result = {}
    for run, stored in names.items():
        rows = []
        for index, sensor in enumerate(("z11", "z12")):
            # The official two 100-sample test records start at 400. Their
            # ten-sample initialization budget is excluded from every score.
            truth = recordings[sensor][410:500]
            row = {}
            for mode in ("warm", "cold"):
                estimates = evidence["series"][stored][index][mode][10:100]
                if len(estimates) != 90:
                    raise ValueError("Incomplete registered forecast")
                errors = [estimate - sample for sample, estimate in zip(truth, estimates)]
                loss = rms(errors)
                expected = evidence["matched_scores"][run][sensor + "_" + mode]
                if abs(loss - expected) > 1e-12:
                    raise ValueError(f"Recount differs for {run}, {sensor}, {mode}")
                worst = max(range(90), key=lambda i: abs(errors[i]))
                row[mode] = {"rmse": loss, "worst_sample": 410 + worst,
                             "observed": truth[worst], "forecast": estimates[worst],
                             "chronological_rmse": [rms(errors[i:i+30]) for i in (0, 30, 60)]}
            rows.append(row)
        result[run] = rows
    return result


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--archive", type=Path, help="Optional downloaded organizer ZIP")
    args.add_argument("--refit", action="store_true", help="Refit the registered Gram model with NumPy and SciPy")
    options = args.parse_args()
    recordings = read_recordings(options.archive)
    evidence = json.loads(FORECASTS.read_text())
    scores = compare(recordings, evidence)
    if options.refit:
        from fit_gram import check_refit
        print(f"Maximum refit forecast difference {check_refit(recordings, evidence):.3g} ticks/s")
    print(json.dumps(scores, indent=2))


if __name__ == "__main__":
    main()
