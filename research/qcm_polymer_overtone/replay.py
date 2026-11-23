"""Replay the archive census and both synthetic impedance calculations, offline."""
import json
import math
import sys
from collections import Counter
from pathlib import Path

from layer_oracle import verify as matrix_check
from traveling_wave import verify as wave_check


def replay(directory):
    schema = json.loads((directory / "source-schema.json").read_text())
    files = schema["csv_classes"]
    paths = [path for record in files.values() for path in record["paths"]]
    expected_paths = {member["name"] for record in schema["archives_2_3_4"].values()
                      for member in record["members"] if member["name"].lower().endswith(".csv")}
    assert len(paths) == len(set(paths)) == 22 and expected_paths == set(paths)
    assert Counter(row["header"][1] for row in files.values()) == {"f3": 3, "f5": 2}
    assert sorted(len(row["paths"]) for row in files.values()) == [4, 4, 4, 5, 5]
    for row in files.values():
        assert sum(row["widths"].values()) == row["rows"]
        assert row["header"][2].replace("d", "f") == row["header"][1]
    assert [(x["row_ordinal"], x["col_ordinal"], x["label"])
            for x in schema["wide_field_markers"]] == [(10277, 7, "f3 [Hz]"), (10277, 8, "f3 [Hz]")]
    receipt = json.loads((directory / "oracle-receipt.json").read_text())
    rerun = matrix_check()
    for harmonic, record in receipt["curves"].items():
        for name in ("KV", "relaxation"):
            for actual, stored in zip(rerun["curves"][int(harmonic)][name], record[name]):
                assert math.isclose(actual, stored, rel_tol=1e-13, abs_tol=1e-10)
    return {"unique_CSVs": len(files), "paths": len(paths), **wave_check(receipt),
            "measured_forecasts": 0, "measured_scores": 0}


if __name__ == "__main__":
    print(json.dumps(replay(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent)))
