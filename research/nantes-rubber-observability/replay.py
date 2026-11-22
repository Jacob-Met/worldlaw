"""Replay the finite constitutive certificate and verified Nantes design statistics."""

import argparse
import json
import tempfile
import urllib.request
from pathlib import Path

import numpy as np

from witness import control

HERE = Path(__file__).resolve().parent
RECORD = "https://zenodo.org/api/records/10033038/files"
FILES = {
    "ANR_1-2_v0066": (114132208, "489e15c2dadee1b2b4b040126c89863e"),
    "ANR_2-1_v066": (140842552, "91008f62276eae2b6bad8b97028f318b"),
    "ANR_2-2_v005": (239477957, "ae9668f2af93f78034da58f7bc5def15"),
    "ANR_3-1_v00066": (232614167, "349f2efa8b2f0948366c0689d8219441"),
}


def verify_numbers(actual, expected):
    if isinstance(expected, dict):
        assert actual.keys() == expected.keys(), (actual.keys(), expected.keys())
        for key in expected:
            verify_numbers(actual[key], expected[key])
    elif isinstance(expected, list):
        assert len(actual) == len(expected)
        for a, e in zip(actual, expected):
            verify_numbers(a, e)
    elif isinstance(expected, float):
        np.testing.assert_allclose(actual, expected, rtol=2e-9, atol=2e-10)
    else:
        assert actual == expected, (actual, expected)


def check_alternate(path):
    """Inspect only the first experimental alternate container's public struct keys."""
    import hashlib

    import h5py

    assert path.stat().st_size == 114132208
    with path.open("rb") as f:
        assert (
            hashlib.file_digest(f, "md5").hexdigest()
            == "2de0c665b9ba6f33923cc5dd11730ef9"
        )
    with h5py.File(path) as source:
        keys = sorted(source["data"])
        frames = len(source["data"]["U"])
    return {"fields": keys, "frames": frames}


def main():
    from receive import derivative_gate, design_summary

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="directory containing the four official experimental .mat files",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="download and check the four complete source files",
    )
    parser.add_argument(
        "--alternate",
        type=Path,
        help="check the first experimental .ascii container's struct fields without reading outcomes",
    )
    args = parser.parse_args()
    if args.download and args.source_dir:
        parser.error("choose one source mode")
    expected = json.loads((HERE / "results.json").read_text())
    if args.alternate:
        assert check_alternate(args.alternate) == expected["first_alternate"]
        print("First alternate container verified")
    assert control()["relative_gap"] == "20/143"
    check = derivative_gate()
    assert check["inactive_transition_full"] == [128, 18, 154]
    assert sum(d["active"] for d in expected["designs"]) == 194322
    assert sum(d["frames"] for d in expected["designs"]) == 2999
    assert sum(d["element_frames"] for d in expected["designs"]) == 10742505
    assert [d["has_F_table"] for d in expected["designs"]] == [False, True, True, True]
    assert set(expected["boundary_incidence"]) == set(FILES)
    for key, design in zip(FILES, expected["designs"], strict=True):
        incidence = expected["boundary_incidence"][key]
        assert incidence["source"] == design["source"] == key + "_experimental_data.mat"
        assert incidence["all_active"] == design["active"]
        assert incidence["incident_active"] == 0
        assert incidence["closest_squared_distance"] > 0.1
        assert design["projection_peaks"][0]["magnitude"] == 0.0
        assert design["projection_peaks"][1]["magnitude"] > 0.0
    print("Exact witness 20/143; independent energy-gradient check", check)
    if args.download or args.source_dir:
        from project import file_run

        from incident import certify

        with tempfile.TemporaryDirectory() as scratch:
            root = args.source_dir or Path(scratch)
            for (prefix, (size, md5)), recorded in zip(
                FILES.items(), expected["designs"], strict=True
            ):
                name = prefix + "_experimental_data.mat"
                target = root / name
                if args.download:
                    request = urllib.request.Request(
                        f"{RECORD}/{name}/content",
                        headers={"User-Agent": "WORLDLAW-Nantes-replay/1"},
                    )
                    with (
                        urllib.request.urlopen(request, timeout=180) as source,
                        target.open("wb") as out,
                    ):
                        while chunk := source.read(1 << 20):
                            out.write(chunk)
                assert target.stat().st_size == size
                result = file_run(target, md5)
                verify_numbers(design_summary(result), recorded)
                verify_numbers(
                    certify(target, md5), expected["boundary_incidence"][prefix]
                )
        print("All four raw DIC projections reproduced")
    else:
        print("Saved design counts checked. Use --download for a raw-source replay.")


if __name__ == "__main__":
    main()
