"""Recount stored forecasts and optionally authenticate the original NASA PDS temperatures."""
import argparse
import json
from pathlib import Path

from independent import verify


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path, nargs="?", default=Path(__file__).parent)
    parser.add_argument("--source", action="store_true")
    args = parser.parse_args()
    print(json.dumps(verify(args.directory, args.source), sort_keys=True))
