"""Recover the complete worst gauge/run from the original forecast and observation archives."""
import argparse
import csv
import gzip
import json
import math
import zipfile
from pathlib import Path

from independent_bridge import ARMS, CHANNELS, interp, read, sha

CASE = "loaded/13.9_Run_5"
GAUGE = "Str_255Z"
WITNESS_NS = 1714040960152000000


def export(folder, output):
    clocks = folder / "clock-qualification.json"
    registry = folder / "predictions.json"
    observed = folder / "held_strain.npz"
    locked = folder / "predictions.npz"
    score = json.loads((folder / "held-original.json").read_text())
    reg = json.loads(registry.read_text())
    if (sha(clocks), sha(observed), sha(locked)) != (score["clock_sha256"], score["truth_sha256"], score["pred_sha256"]):
        raise ValueError("Source-clock, observation or forecast archive differs")
    if reg["prediction_sha256"] != sha(locked) or reg["clock_sha256"] != sha(clocks):
        raise ValueError("Forecast registry differs")
    clock = json.loads(clocks.read_text())["fits"][CASE]
    lo = max(clock["optical_trace_start_s"], clock["first_axle_east_s"] - 2)
    hi = min(clock["optical_trace_end_s"], clock["last_axle_west_s"] + 2)
    key = f"{CASE}/{GAUGE}"
    with zipfile.ZipFile(observed) as obs, zipfile.ZipFile(locked) as pred:
        _, ns = read(obs, key + "/utc_ns")
        _, raw = read(obs, key + "/value")
        t = [(u - clock["utc_origin_ns"]) * 1e-9 for u in ns]
        valid = [i for i,v in enumerate(t) if lo <= v <= hi]
        ref = [i for i in valid if t[i] < lo + .5]
        baseline = math.fsum(raw[i] for i in ref) / len(ref)
        grid_key = CASE + "/grid"
        _, grid = read(pred, grid_key, reg["members"][grid_key])
        measured = [value - baseline for value in raw]
        forecasts = {}
        references = {"observed_um_per_m":baseline}
        witness = ns.index(WITNESS_NS)
        if witness != score["raw"]["modal_axles"][CASE][GAUGE]["worst"]["row_in_observed_channel"]:
            raise ValueError("Worst timestamp no longer matches the raw row")
        for arm in ARMS:
            member = CASE + "/" + arm
            _, bank = read(pred, member, reg["members"][member])
            values = [interp(grid, bank, CHANNELS.index(GAUGE), v) if grid[0] <= v <= grid[-1] else None for v in t]
            mean = math.fsum(values[i] for i in ref) / len(ref)
            references[arm] = mean
            curve = [v - mean if v is not None else None for v in values]
            rms = math.sqrt(math.fsum((curve[i]-measured[i])**2 for i in valid)/len(valid))
            if not math.isclose(rms, score["raw"][arm][CASE][GAUGE]["rmse_um_per_m"], abs_tol=1e-10):
                raise ValueError("Whole trace differs from original " + arm)
            forecasts[arm] = curve
    scored = set(valid)
    head = ["row","utc_ns","optical_time_s","in_score","measured_raw_um_per_m","measured_referenced_um_per_m",*ARMS]
    csv_path = output / "worst-passage-trace.csv.gz"
    with csv_path.open("wb") as binary, gzip.GzipFile(fileobj=binary,mode="wb",filename="",mtime=0) as stream:
        import io
        with io.TextIOWrapper(stream,encoding="ascii",newline="") as text:
            writer = csv.writer(text,lineterminator="\n")
            writer.writerow(head)
            for i in range(len(ns)):
                writer.writerow([i,ns[i],t[i],int(i in scored),raw[i],measured[i],*[forecasts[a][i] for a in ARMS]])
    p = {a:forecasts[a][witness] for a in ARMS}
    station = clock["range_intercept"] - 25 - clock["speed"]*t[witness]
    return {"case":CASE,"gauge":GAUGE,"units":"micrometres per metre for all strain columns",
            "rows":len(ns),"scored_rows":len(valid),"reference_rows":len(ref),"input_utc_origin_ns":clock["utc_origin_ns"],
            "score_interval_s":[lo,hi],"grid_interval_s":[grid[0],grid[-1]],"forecast_blank_outside_locked_grid":True,
            "raw_first_and_last_utc_ns":[ns[0],ns[-1]],"reference_offsets":references,
            "optical":{"speed_m_per_s":clock["speed"],"rms_fit_m":clock["rms_fit_m"],
                       "entry_exit_s":[clock["first_axle_east_s"],clock["last_axle_west_s"]]},
            "witness":{"row":witness,"utc_ns":ns[witness],"time_s":t[witness],"observed":measured[witness],
                       "observed_raw":raw[witness],"predicted":p,"signed_error":{a:p[a]-measured[witness] for a in ARMS},
                       "modal_minus_other_arm":{a:p["modal_axles"]-v for a,v in p.items() if a!="modal_axles"},
                       "reflector_and_axle_stations_m":[station,*[station+d for d in (.96,5.46,6.81)]]},
            "trace_sha256":sha(csv_path),"arm_contrasts":"Signed differences between separately fitted whole forecasts.",
            "pins":{"predictions":sha(locked),"truth":sha(observed),"clock":sha(clocks),"original_score":sha(folder/"held-original.json")}}


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input",type=Path)
    parser.add_argument("output",type=Path)
    args=parser.parse_args()
    report=export(args.input,args.output)
    (args.output/"failure-trace.json").write_text(json.dumps(report,sort_keys=True,allow_nan=False))
