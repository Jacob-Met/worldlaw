"""Verify immutable external-development receipts without fetching or scoring validation data."""
import hashlib
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parent
EXPECTED={
    "development-falsifier.json": "a04a5b52dd707dc6e09accc73f9cec207c21d77a66ad50d12446b830a4394c01",
    "diagnose_development.py": "b69ca9edaa25aa2a10676bb7c248ef472b90d29e3352c3f567b948bab9efab53",
    "early_capacity.py": "3296e434cb9d3b96f685e204fced8662f426b94a1e6714ff29093f4894bbb8c3",
    "forecast.py": "76d1b3769c9036ba6bde8ac2437222dadbb7552374cf7d344083ebcafbf1e090",
    "historical-model.json": "56656d8ae4f5fb05f76152cf53c0e4db9ff38aef228e68cc66af63bfbf8b4a39",
    "independent-recount.json": "302c3eda0541bfe6379a17c0d4da66d89ca2b844c70d959846616f75096e0adf",
    "independent_fit.py": "4b1728ce62a4d4a33ec0a22186f8e223e793daa69b17ce1de447c6fb4d27644f",
    "native-originals.json": "0124d954d4b979e31849c16aaf02da13f601cf2e1febbe19ed5638ec6425784d",
    "qualify.py": "22ae9a09c79d0788adb7e121b2eeab439a3980ed0a94d07d4c2a48d53bc97ad3",
    "score.py": "7562541d5cd347e0b37d03e49ec919f630287f65cb017db178f48467f5a29fde",
    "source-qualification.json": "d6705533ee45059cb485b35e3b33754e2f8cd54ac644fc81837c8fe739cba390"
}

def read(name):
    return json.loads((ROOT/name).read_bytes())

def main():
    for name,digest in EXPECTED.items():
        assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
    model=read("historical-model.json")
    raw=read("development-falsifier.json")
    cold=read("independent-recount.json")
    source=read("source-qualification.json")
    jobs=read("native-originals.json")
    assert [model["n_fit"],model["n_development"]]==[41,42]
    assert model["shrink"]["shape"]==cold["bounded"]==0 and cold["replicated_df"]==4
    assert abs(cold["unconstrained"]-raw["shrink"])<1e-7
    assert abs(cold["penalty_losses"]["100.0"]-model["dev_diagnostics"]["shape"]["absolute_RMSE"])<1e-6
    assert len(cold["penalty_losses"])==4 and cold["validation_requests"]==0
    worst=raw["historical_worst"]
    assert abs(sum(worst["per_feature_correction_contributions"])+worst["intercept"]+worst["early"]-worst["shape"])<1e-8
    assert source["sampled_spike"]["values_Ah"][3]==2.8840845 and worst["row"]==7
    assert source["membership"]["compact_missing_channels"]==[12] and source["membership"]["max_early_forecast_rounding_delta"]==0
    assert source["membership"]["unique_barcodes"]==45 and 46 not in source["membership"]["channels"]
    assert source["validation_measured_prefixes_opened"]==source["validation_endpoint_values_opened"]==0
    assert math.isclose(sum(g["centered_xy"] for g in raw["groups"]),raw["shrink_crossproduct"])
    assert math.isclose(sum(g["centered_xx"] for g in raw["groups"]),raw["shrink_ss"])
    assert len(jobs)==7 and sum(j["state"]=="completed" for j in jobs)==6
    failed=[j for j in jobs if j["state"]=="failed"]
    assert len(failed)==1 and "ufeff" in failed[0]["failure"]
    assert all(j["descendant_state"]=="drained" for j in jobs)
    print("Verified external 41+42 cells, four contrast dimensions, zero admitted shape weight and zero validation scores.")

if __name__=="__main__":
    main()
