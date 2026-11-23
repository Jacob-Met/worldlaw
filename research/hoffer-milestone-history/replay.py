"""Rebuild each forecast from the public archive and compare the full held-direction outcome."""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

from course import filehash
from reversible_control import certify

HERE = Path(__file__).resolve().parent

def read(path):
    return json.loads(path.read_text())

def compare(actual, expected, path="result"):
    if isinstance(expected, dict):
        if actual.keys() != expected.keys():
            raise ValueError(f"Different fields in {path}")
        for name, value in expected.items():
            compare(actual[name], value, f"{path}.{name}")
    elif isinstance(expected, list):
        if len(actual) != len(expected):
            raise ValueError(f"Different number of entries in {path}")
        for i, value in enumerate(expected):
            compare(actual[i], value, f"{path}[{i}]")
    elif isinstance(expected, float):
        if not math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-10):
            raise ValueError(f"{path} differs: {actual} versus {expected}")
    elif actual != expected:
        raise ValueError(f"{path} differs: {actual} versus {expected}")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True,
                        help="Authenticated public ZIP; downloaded at this path if absent.")
    parser.add_argument("--scratch", type=Path, required=True, help="New directory for the replay.")
    args = parser.parse_args()
    args.scratch.mkdir(parents=True, exist_ok=False)
    archive = args.archive.resolve()
    archive.parent.mkdir(parents=True, exist_ok=True)
    for stage, source in (("donor", None), ("prefix", "donor/donors.npz"), ("score", "prefix/predictions.npz")):
        command = [sys.executable, str(HERE/"course.py"), stage, str(archive), str(args.scratch/stage)]
        if source:
            bank = args.scratch/source
            command.extend(["--input", str(bank), "--sha", filehash(bank)])
        subprocess.run(command, check=True)
    result_path = args.scratch/"score/score.json"
    observed = read(result_path)
    reference = read(HERE/"outcome.json")
    original_hash = reference.pop("prediction_sha256")
    replay_hash = observed.pop("prediction_sha256")
    compare(observed, reference)
    result = args.scratch/"independent.json"
    subprocess.run([sys.executable, str(HERE/"independent.py"), str(archive),
                    str(args.scratch/"prefix/predictions.npz"), str(result_path), str(result)], check=True)
    compare(read(result), read(HERE/"independent-receipt.json"))
    from sensitivity import bounds
    compare(bounds(observed), read(HERE/"missing-bounds.json"))
    print(json.dumps({"original_forecast_sha256": original_hash, "replay_forecast_sha256": replay_hash,
                      "original_forecast_bytes_reproduced": replay_hash == original_hash,
                      "gates": observed["gates"], "joint": observed["joint"], "reversible_witness": certify()},
                     sort_keys=True))

if __name__ == "__main__":
    main()
