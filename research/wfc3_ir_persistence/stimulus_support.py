"""Count illuminated detector coordinates in the 15 public 14016 inputs, without dark images."""
import hashlib
import json
import math
import pathlib
import re
import urllib.request

import numpy as np


VISITS = {
    "01": ("icrr01y7q", "icrr01y8q", "icrr01yaq", "icrr01ycq", "icrr01yeq", "icrr01ygq", "icrr01yiq"),
    "02": ("icrr02ozq", "icrr02p0q", "icrr02p2q", "icrr02p3q", "icrr02p5q"),
    "03": ("icrr03rqq", "icrr03rrq", "icrr03rtq"),
}
SHAPE = (1014, 1014)
THRESHOLDS = (40_000, 70_000)
DTYPES = {-32: ">f4", -64: ">f8", 8: "u1", 16: ">i2", 32: ">i4"}
OUTPUT = pathlib.Path("/var/tmp/p3-f747-hst-wfc3-source-14015-14016-14017")


def fits_value(field):
    value = field.lstrip()
    if value.startswith("'"):
        match = re.match(r"'((?:[^']|'')*)'", value)
        if match is None:
            raise ValueError("Invalid FITS string")
        return match[1].replace("''", "'").rstrip()
    return value.split("/")[0].strip()


def image_data(payload):
    image = {}
    headers = {}
    pos = 0
    while pos < len(payload):
        header = {}
        complete = False
        while not complete:
            block = payload[pos:pos + 2880]
            if len(block) != 2880:
                raise ValueError("Truncated FITS header")
            pos += 2880
            for cell in range(0, 2880, 80):
                card = block[cell:cell + 80].decode("ascii")
                tag = card[:8].strip()
                if tag == "END":
                    complete = True
                    break
                if card[8:10] == "= ":
                    header[tag] = fits_value(card[10:])
        kind = header.get("EXTNAME", "PRIMARY")
        dimensions = tuple(int(header[f"NAXIS{n}"]) for n in range(1, int(header["NAXIS"]) + 1))
        width = int(header["BITPIX"])
        count = math.prod(dimensions) if dimensions else 0
        if int(header.get("PCOUNT", 0)) != 0 or int(header.get("GCOUNT", 1)) != 1:
            raise ValueError("Unexpected HDU structure")
        size = count * (abs(width) // 8)
        if pos + size > len(payload):
            raise ValueError("Truncated FITS array")
        if kind in {"PRIMARY", "SCI", "DQ"}:
            if kind in headers:
                raise ValueError("Duplicate extension")
            headers[kind] = header
            if kind != "PRIMARY":
                arr = np.frombuffer(payload, dtype=DTYPES[width], count=count, offset=pos).reshape(tuple(reversed(dimensions)))
                scale = float(header.get("BSCALE", 1))
                zero = float(header.get("BZERO", 0))
                image[kind] = arr.astype(np.float64) * scale + zero
        pos += ((size + 2879) // 2880) * 2880
    if pos != len(payload):
        raise ValueError("Unaligned FITS end")
    return headers, image


def load_stellar(rootname):
    url = f"https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/{rootname}_flt.fits"
    req = urllib.request.Request(url, headers={"User-Agent": "HST archival stellar-stimulus support audit"})
    with urllib.request.urlopen(req, timeout=150) as response:
        if response.status != 200:
            raise ValueError("Need a complete file")
        b = response.read(19_000_001)
    if len(b) > 19_000_000 or not b.startswith(b"SIMPLE  ="):
        raise ValueError("Unexpected FLT input")
    headers, images = image_data(b)
    h = headers["PRIMARY"]
    if h["ROOTNAME"].lower() != rootname or h["TARGNAME"] != "WESTERLUND-1" or h["PROPOSID"] != "14016":
        raise ValueError("Source identity differs")
    if h["FILTER"] != "F140W" or h["DETECTOR"] != "IR" or h["UNITCORR"] != "COMPLETE":
        raise ValueError("Input calibration differs")
    if headers["SCI"]["BUNIT"] != "ELECTRONS/S" or images["SCI"].shape != SHAPE or images["DQ"].shape != SHAPE:
        raise ValueError("Shape or measurement unit differs")
    duration = float(h["EXPTIME"])
    if duration <= 0 or abs(duration - float(headers["SCI"]["SAMPTIME"])) > 0.005:
        raise ValueError("Single-exposure time differs")
    return np.asarray(images["SCI"] * duration), np.asarray(images["DQ"] == 0), {
        "rootname": rootname, "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b),
        "exptime_s": duration, "start_mjd": float(h["EXPSTART"]), "end_mjd": float(h["EXPEND"]),
        "bunit": headers["SCI"]["BUNIT"], "postarg1": h.get("POSTARG1"), "postarg2": h.get("POSTARG2"),
    }


def count_visit(members):
    counts = {(name, t): np.zeros(SHAPE, dtype=np.uint8) for name in ("finite", "good") for t in THRESHOLDS}
    all_good = np.ones(SHAPE, dtype=bool)
    ledger = []
    signals = []
    masks = []
    for rootname in members:
        electrons, good, record = load_stellar(rootname)
        signals.append(electrons)
        masks.append(good)
        finite = np.isfinite(electrons)
        all_good &= finite & good
        record["finite"] = int(finite.sum())
        record["good"] = int((finite & good).sum())
        for name, t in counts:
            mask = finite & (electrons >= t)
            if name == "good":
                mask &= good
            counts[name, t] += mask
            record[f"{name}_ge{t}"] = int(mask.sum())
        ledger.append(record)
    result = {}
    for (name, t), arr in counts.items():
        result[f"{name}_ge{t}"] = np.bincount(arr.ravel(), minlength=len(members)+1).tolist()
        result[f"{name}_ge{t}_all_good"] = np.bincount(arr[all_good], minlength=len(members)+1).tolist()
    structure = {}
    for t in THRESHOLDS:
        support = (counts["good", t] >= 2) & all_good
        tiles = np.zeros((32, 32), dtype=np.int32)
        y, x = np.nonzero(support)
        np.add.at(tiles, (y // 32, x // 32), 1)
        if np.any(all_good):
            eligible = np.where(all_good, counts["good", t], -1)
            i, j = np.unravel_index(int(eligible.argmax()), SHAPE)
            exemplar = {"row": int(i), "column": int(j), "count": int(eligible[i, j]),
                        "electrons": [float(a[i, j]) for a in signals], "good": [bool(a[i, j]) for a in masks]}
        else:
            exemplar = None
        structure[str(t)] = {"n_overlaps": int(support.sum()), "tiles_with_overlap": int(np.count_nonzero(tiles)),
                             "tiles_total": int(tiles.size), "max_overlap_in_one_tile": int(tiles.max()),
                             "first_most_repeated_site": exemplar}
    return {"members": ledger, "coordinates_good_in_all_inputs": int(all_good.sum()), "histograms": result,
            "spatial_support": structure}


def main():
    result = {}
    for v, members in VISITS.items():
        result[v] = count_visit(members)
        out = OUTPUT / ("stellar-support-" + v + ".json")
        out.write_text(json.dumps(result[v], sort_keys=True))
        print("VISIT", v, hashlib.sha256(out.read_bytes()).hexdigest(), flush=True)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
