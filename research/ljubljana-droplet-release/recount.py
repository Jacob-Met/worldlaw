"""Independently recount frozen residuals and bound the effect of 132 unidentified rows."""
import argparse
import csv
import hashlib
import io
import json
import math
from collections import defaultdict
from pathlib import Path

PINS={"main":"d2089e7bc3c13e80772c82fc91af43c917bb981cd3d799afb4e1fd6ff27658fb",
      "reference":"7cd04f468daaf39ddff62320d633970ac58fdf7e471018e1278694d543c7a9c4",
      "forecasts":"571af04e59d5f109eb131c1017193e5ef0777c2e5f5070b7fc60c3a4719fcdc2",
      "result":"d0150e365f5465daace482bad5e40e61c67691f3315cd4584db28adac0009811"}


def load(path, key):
    data=Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest()!=PINS[key]:
        raise ValueError(key+" file mismatch")
    return data


def analyze(main, ref, pred, result):
    data=list(csv.DictReader(io.StringIO(main.decode("cp1252"))))
    reference=list(csv.DictReader(io.StringIO(ref.decode("cp1252"))))
    assert len(data)==1498 and len(reference)==125
    assert all(k not in reference[0] for k in ("Contact time [s]","Rebound efficiency"))
    by_line={r["line"]:r for r in pred["rows"]}
    values=defaultdict(list)
    differences=defaultdict(list)
    heights=[]
    for line, row in enumerate(data,2):
        pp=by_line[line]
        name=row["Sample"]
        assert pp["surface"]==name
        pitch=int(name[1:])
        fold="train" if pitch in (50,200,800) else "development" if pitch==400 else "final"
        assert pp["split"]==fold
        y=[float(row["Contact time [s]"]),float(row["Rebound efficiency"])]
        assert all(math.isfinite(v) and v>0 for v in y)
        u=float(row["Impact velocity [m/s]"])
        diameter=float(row["Droplet diameter [m]"])
        heights.append((y[1]*u**2/9.80665/diameter,line,fold,name))
        for j,metric in enumerate(("duration_s","height_energy")):
            costs={}
            for arm, vector in pp["pred"].items():
                cost=(float(vector[j])-y[j])**2
                values[(fold,name,metric,arm)].append((cost,line))
                costs[arm]=cost
            if fold=="final":
                for arm in costs.keys()-{"force"}:
                    differences[(metric,arm)].append(costs["force"]-costs[arm])
    max_delta=0.
    for (fold,name,metric,arm), rows in values.items():
        n=len(rows)
        rms=math.sqrt(math.fsum(v for v,_ in rows)/n)
        published=result[fold]["surfaces"][name][metric][arm]
        max_delta=max(max_delta,abs(published["rmse"]-rms))
        assert published["n"]==n and published["worst_line"]==max(rows,key=lambda z:z[0])[1]
    assert max_delta<1e-12
    summary={}
    check_count=0
    for fold in ("train","development","final"):
        g={}
        s=result[fold]["surfaces"]
        for metric in ("duration_s","height_energy"):
            for arm in ("force","deformation","author_ie_gp","dimensionless_ie_gp","capillary_clock_mean_energy"):
                vals=[math.sqrt(math.fsum(v for v,_ in values[fold,name,metric,arm])/len(values[fold,name,metric,arm])) for name in s]
                g[metric,arm]={"mean_rmse":math.fsum(vals)/len(vals),"max_rmse":max(vals)}
                for a,v in g[metric,arm].items():
                    max_delta=max(max_delta,abs(v-result[fold]["summary"][metric][arm][a]))
        hits=[]
        for metric in ("duration_s","height_energy"):
            for agg in ("mean_rmse","max_rmse"):
                for arm in ("deformation","author_ie_gp","dimensionless_ie_gp","capillary_clock_mean_energy"):
                    expected=g[metric,"force"][agg]<g[metric,arm][agg]
                    assert result[fold]["checks"][metric][agg][arm]==expected
                    hits.append(expected);check_count+=1
        assert all(hits)==result[fold]["joint"]
        summary[fold]={"passed":sum(hits),"total":len(hits),"joint":all(hits)}
    intervals={}
    for (metric,arm), d in sorted(differences.items()):
        ds=sorted(d)
        # Any 0..132 omissions from these 500 rows can be completed to 132 in the full corpus.
        # At a fixed count, dropping the largest (smallest) costs is sharp for the minimum (maximum).
        lb=math.fsum(ds[:-132])/(len(ds)-132)
        ub=math.fsum(ds[132:])/(len(ds)-132)
        intervals.setdefault(metric,{})[arm]={
            "full_paired_mean_squared_error_difference":math.fsum(ds)/len(ds),
            "sharp_lower":lb,"sharp_upper":ub,"final_n":len(ds)}
    return {"terms_recomputed":sum(len(v) for v in values.values()),"surface_rmse_checks":len(values),
            "aggregate_equality_max_abs":max_delta,"gate_checks":check_count,"per_split_checks":summary,
            "all_main_positive_pairs":len(heights),"reference_endpoint_unavailable":len(reference),
            "apex_height_below_initial_radius":sum(v[0]<1 for v in heights),"lowest_apex_ratio":min(heights),
            "final_definitive_count_if_same_132":[368,500],
            "one_125_row_geometry_definitive_count_if_same_132":[0,125],
            "pooled_paired_force_minus_control_removal_bounds":intervals}


if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    for a in ("main","reference","forecasts","result","output"):
        ap.add_argument(a)
    a=ap.parse_args()
    r=analyze(load(a.main,"main"),load(a.reference,"reference"),json.loads(load(a.forecasts,"forecasts")),json.loads(load(a.result,"result")))
    raw=(json.dumps(r,sort_keys=True,indent=2)+"\n").encode()
    Path(a.output).write_bytes(raw)
    print(json.dumps(r))
