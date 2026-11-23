"""Replay the frozen 36-condition screen and compare every published field."""
import argparse
import json
import math
from pathlib import Path

from cumulant_screen import run

HERE = Path(__file__).resolve().parent


def compare(actual, expected, path="result"):
    if isinstance(expected, dict):
        actual = {str(key): value for key, value in actual.items()}
        if actual.keys() != expected.keys():
            raise ValueError(f"Different fields at {path}")
        return sum(compare(actual[key], value, f"{path}.{key}")
                   for key, value in expected.items())
    if isinstance(expected, list):
        if not isinstance(actual, (tuple, list)) or len(actual) != len(expected):
            raise ValueError(f"Different list length at {path}")
        return sum(compare(a, b, f"{path}[{index}]")
                   for index, (a, b) in enumerate(zip(actual, expected)))
    if isinstance(expected, float):
        if not math.isclose(actual, expected, rel_tol=5e-10, abs_tol=2e-7):
            raise ValueError(f"{path}: {actual} differs from {expected}")
    elif actual != expected:
        raise ValueError(f"{path}: {actual!r} differs from {expected!r}")
    return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Author's data.npz")
    args = parser.parse_args()
    expected = json.loads((HERE / "comparison.json").read_text())
    actual = run(args.source)
    leaves = compare(actual, expected)
    print(json.dumps({
        "conditions": actual["conditions"],
        "observations": actual["observations"],
        "primary_flags": actual["primary_conditional_screen_flags"],
        "fields_compared": leaves,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
