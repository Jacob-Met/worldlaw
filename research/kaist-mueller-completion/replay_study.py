"""Verify and stream each complete released development material, then recompute all arms."""
import argparse
import hashlib
import json
from pathlib import Path

from assess import run
from design import TRAIN_GROUPS
from raw_panel import extract
from recount import compare


def verify_projection(folder, expected):
    receipt = json.loads((folder / "source-receipt.json").read_text())
    for name in ("material", "raw_member", "raw_sha256", "compressed_sha256",
                 "crc32", "bytes", "compressed_bytes", "coordinate_count", "directory_sha256"):
        if receipt[name] != expected[name]:
            raise ValueError(f"source receipt differs in {name}")
    for file, key in (("linear.npz", "linear_sha256"), ("circular.npz", "circular_sha256")):
        digest = hashlib.sha256((folder / file).read_bytes()).hexdigest()
        if digest != receipt[key] or digest != expected[key]:
            raise ValueError(f"wrong projection digest for {folder / file}")
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path, help="cache and output directory")
    parser.add_argument("--fetch", action="store_true", help="stream raw author ZIP members for missing development materials")
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    roster = json.loads((base / "public-roster.json").read_text())
    originals = json.loads((base / "development-sources.json").read_text())
    expected_ids = {i for group in TRAIN_GROUPS.values() for i in group}
    if {int(i) for i in originals} != expected_ids:
        raise ValueError("registered development material IDs disagree")
    for i in sorted(expected_ids):
        path = args.data / str(i)
        if not (path / "source-receipt.json").exists():
            if not args.fetch:
                parser.error(f"missing registered projection for material {i}. Use --fetch to obtain it.")
            entry = next(a for a in roster if a["url"].rsplit("/", 1)[-1].split("_", 1)[0] == str(i))
            receipt = extract(entry, path)
            receipt["material"] = i
            (path / "source-receipt.json").write_text(json.dumps(receipt, sort_keys=True) + "\n")
        verify_projection(path, originals[str(i)])
    result = run(args.data, "development")
    recount = compare(args.data, "development")
    print(json.dumps({"gates": result["gates"], "overall": result["overall"],
                      "independent_counts": recount["counts"]}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
