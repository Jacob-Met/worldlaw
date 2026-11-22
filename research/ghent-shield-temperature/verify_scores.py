"""Independently verify every source row, reported group metric, and decision."""
import argparse
import csv
from datetime import datetime, timedelta
import hashlib
import json
import math
from pathlib import Path

FILES = {
    "Campbell1": "49f7a913993456ce3a8d4157af5655db2b395126c9935532623d8bdd78361840",
    "Campbell2": "7794fd12f87b4a5465014a3c756afd39b10f255d8e20fd7deae9254ad7d005ff",
}
ARMS = {"identity","station_mean","radiation","static","raw_lags","thermal_memory","boosted"}
DATES = ("2023-05-29","2023-05-30","2023-05-31","2023-06-01")


def validate(source, destination):
    forecast = json.loads((destination/"forecasts.json").read_bytes())
    result = json.loads((destination/"results.json").read_bytes())
    reference = {}
    for station, digest in FILES.items():
        file = source / (station+"_device_intercomparison.csv")
        if hashlib.sha256(file.read_bytes()).hexdigest()!=digest:
            raise ValueError("Changed original sensor file")
        with file.open(newline="") as stream:
            for row in csv.DictReader(stream):
                stamp=datetime.fromisoformat(row["datetime"]).isoformat()
                reference[station,stamp]=row
    canonical = Path(__file__).with_name("original-forecasts.json").read_bytes()
    if hashlib.sha256(canonical).hexdigest() != "cea85fdfd80340f3691563830304ac3549a9a9f1633c093f1c79b58004f006ae":
        raise ValueError("Changed immutable forecast evidence")
    published = {(r["station"],r["datetime"]):r for r in json.loads(canonical)}
    keyed={(r["station"],r["datetime"]):r for r in forecast}
    expected={k for k in reference if k[1][:10] in DATES}
    assert len(forecast)==len(keyed)==len(expected)==768 and set(keyed)==expected==set(published)
    for key,r in keyed.items():
        raw=reference[key]
        for field in ("Tap","Taa","SWR","V","Tg","RH"):
            assert r[field]==float(raw[field])
        assert set(r["predictions"])==ARMS and all(math.isfinite(x) for x in r["predictions"].values())
        assert r["predictions"]["identity"]==r["Tap"]
        for arm in ARMS:
            assert abs(r["predictions"][arm]-published[key]["predictions"][arm]) <= 1e-10

    scores={}
    def check_group(name,rows,reported):
        if not rows:
            assert reported=={"n":0}
            return
        scores[name]={}
        for arm in ARMS:
            errors=[r["predictions"][arm]-r["Taa"] for r in rows]
            n=len(rows)
            peak=max(map(abs,errors))
            rms=math.sqrt(math.fsum(e*e for e in errors)/n)
            numbers={"rms":rms,"mae":math.fsum(map(abs,errors))/n,"bias":math.fsum(errors)/n,"maxabs":peak}
            original=reported[arm]
            assert n==original["n"] and all(math.isclose(original[k],v,rel_tol=1e-12,abs_tol=1e-13) for k,v in numbers.items())
            ties={(r["station"],r["datetime"]) for r,e in zip(rows,errors) if abs(e)==peak}
            assert ties=={(r["station"],r["datetime"]) for r in original["worst"]}
            scores[name][arm]=numbers
    check_group("all",forecast,result["scores"]["all"])
    for s in FILES:
        rows=[r for r in forecast if r["station"]==s]
        check_group(s,rows,result["scores"][s])
        check_group(s+" high solar",[r for r in rows if r["V"]<1 and r["SWR"]>=400],result["high_solar_low_wind"][s])
        for d in DATES:
            key=s+" "+d
            check_group(key,[r for r in rows if r["datetime"].startswith(d)],result["daily"][key])
    for arm in ARMS:
        ratio=math.fsum(scores[s][arm]["rms"]/scores[s]["identity"]["rms"] for s in FILES)/2
        assert math.isclose(ratio,result["normalized_rms"][arm],rel_tol=1e-12)
    gates={}
    for s in FILES:
        arm=scores[s]["thermal_memory"]
        gates[s] = {"rms_vs_identity": arm["rms"]<=.97*scores[s]["identity"]["rms"],
                    "rms_vs_static":arm["rms"]<=.97*scores[s]["static"]["rms"],
                    "mae_vs_identity":arm["mae"]<=scores[s]["identity"]["mae"]}
    def ratio(arm):
        return sum(scores[s][arm]["rms"]/scores[s]["identity"]["rms"] for s in FILES)/2
    gates["history_controls"]={a:ratio("thermal_memory")<=ratio(a) for a in ("raw_lags","boosted")}
    assert gates==result["gates"] and result["pass"]==all(v for g in gates.values() for v in g.values())
    episodes={}
    for s in FILES:
        for arm in sorted(ARMS):
            for j,r in enumerate(result["scores"][s][arm]["worst"]):
                peak=datetime.fromisoformat(r["datetime"])
                rows=[keyed[(s,t.isoformat())] for offset in range(-4,5)
                      if (s,(t:=peak+timedelta(minutes=15*offset)).isoformat()) in keyed]
                episodes[f"{s} {arm} {j}"]=rows
    (destination/"worst-episodes.json").write_text(json.dumps(episodes,sort_keys=True)+"\n")
    return {"source_rows_verified":len(forecast),"predictions":len(forecast)*len(ARMS),
            "verified_metric_groups":len(scores),"episodes":{k:len(v) for k,v in episodes.items()},"pass":result["pass"]}


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir",type=Path)
    parser.add_argument("output_dir",type=Path)
    args=parser.parse_args()
    print(json.dumps(validate(args.source_dir,args.output_dir),sort_keys=True))
