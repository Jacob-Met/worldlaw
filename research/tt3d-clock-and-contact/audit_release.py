"""Authenticate all 139 author exports and parse only their timestamps."""
import argparse
import hashlib
import json
import math
from concurrent.futures import ThreadPoolExecutor
from itertools import combinations
from pathlib import Path
from statistics import median
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "source_manifest.json").read_text())
PREFIX = "data/evaluation/3D_gt/"


def project(item):
    name, entry = item
    url = f"https://raw.githubusercontent.com/{MANIFEST['repository']}/{MANIFEST['commit']}/{name}"
    with urlopen(Request(url, headers={"User-Agent": "tt3d-clock-audit/1"}), timeout=100) as response:
        data = response.read(entry["bytes"] + 1)
    obj = b"blob " + str(len(data)).encode() + b"\0" + data
    if len(data) != entry["bytes"] or hashlib.sha1(obj).hexdigest() != entry["git_blob"]:
        raise ValueError(f"source identity mismatch for {name}")
    header, *rows = data.splitlines()
    if [s.strip() for s in header.decode("utf-8-sig").split(",")] != ["Timestamp", "X", "Y", "Z"]:
        raise ValueError(f"unexpected source columns for {name}")
    clock = [float(row.partition(b",")[0]) for row in rows if row.strip()]
    gaps = [b - a for a, b in zip(clock, clock[1:])]
    if not all(math.isfinite(t) for t in clock) or min(gaps) <= 0:
        raise ValueError(f"invalid timestamps for {name}")
    return name, clock, {"header": ["Timestamp", "X", "Y", "Z"], "n": len(clock), "first": clock[0],
                  "last": clock[-1], "min_dt": min(gaps), "median_dt": median(gaps),
                  "max_dt": max(gaps), "nonincreasing": 0, "sha1": entry["git_blob"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional per-ID timestamp summary file")
    out = parser.parse_args().output
    roster = {p: v for p, v in MANIFEST["files"].items() if p.startswith(PREFIX)}
    expected = [f"{PREFIX}{i:03d}.csv" for i in range(1, 140)]
    if sorted(roster) != expected:
        raise ValueError("source roster mismatch")
    with ThreadPoolExecutor(max_workers=5) as pool:
        projected = list(pool.map(project, sorted(roster.items())))
    records = {name: record for name, _, record in projected}
    clocks = {name: set(clock) for name, clock, _ in projected}
    overlaps = []
    for left, right in combinations(records, 2):
        a, b = records[left], records[right]
        intersection = min(a["last"], b["last"]) - max(a["first"], b["first"])
        if intersection >= 0:
            overlaps.append([Path(left).stem, Path(right).stem, intersection, len(clocks[left] & clocks[right])])
    frozen = json.loads((ROOT / "qualification.json").read_text())
    if overlaps != frozen["clock_intersections"]:
        raise ValueError("time interval or shared-clock comparison mismatch")
    result = {"source_commit": MANIFEST["commit"], "record_projection": records,
              "numerical_positions_used": False, "simulated_2d_used": False}
    blob = (json.dumps(result, sort_keys=True, indent=2) + "\n").encode()
    digest = hashlib.sha256(blob).hexdigest()
    if digest != "79a5c25ca4ea69781ee2c8e964a8c680c5a58c2eb5a48f4b6ffcccd7901cf6c0":
        raise ValueError("timestamp projection differs from original")
    if out:
        out.write_bytes(blob)
    worst = max(records, key=lambda p: records[p]["max_dt"])
    print(json.dumps({"files": len(records), "rows": sum(r["n"] for r in records.values()),
                      "largest_gap_id": worst, "largest_gap_s": records[worst]["max_dt"],
                      "examined_pairs": len(records) * (len(records) - 1) // 2,
                      "intersections": overlaps, "projection_sha256": digest}, indent=2))


if __name__ == "__main__":
    main()
