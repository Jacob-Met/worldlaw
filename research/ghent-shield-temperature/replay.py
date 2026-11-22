"""Replay the prospective Ghent active/passive instrument comparison."""
import argparse
import csv
import hashlib
import io
import json
import math
from datetime import datetime
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

SOURCE = {
    "Campbell1": "49f7a913993456ce3a8d4157af5655db2b395126c9935532623d8bdd78361840",
    "Campbell2": "7794fd12f87b4a5465014a3c756afd39b10f255d8e20fd7deae9254ad7d005ff",
}
METHODS = ("identity", "station_mean", "radiation", "static", "raw_lags", "thermal_memory", "boosted")
DAYS = ("2023-05-29", "2023-05-30", "2023-05-31", "2023-06-01")
INPUTS = ("Tap", "RH", "SWR", "V", "Tg")
TAUS = np.array([30., 60., 120.])


def read_development(directory):
    rows = []
    for station, digest in SOURCE.items():
        file = directory / (station + "_device_intercomparison.csv")
        original = file.read_bytes()
        if hashlib.sha256(original).hexdigest() != digest:
            raise ValueError(f"Unexpected source bytes for {file.name}")
        station_rows = []
        for raw in csv.DictReader(io.StringIO(original.decode("utf-8-sig"))):
            t = datetime.fromisoformat(raw["datetime"])
            fields = {k: float(raw[k]) if raw[k] else math.nan for k in (*INPUTS, "Taa")}
            station_rows.append(dict(station=station, time=t, **fields))
        if len(station_rows) != 576 or any((b["time"]-a["time"]).total_seconds() != 900 for a,b in zip(station_rows,station_rows[1:])):
            raise ValueError(f"Unexpected source clock for {station}")
        rows.extend(station_rows)
    return rows


def features(rows):
    out = []
    history = []
    last = None
    decay = np.exp(-15/TAUS)[:,None]
    for row in rows:
        t = row["time"]
        if not all(math.isfinite(row[k]) for k in INPUTS):
            history = []
            last = None
            continue
        key = (row["station"], t.date())
        q = row["SWR"]/1000
        load = q/(1+math.sqrt(max(row["V"], 0)))
        gap = row["Tg"]-row["Tap"]
        values = np.array([row["Tap"],gap,load])
        if last != key:
            history = []
            ema = np.tile(values,(len(TAUS),1))
        station = float(row["station"] == "Campbell2")
        angle = 2*math.pi*(t.hour+t.minute/60)/24
        static = [station,row["Tap"],gap,row["RH"],q,row["V"],load,math.sin(angle),math.cos(angle)]
        lags = np.concatenate([history[-min(l,len(history))] if history else values for l in (1,2,4,8)])
        diff = (values[None,:]-ema).ravel()
        predictors = {"radiation":[station,load], "static":static, "raw_lags":np.r_[static,lags],
                      "thermal_memory":np.r_[static,diff], "boosted":np.r_[static,lags,diff]}
        if math.isfinite(row["Taa"]):
            out.append((row,predictors))
        ema = decay*ema+(1-decay)*values[None,:]
        history.append(values)
        last = key
    return out


def fit_predict(source, target):
    y = np.array([r["Taa"]-r["Tap"] for r,_ in source])
    tap = np.array([r["Tap"] for r,_ in target])
    means = {s:np.mean([r["Taa"]-r["Tap"] for r,_ in source if r["station"] == s]) for s in SOURCE}
    predictions = {"identity":tap, "station_mean":tap+np.array([means[r["station"]] for r,_ in target])}
    for name in METHODS[2:]:
        model = (HistGradientBoostingRegressor(max_iter=120,max_leaf_nodes=7,min_samples_leaf=25,
                    learning_rate=.05,l2_regularization=1.,early_stopping=False,random_state=0)
                 if name == "boosted" else make_pipeline(StandardScaler(),Ridge(alpha=1.)))
        model.fit(np.array([x[name] for _,x in source]),y)
        predictions[name] = tap+model.predict(np.array([x[name] for _,x in target]))
    return predictions


def metrics(rows, name):
    residual = np.array([r["predictions"][name]-r["Taa"] for r in rows])
    peak = max(abs(residual))
    return {"n":len(rows),"rms":float(np.sqrt(np.mean(residual**2))),"mae":float(np.mean(abs(residual))),
            "bias":float(np.mean(residual)),"maxabs":float(peak),
            "worst":[{k:r[k] for k in ("station","datetime","Tap","Taa","Tg","RH","V","SWR")} |
                     {"estimate":r["predictions"][name],"error":float(e)}
                     for r,e in zip(rows,residual) if abs(e)==peak]}


def summarize(scored):
    by = {}
    for label, subset in [("all",scored)]+[(s,[r for r in scored if r["station"]==s]) for s in SOURCE]:
        by[label] = {m:metrics(subset,m) for m in METHODS}
    daily = {s+" "+day:{m:metrics(subset,m) for m in METHODS} for s in SOURCE for day in DAYS
             if (subset:=[r for r in scored if r["station"]==s and r["datetime"][:10]==day])}
    diagnostics = {}
    for s in SOURCE:
        subset=[r for r in scored if r["station"]==s and r["SWR"]>=400 and r["V"]<1]
        diagnostics[s]={m:metrics(subset,m) for m in METHODS} if subset else {"n":0}
    gates = {}
    for s in SOURCE:
        mem = by[s]["thermal_memory"]
        gates[s] = {"rms_vs_identity":mem["rms"]<=.97*by[s]["identity"]["rms"],
                    "rms_vs_static":mem["rms"]<=.97*by[s]["static"]["rms"],
                    "mae_vs_identity":mem["mae"]<=by[s]["identity"]["mae"]}
    normalized = {m:sum(by[s][m]["rms"]/by[s]["identity"]["rms"] for s in SOURCE)/2 for m in METHODS}
    gates["history_controls"]={m:normalized["thermal_memory"]<=normalized[m] for m in ("raw_lags","boosted")}
    return {"scores":by,"daily":daily,"high_solar_low_wind":diagnostics,"normalized_rms":normalized,
            "gates":gates,"pass":all(v for group in gates.values() for v in group.values())}


def development(directory):
    prepared = features(read_development(directory))
    scored = []
    with threadpool_limits(limits=1):
        for day in DAYS:
            source = [(r,x) for r,x in prepared if r["time"].date().isoformat()<day]
            target = [(r,x) for r,x in prepared if r["time"].date().isoformat()==day]
            if len(target)!=192:
                raise ValueError(f"Incomplete development day {day}")
            predictions = fit_predict(source,target)
            for i,(r,_) in enumerate(target):
                scored.append({k:v for k,v in r.items() if k!="time"} | {"datetime":r["time"].isoformat(),
                              "predictions":{m:float(predictions[m][i]) for m in METHODS}})
    return scored,summarize(scored)


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir",type=Path)
    parser.add_argument("output_dir",type=Path)
    args=parser.parse_args()
    forecasts, results=development(args.source_dir)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    for name, value in (("forecasts.json",forecasts),("results.json",results)):
        (args.output_dir/name).write_text(json.dumps(value,sort_keys=True,allow_nan=False)+"\n")
    print(json.dumps({"rows":len(forecasts),"pass":results["pass"],"gates":results["gates"],
                      "normalized":results["normalized_rms"]},sort_keys=True))
