"""Score an already fixed 1,498-row prediction archive against the two organizer CSVs."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
from statistics import mean

CSV_SHA = "d2089e7bc3c13e80772c82fc91af43c917bb981cd3d799afb4e1fd6ff27658fb"
REF_SHA = "7cd04f468daaf39ddff62320d633970ac58fdf7e471018e1278694d543c7a9c4"
ARMS = ("force","deformation","author_ie_gp","dimensionless_ie_gp","capillary_clock_mean_energy")
METRICS = ("duration_s","height_energy")


def read_blob(path, digest):
    data = Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("file SHA mismatch")
    return data


def available(s):
    if s.strip().casefold() in {"","na","n/a","nan","-"}:
        return None
    value = float(s)
    if not math.isfinite(value):
        raise ValueError("undocumented nonfinite field")
    return value


def score(original, reference, forecast):
    text = original.decode("cp1252")
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    if header[10:12] != ["Contact time [s]","Rebound efficiency"]:
        raise ValueError("source outcome schema mismatch")
    ref_reader = csv.reader(io.StringIO(reference.decode("cp1252")))
    ref_header = next(ref_reader)
    if len(ref_header) != 10 or any(h in ref_header for h in header[10:12]):
        raise ValueError("smooth reference schema changed")
    reference_n = sum(1 for _ in ref_reader)
    if reference_n != 125 or len(forecast["rows"]) != 1498:
        raise ValueError("course roster mismatch")
    records = []
    for line, (row, pred) in enumerate(zip(reader, forecast["rows"], strict=True), 2):
        if line != pred["line"] or row[0] != pred["surface"] or set(pred["pred"]) != set(ARMS):
            raise ValueError(f"forecast/source row identity mismatch {line}")
        true = [available(row[10]),available(row[11])]
        records.append({"line":line,"surface":row[0],"split":pred["split"],"inputs":list(map(float,row[1:8])),
                        "target":true,"forecast":pred["pred"]})
    result = {"n":len(records),"reference_n_unavailable":reference_n,
              "reference_header":ref_header, "physical_event_status":"No independently released event label"}
    for split in ("train","development","final"):
        rows = [r for r in records if r["split"] == split]
        surface_names = sorted({r["surface"] for r in rows})
        status = {"both":0,"duration_only":0,"energy_only":0,"neither":0}
        for r in rows:
            t,e=r["target"]
            kind = "both" if t is not None and e is not None else "duration_only" if t is not None else "energy_only" if e is not None else "neither"
            status[kind]+=1
        group = {}
        for surface in surface_names:
            rr = [r for r in rows if r["surface"]==surface]
            each = {"n":len(rr)}
            for j,metric in enumerate(METRICS):
                eligible = [r for r in rr if r["target"][j] is not None]
                if not eligible:
                    raise ValueError(f"no observed {metric} on {surface}, primary cannot be computed")
                each[metric] = {}
                for arm in ARMS:
                    errors = [r["forecast"][arm][j]-r["target"][j] for r in eligible]
                    worst = eligible[max(range(len(errors)),key=lambda i:abs(errors[i]))]
                    each[metric][arm]={"n":len(errors),"rmse":math.sqrt(mean(e*e for e in errors)),
                                      "worst_line":worst["line"],"observed":worst["target"][j],
                                      "predicted":worst["forecast"][arm][j]}
            group[surface]=each
        stats={j:{a:{"mean_rmse":mean(group[s][j][a]["rmse"] for s in surface_names),
                      "max_rmse":max(group[s][j][a]["rmse"] for s in surface_names)}
                  for a in ARMS} for j in METRICS}
        checks={j:{agg:{a:stats[j]["force"][agg]<stats[j][a][agg] for a in ARMS[1:]}
                   for agg in ("mean_rmse","max_rmse")} for j in METRICS}
        worst={}
        for j,metric in enumerate(METRICS):
            eligible=[r for r in rows if r["target"][j] is not None]
            w=max(eligible,key=lambda r:abs(r["forecast"]["force"][j]-r["target"][j]))
            worst[metric]=w
        prob=forecast["file_availability_forecast"]
        result[split]={"n":len(rows),"availability":status,"paired_field_brier":mean(
            (prob-int(all(v is not None for v in r["target"])))**2 for r in rows),
            "surfaces":group,"summary":stats,"checks":checks,
            "joint":all(v for by_metric in checks.values() for by_agg in by_metric.values() for v in by_agg.values()),
            "worst_force":worst}
    result["nondefinitive_132_linkage"]={"published_count":132,"missing_pairs_in_archive":sum(
        1 for r in records if any(v is None for v in r["target"])),
        "rowwise_identity_verified":False}
    return result


if __name__ == "__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    for arg in ["original","reference","forecast","forecast_sha","output"]:
        ap.add_argument(arg)
    args=ap.parse_args()
    result=score(read_blob(args.original,CSV_SHA),read_blob(args.reference,REF_SHA),
                 json.loads(read_blob(args.forecast,args.forecast_sha)))
    b=(json.dumps(result,sort_keys=True,indent=2,allow_nan=False)+"\n").encode()
    Path(args.output).write_bytes(b)
    print(json.dumps({"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"final_joint":result["final"]["joint"],
                      "final":result["final"]["summary"],"worst":result["final"]["worst_force"],
                      "availability":{s:result[s]["availability"] for s in ("train","development","final")}}))
