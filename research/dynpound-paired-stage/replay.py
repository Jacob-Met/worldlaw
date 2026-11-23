"""Recount the fixed DYNPOUND development experiment from its public evidence."""
import argparse
import collections
import datetime as dt
import hashlib
import json
import math
import statistics
import urllib.request
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
MEMBERS = {
    "locked-forecasts.json.zlib": (155815, "0235f6e9ccf7d975bc4a145330546c1ee05365d13b72e1b66e9d9e64849fa18e"),
    "field-recount.json.zlib": (22870, "c95568f7fe0209113d217548566fc426bc2e75d331458310f498d5619b3e252c"),
    "worst-stage-paths.json.zlib": (4921, "95911d77ec87f4c72a165ad9bb627e1384fa08bab0f3d708ff2132a774aa0053"),
}
CANDIDATE = "momentum"
CONTROLS = {"stock_core", "steady", "stock_calibrated", "static_isotonic",
            "local_ridge", "paired_ridge", "paired_boost"}
METHODS = CONTROLS | {CANDIDATE, "wrong_sign"}


def read_member(name):
    raw = zlib.decompress((HERE / name).read_bytes())
    assert (len(raw), hashlib.sha256(raw).hexdigest()) == MEMBERS[name]
    return json.loads(raw)


def near(value, reference):
    if not math.isclose(value, float(reference), abs_tol=1e-12, rel_tol=1e-12):
        raise ValueError(f"score mismatch: {value} versus {reference}")


def current_reference_rows(links):
    """Query only the published development period and match scientific rows by full time."""
    rows = {}
    for site, info in links.items():
        req = urllib.request.Request(info["url"], headers={"User-Agent": "WORLDLAW hydrometry recount"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)
        assert not any(link.get("rel") == "next" for link in data.get("links", []))
        for feature in data["features"]:
            v = feature["properties"]
            if (v["reading_type"], v["approval_status"], v["observing_procedure"]) != (
                "Discharge", "Approved", "Acoustic Doppler Current Profiler"
            ):
                continue
            assert v["time_of_day"].endswith("+00:00") and len(v["time"]) == 10
            assert v["unit_of_measure"] in {"ft3/s", "ft^3/s", "ft³/s"}
            k = site, v["field_visit_id"], v["time"] + "T" + v["time_of_day"]
            assert k not in rows and "2021" <= k[2][:4] <= "2024"
            rows[k] = float(v["value"])
    return rows


def verify(live=False):
    lock = read_member("locked-forecasts.json.zlib")
    facts = read_member("field-recount.json.zlib")
    trajectories = read_member("worst-stage-paths.json.zlib")
    assert len(lock["rows"]) == 262 and len(lock["refused"]) == 54
    assert all(r["period"] in {"training", "development"} for r in lock["rows"] + lock["refused"])
    assert all(("q_measured" in r) == (r["period"] == "training") for r in lock["rows"])
    assert all(set(r["forecasts"]) == METHODS for r in lock["rows"])
    direct = {(s,v,t): float(q) for s,v,t,q in facts["data"]}
    assert len(direct) == len(facts["data"]) == 88
    if live and direct != current_reference_rows(facts["sources"]):
        raise ValueError("USGS approved development rows have changed since the archived recount")
    key = lambda r: (r["site"], r["visit"], r["time"])
    predicted = {key(r): r for r in lock["rows"] if r["period"] == "development"}
    refused = {key(r): r for r in lock["refused"] if r["period"] == "development"}
    assert len(predicted) == 81 and len(refused) == 7
    assert not (predicted.keys() & refused.keys()) and predicted.keys() | refused.keys() == direct.keys()
    incomplete = {k[:2] for k in refused}
    sites = sorted(lock["parameters"])
    means, tails, coverage, worst = {}, {}, {}, {}
    for site in sites:
        q = {k: v for k,v in direct.items() if k[0] == site}
        e = {k: r for k,r in predicted.items() if k[0] == site and k[:2] not in incomplete}
        nvisits = {k[1] for k in q}
        coverage[site] = [len({k[1] for k in e}),len(nvisits)]
        assert coverage[site] == facts["coverage"][site]
        means[site], tails[site], worst[site] = {}, {}, {}
        for method in sorted(METHODS):
            losses, squared = collections.defaultdict(list), collections.defaultdict(list)
            raw = []
            for k,r in e.items():
                utc = dt.datetime.fromisoformat(k[2])
                assert utc.utcoffset()==dt.timedelta(0) and int(utc.timestamp())//3600*3600==r["grid_end"]
                fc = r["forecasts"][method]
                loss = abs(math.asinh(fc/r["scale"])-math.asinh(q[k]/r["scale"]))
                losses[k[1]].append(loss)
                squared[k[1]].append((fc-q[k])**2)
                raw.append((loss,k,fc))
            by_visit = sorted(map(statistics.fmean,losses.values()),reverse=True)
            means[site][method] = statistics.fmean(by_visit)
            tails[site][method] = statistics.fmean(by_visit[:math.ceil(len(by_visit)/4)])
            rmse = math.sqrt(statistics.fmean(map(statistics.fmean,squared.values())))
            near(means[site][method],facts["means"][site][method])
            near(tails[site][method],facts["tails"][site][method])
            near(rmse,facts["rmse"][site][method])
            err,k,fc = max(raw)
            ex = facts["worst"][site][method]
            near(err,ex[0])
            assert list(k[1:]) == ex[1]
            near(q[k],ex[2])
            near(fc,ex[3])
            worst[site][method] = k
    pool = {m:statistics.fmean(means[s][m] for s in sites) for m in METHODS}
    tail = {m:statistics.fmean(tails[s][m] for s in sites) for m in METHODS}
    for method in METHODS:
        near(pool[method],facts["pool"][method])
        near(tail[method],facts["top"][method])
    best = min(sorted(CONTROLS),key=pool.get)
    ratios = [means[s][CANDIDATE]/means[s][best] for s in sites]
    gates = [all(a/b>=.8 for a,b in coverage.values()), pool[CANDIDATE]<=.95*pool[best],
             sum(r<1 for r in ratios)>=2, max(ratios)<=1.10, tail[CANDIDATE]<=1.10*tail[best]]
    assert best == "static_isotonic" and gates == facts["gates"] == [True,False,False,False,False]
    assert {w["site"] for w in trajectories}==set(sites) and len(trajectories)==3
    for w in trajectories:
        k = w["site"],w["visit"],w["utc"]
        assert k==worst[k[0]][CANDIDATE] and w["grid_end"]==predicted[k]["grid_end"]
        near(w["direct_cfs"],direct[k])
        near(w["momentum_cfs"],predicted[k]["forecasts"][CANDIDATE])
        for field in ("local","neighbor"):
            history = w[field]["samples"]
            assert len(history)==25
            for idx,(time,value,qualifier) in enumerate(history):
                right = w["grid_end"]-(24-idx)*3600
                assert 0<=right-time<=1800 and math.isfinite(value)
    print(json.dumps({"dev_reference_rows":len(direct),"scored_rows":len(predicted),
                      "complete_visits":coverage,"pooled":dict(sorted(pool.items())),
                      "strongest":best,"site_ratios":dict(zip(sites,ratios)),
                      "gates":gates,"reserve_opened":False},indent=2,sort_keys=True))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--live",action="store_true",help="also compare the same development ADCP records from USGS")
    verify(ap.parse_args().live)
