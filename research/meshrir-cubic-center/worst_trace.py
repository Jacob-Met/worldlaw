"""Read every recorded donor at the largest held direction-minimax error."""
import math
from pathlib import Path
import zipfile
from independent import read_signal


def worst_trace(archive, bank, outcome):
    center = outcome["witnesses"]["direction_minimax"]
    row = bank["held_member_ids"].index(center["id"])
    column = bank["frequencies"].index(center["hz"])
    ids = bank["donor_ids"][row]
    with zipfile.ZipFile(archive) as source:
        members = {
            int(Path(name).stem.split("_")[-1]): name
            for name in source.namelist()
            if "__MACOSX" not in Path(name).parts
            and Path(name).stem.startswith("ir_") and name.endswith(".npy")
        }
        donors = [read_signal(source.read(members[member]))[column] for member in ids]
    norm = abs(complex(*center["response"]))
    return {
        "center": center,
        "all_predictions": {
            arm: vectors[row][column] for arm, vectors in bank["forecasts"].items()
        },
        "donor_ids": ids,
        "donors": [[value.real, value.imag] for value in donors],
        "relative_max_donor_to_center": max(map(abs, donors)) / norm,
    }


def verify_worst_trace(archive, bank, outcome, saved):
    actual = worst_trace(archive, bank, outcome)
    assert actual["center"] == saved["center"]
    assert actual["all_predictions"] == saved["all_predictions"]
    assert actual["donor_ids"] == saved["donor_ids"] and len(actual["donors"]) == 26
    error = max(
        abs(complex(*a) - complex(*b))
        for a, b in zip(actual["donors"], saved["donors"])
    )
    assert error < 1e-10
    assert math.isclose(
        actual["relative_max_donor_to_center"], saved["relative_max_donor_to_center"],
        rel_tol=1e-10, abs_tol=1e-10,
    )
    print("Worst-center raw donor differences", error)
