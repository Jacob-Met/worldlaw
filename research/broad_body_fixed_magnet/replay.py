"""Recount the published optical result from the immutable native output."""

from hashlib import sha256
import json
from math import isclose
from pathlib import Path


ROOT = Path(__file__).resolve().parent
GROUPS = {"attached": (32, 33, 35, 36), "room": (29, 30, 31), "clean": (20, 21, 22, 23)}
LOSSES = ("heading_rmse_deg", "inclination_rmse_deg", "total_rmse_deg")


def read_json(name):
    return json.loads((ROOT / name).read_bytes())


def replay():
    for name, digest in read_json("manifest.json").items():
        assert sha256((ROOT / name).read_bytes()).hexdigest() == digest, name
    p = read_json("physical-protocol.json")
    roles = p["arms"]
    candidate = "rolling_gyro"
    lines = (ROOT / "forecast-lock-owner-original.txt").read_text().splitlines()
    assert lines[0].startswith("OWNER_PATH ")
    records = [json.loads(i) for i in lines[1:]]
    lock = records.pop()
    forecast = {r["forecast_case"]: r for r in records}
    assert lock["forecast_arrays"] == len(forecast) * len(roles) == 88
    assert lock["optical_arrays_read"] == 0
    score = read_json("official-optical-scores.json")
    assert score["forecast_lock"] == lock["prediction_lock"]
    assert score["all_full_quaternion_hashes_checked_before_any_optical_access"] == 88
    rows = score["per_trial"]
    assert set(map(int, rows)) == set(forecast) == {i for ids in GROUPS.values() for i in ids}
    for i, r in rows.items():
        f = forecast[int(i)]
        assert f["n"] == r["samples"] and 0 < r["valid_optical_motion_samples"] <= r["motion_samples"] <= r["samples"]
        assert f["recorded_optical_arrays_read"] == 0
        assert set(f["full_quaternion_hashes"]) == set(roles) == set(r["roles"]) == set(r["worst_by_role"])
        assert all(len(h) == 64 and int(h, 16) >= 0 for h in f["full_quaternion_hashes"].values())
        for arm, worst in r["worst_by_role"].items():
            assert 0 <= worst["index"] < r["samples"] and isclose(worst["time_s"], .0035 * worst["index"])
            assert r["same_sample"]["role_heading_abs_deg"][arm] <= worst["heading_abs_deg"] + 1e-12
        assert r["same_sample"]["index"] == r["worst_by_role"][candidate]["index"]
    mean = {}
    for label, ids in GROUPS.items():
        mean[label] = {}
        for arm in roles:
            for metric in LOSSES:
                value = sum(rows[str(i)]["roles"][arm][metric] for i in ids) / len(ids)
                assert isclose(value, score["group_scores"][label][arm][metric], abs_tol=1e-12)
                if metric == LOSSES[0]:
                    mean[label][arm] = value
    def heading(i, arm):
        return rows[str(i)]["roles"][arm][LOSSES[0]]
    strict_wins = {a: sum(heading(i, candidate) < heading(i, a) for i in GROUPS["attached"]) for a in roles if a != candidate}
    assert strict_wins == score["attached_trial_wins"]
    primary = all(w >= 3 and mean["attached"][candidate] < mean["attached"][a] for a, w in strict_wins.items())
    retention = {g: mean[g][candidate] - mean[g]["raw_vqf"] <= .2 and
                 max(heading(i, candidate) - heading(i, "raw_vqf") for i in GROUPS[g]) <= 1
                 for g in ("clean", "room")}
    assert (primary, retention, primary and all(retention.values())) == (score["attached_gate"], score["retention"], score["joint"])
    return {"trial_methods": 88, "scalar_metrics": 264, "forecast_sha256": score["forecast_lock"],
            "attached_wins": strict_wins, "attached": primary, "retention": retention, "joint": score["joint"]}


if __name__ == "__main__":
    print(json.dumps(replay(), sort_keys=True))
