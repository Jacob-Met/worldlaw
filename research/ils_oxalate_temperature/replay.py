"""Replay the recorded mass-error and exact-curve census checks."""
import hashlib
import json
import pathlib
import sys

from independent import compare


def load_checked(root, name, digest):
    raw = (root / name).read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError(f"unexpected bytes in {name}")
    return json.loads(raw)


def replay(root):
    forecast = load_checked(root, "forecasts.json", "a3798e58660d0d6589b51cf4a32d931fc37e28a60e9b874590578bf9e6282543")
    score = load_checked(root, "score.json", "c185be5aae1d041c25579d2c9e8121b4d6ff6fcad2770d2beb16037e02aa5019")
    audit = load_checked(root, "duplicate-and-score-recount.json", "a7e30e2bd81bcf2297d38c1697595723e1e5599bb0e442d2f83320c1db0bcbe3")
    receipt = compare(audit, score)
    roster = {(g, s) for g in range(1, 8) for s in range(1, 16)}
    expected_sizes = {"early": 297, "whole": 654, "second": 296, "third": 358, "full": 1000}
    memberships = None
    for name, size in expected_sizes.items():
        window = audit["signatures"][name]
        classes = [tuple(tuple(v) for v in c["members"]) for c in window["classes"]]
        flat = [row for group in classes for row in group]
        assert len(flat) == len(roster) and set(flat) == roster
        assert window["grid_count"] == size and len(classes) == window["count_unique"] == 80
        assert len(window["cross_partition"]) == 5
        if memberships is None:
            memberships = set(classes)
        assert set(classes) == memberships
    assert all(len(p["mass"]) == 14 for p in forecast["groups"].values())
    assert all(len(v) == 654 for p in forecast["groups"].values() for v in p["mass"].values())
    assert audit["physical_coordinate_comparisons"] == 274680 and audit["primary"] is False
    return dict(receipt, distinct_full_curves=80, archive_labels=105, primary=audit["primary"])


if __name__ == "__main__":
    print(json.dumps(replay(pathlib.Path(sys.argv[1])), sort_keys=True))
