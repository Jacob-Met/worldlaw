"""Verify the two measured-coordinate receipts and the original four forecast arrays offline."""
import base64
import hashlib
import json
import pathlib
import struct
import sys

root = pathlib.Path(sys.argv[1])
def read(name):
    return json.loads((root / name).read_text())
def terminal(name):
    return json.loads((root / name).read_text().splitlines()[-1])
def digest(data):
    return hashlib.sha256(data).hexdigest()

protocol = read("protocol.json")
roles = protocol["roles"]
raw = read("raw-score.json")
physical = read("author-ordinate-score.json")
assert raw == terminal("score-original.txt")
assert physical == terminal("author-ordinate-score-original.txt")
for score, recount in [(raw, terminal("raw-independent-original.txt")), (physical, terminal("physical-independent-original.txt"))]:
    assert score["roles"] == roles and score["locks"] == recount["archives"]
    assert score["native_residuals"] == recount["native_role_residuals"] == 6800000
    assert recount["held_metrics"] == 160 and recount["extrema"] == 80
    assert recount["absolute_metric_difference"] < 1e-12
    decisions = []
    for index, rep in enumerate(protocol["repeats"]):
        forecast = read(f"forecast-{rep}.json")
        lock = read(f"forecast-lock-{rep}.json")["meta"]
        assert lock["target_ordinates_read"] == 0 and lock["roles"] == roles
        assert lock["protocol_sha"] == digest((root / "protocol.json").read_bytes())
        blocks = [struct.pack("<750d", *x) for x in forecast["vectors"]]
        original = base64.b64decode(forecast["header"], validate=True) + b"".join(blocks)
        assert len(original) == lock["n"] and digest(original) == lock["sha"] == score["locks"][index]
        assert [digest(b) for b in blocks] == lock["role_sha"]
        row = score["rows"][index]
        assert raw["rows"][index]["target_sha"] == physical["rows"][index]["raw_target_sha"]
        for k, series in enumerate(forecast["vectors"]):
            worst = row["bin_max"][k]
            assert series[worst["bin"]] == worst["estimate"] and worst["estimate"] - worst["measured"] == worst["signed"]
            native = row["raw_max"][k]
            assert series[native["bin"]] == native["forecast"]
        for cell in row["worst_primary_window"]:
            assert [y[cell["bin"]] for y in forecast["vectors"]] == cell["forecasts"]
        rmse = row["binned_rmse"]
        passed = all(rmse[0] < rmse[k] for k in (1, 2, 3, 4, 5))
        assert row["gate"] == passed
        decisions.append(passed)
    assert decisions == recount["gates"] == [False] * 4
    assert all(decisions) == score["gate"] == recount["joint"]
audit = terminal("physical-independent-original.txt")
checks = [q for q in audit["export_checks"] if q["skip_source_rows"] == 1]
assert len(checks) == 4 and max(q["detuning_max_abs_MHz"] for q in checks) < 7e-11
assert max(q["physical_residual_rms"] for q in checks[:3]) < 5e-16
assert checks[3]["physical_minus_one_residual_rms"] < 1e-16 and checks[3]["physical_residual_rms"] == 1.0
print("40 fixed arrays, two independent 160-metric receipts, four processed exports, both comparisons failed.")
