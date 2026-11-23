"""Independently replay the unopened/loaded boundary and the native reference decision."""
import argparse
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import statistics
import struct
import zipfile

from aperture_ambiguity import controls
from source_clocks import evaluate

HERE = Path(__file__).resolve().parent
D = Decimal
MEMBER = "campaign_a/datasources/FBG/0_ref/Responses.20260219155941.txt"
REF_HASH = "5c45ca74acf6ac6be92ca79388c1c02ab80d270c5e985bbcaa2b24a0c080a891"
CARRIERS = [D("1551.16"), D("1560.68"), D("1569.44")]
EXPECTED = [
    ["21.85", "0", "0", "-0.92"],
    ["23.09", "0", "0", "0.995"],
    ["0", "24.63", "0", "21.46"],
]


def independent_reference(path):
    axis = {}
    with zipfile.ZipFile(path) as z, z.open(MEMBER) as f:
        for line in f:
            if re.fullmatch(rb"19/02/2026 15:59:41\.89120", line.strip()):
                break
            for key in [b"Wavelength Start (nm)", b"Wavelength Delta (nm)", b"Number of Points"]:
                if line.startswith(key + b":"):
                    axis[key] = D(line.split(b":", 1)[1].strip().decode().replace(",", "."))
        else:
            raise ValueError("Expected original first timestamp missing")
        if list(axis.get(k) for k in (b"Wavelength Start (nm)", b"Wavelength Delta (nm)",
                                      b"Number of Points")) != [1460, D(".008"), 20000]:
            raise ValueError("Unexpected raw wavelength grid")
        # Only the four rows in the single authorized unloaded exposure are decoded.
        channels = []
        for i in range(4):
            values = [D(x.decode().replace(",", ".")) for x in f.readline().strip().split(b"\t")]
            if len(values) != 20000 or not all(v.is_finite() for v in values):
                raise ValueError("Reference grid or coverage differs")
            channels.append(values)
    digest = hashlib.sha256()
    for row in channels:
        digest.update(struct.pack("<20000d", *map(float, row)))
    if digest.hexdigest() != REF_HASH:
        raise ValueError("Received reference bytes differ")
    contrasts, winners = [], []
    for c in CARRIERS:
        distances = [abs(D(1460) + i * D(".008") - c) for i in range(20000)]
        inner = [i for i, x in enumerate(distances) if x <= D(".75")]
        outer = [i for i, x in enumerate(distances) if D("1.5") <= x <= 3]
        row = [max(ch[i] for i in inner) - statistics.median(ch[i] for i in outer)
               for ch in channels]
        ranked = sorted(range(4), key=row.__getitem__, reverse=True)
        a, b = ranked[:2]
        winners.append(a + 1 if row[a] > max(0, row[b]) and row[a] >= 2 * max(0, row[b]) else None)
        contrasts.append(row)
    if contrasts != [[D(word) for word in row] for row in EXPECTED] or winners != [1, 1, None]:
        raise ValueError("Independent exact-ordinate reference gate differs")
    return {"reference_f64_sha256": digest.hexdigest(),
            "exact_contrasts": [[str(x) for x in row] for row in contrasts],
            "winning_channels": winners, "unloaded_exposures": 1, "loaded_ordinates_decoded": 0}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive", type=Path)
    args = p.parse_args()
    expected = json.loads((HERE / "clock_qualification.json").read_text())
    clock = evaluate(args.archive)
    if json.dumps(clock, sort_keys=True, allow_nan=False) != json.dumps(expected, sort_keys=True, allow_nan=False):
        raise ValueError("Authentic original clock reconstruction differs")
    reference = independent_reference(args.archive)
    result = {"clock_files": len(clock["optical_file_timing"]), "machine_rows": clock["machine_rows"],
              "paired_starts": 2 * len(clock["ten_matched_pairs"]), "reference": reference,
              "aperture_controls": controls(), "loaded_forecast_admission": False}
    print(json.dumps(result, sort_keys=True, allow_nan=False))


if __name__ == "__main__":
    main()
