#!/usr/bin/env python3
"""Recount the 42 published Panasonic HPPC forecasts against original MAT voltages."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from statistics import fmean, median
from urllib.parse import quote
from urllib.request import urlopen

from scipy.io import loadmat


def source_bytes(plan, name, expected, directory=None):
    if directory is not None:
        data = (directory / name).read_bytes()
    else:
        host = "https://huggingface.co/datasets/bsebench-org/panasonic-kollmeyer-2018-raw"
        url = f"{host}/resolve/{plan['dataset_revision']}/{quote(name)}"
        with urlopen(url, timeout=90) as response:
            data = response.read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"Unexpected bytes for {name}")
    return data


def read_plan():
    path = Path(__file__).with_name("frozen_forecasts.json")
    data = path.read_bytes().rstrip(b"\n")
    expected = "ec2984f255e2c1e42e0feb35b61968a7a2be235e96138b846c92b5a70df670f4"
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("Forecast manifest SHA-256 mismatch")
    return json.loads(data)


def summarize(rows):
    point = {}
    for name in rows[0]["point_drop_mV"]:
        errors = [r["point_drop_mV"][name] - r["observed_drop_mV"] for r in rows]
        worst = max(range(len(rows)), key=lambda j: abs(errors[j]))
        point[name] = dict(mae_mV=fmean(map(abs, errors)),
                           rmse_mV=fmean(e * e for e in errors) ** .5,
                           max_absolute_mV=abs(errors[worst]), worst_row=rows[worst]["row"])
    intervals = {}
    for name in rows[0]["interval_drop_mV"]:
        widths, misses = [], []
        for r in rows:
            lo, hi = r["interval_drop_mV"][name]
            y = r["observed_drop_mV"]
            widths.append(hi - lo)
            misses.append(max(0., lo - y, y - hi))
        worst = max(range(len(rows)), key=misses.__getitem__)
        intervals[name] = dict(inside=sum(d == 0 for d in misses), count=len(rows),
                               at_most_10mV=sum(w <= 10 for w in widths),
                               median_width_mV=median(widths), max_width_mV=max(widths),
                               max_miss_mV=misses[worst],
                               worst_missed_row=rows[worst]["row"] if misses[worst] > 0 else None)
    return dict(points=point, intervals=intervals)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Root of an extracted, unmodified dataset copy")
    parser.add_argument("--details", action="store_true", help="Include every row, spectrum and horizon")
    args = parser.parse_args()
    plan = read_plan()
    raw = source_bytes(plan, plan["source_file"], plan["source_sha256"], args.source_dir)
    m = loadmat(io.BytesIO(raw), struct_as_record=False, squeeze_me=True)["meas"]
    results = []
    for source in plan["rows"]:
        r = dict(zip(plan["columns"], source))
        observed = float(m.Voltage[r["target_row"]])
        pre = float(m.Voltage[r["start"]-1])
        if pre != r["pre_voltage"]:
            raise ValueError(f"Baseline mismatch at {r['start']}")
        results.append(dict(spectrum=r["spectrum"], row=r["target_row"], elapsed_s=r["elapsed_seconds"],
                            horizon_s=r["nominal_seconds"], pre_V=pre, end_V=observed,
                            observed_drop_mV=1000*(pre-observed),
                            point_drop_mV=dict(zip(plan["point_names"],r["point_drop_mV"])),
                            interval_drop_mV=dict(zip(plan["interval_names"],r["interval_drop_mV"]))))
    pooled = summarize(results)
    n=len(results)
    if n != 42 or len({r["row"] for r in results}) != n:
        raise ValueError("Invalid fixed course")
    gates = {k: pooled["intervals"][k]["inside"]==n and pooled["intervals"][k]["at_most_10mV"]==n
             for k in ("zero","prehistory25A")}
    ref=pooled["points"][plan["primary_comparator"]]
    mid=pooled["points"]["strict-zero-midpoint"]
    gates["midpoint_better_mae"] = mid["mae_mV"] < ref["mae_mV"]
    gates["midpoint_better_worst"] = mid["max_absolute_mV"] < ref["max_absolute_mV"]
    gates["midpoint_joint"] = gates["midpoint_better_mae"] and gates["midpoint_better_worst"]
    out = {"n":n,"source_mat_decoded_as_whole":True,"scored_response_rows":n,"primary_comparator":plan["primary_comparator"],"pooled":pooled,"gates":gates}
    if args.details:
        out["rows"]=results
        out["by_horizon"]={str(h):summarize([r for r in results if r["horizon_s"]==h]) for h in (1,5,9)}
        out["by_spectrum"]={s:summarize([r for r in results if r["spectrum"]==s])
                            for s in sorted({r["spectrum"] for r in results})}
    print(json.dumps(out, sort_keys=True, indent=2, allow_nan=False))


if __name__=="__main__":
    main()
