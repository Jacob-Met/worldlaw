#!/usr/bin/env python3
"""Reproduce the exact source-only condition comparison; never execute author code."""
import argparse, csv, hashlib, io, json, math, pathlib, subprocess, urllib.request
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PIN = "cbf82673641ecd65e902ad5c38a048387649a2a0"
BASE = "https://raw.githubusercontent.com/EnzeXu/Damped_Pendulum_Dataset/" + PIN
CONDITIONS = [(1, "air", "Air"), (2, "small-baffle", "Small paper baffle")]
UNITS = {"time":"s", "position":"rad", "initialRate":"rad/s"}
def sha(data): return hashlib.sha256(data).hexdigest()
def obtain(name):
    path = HERE / "raw" / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(BASE + "/raw_data/" + name, headers={"User-Agent":"WORLDLAW-source-receiving"})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read(4_000_001)
        except urllib.error.URLError as error:
            # Some Python distributions lack the system CA store. System curl
            # still verifies HTTPS with its own maintained trust store.
            if "CERTIFICATE_VERIFY_FAILED" not in str(error): raise
            data = subprocess.check_output(["curl","--fail","--silent","--show-error","--location",
                "--proto","=https","--proto-redir","=https","--connect-timeout","15","--max-time","45",
                BASE + "/raw_data/" + name])
        if len(data) > 4_000_000: raise ValueError("Source CSV exceeds receipt budget")
        path.write_bytes(data)
    return path.read_bytes()
def run(condition, label, rep):
    name = f"len2_cond{condition}_{rep}.csv"
    raw = obtain(name)
    rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    time_key, angle_key, rate_key = "Time (s) Run #1", "Angle (rad) Run #1", "Angular Velocity (rad/s) Run #1"
    for key in [time_key,angle_key,rate_key]:
        if not rows or key not in rows[0]: raise ValueError(f"Missing declared column {key} in {name}")
    retained = [(i,row) for i,row in enumerate(rows) if row[time_key].strip() and 5 <= float(row[time_key]) <= 15]
    if len(retained) != 1001 or retained[0][0] != 500 or retained[-1][0] != 1500:
        raise ValueError(f"Unexpected retained interval in {name}: {len(retained)}")
    samples = [{"time":float(row[time_key]),"position":float(row[angle_key])} for _,row in retained]
    rate = float(retained[0][1][rate_key])
    if any(not math.isfinite(v) for s in samples for v in s.values()) or not math.isfinite(rate):
        raise ValueError("Nonfinite source observations")
    if samples[0]["time"] != 5 or samples[-1]["time"] != 15:
        raise ValueError("Source time boundary differs")
    return {"id":f"pasco-len2-cond{condition}-rep{rep}","label":f"{label}, repetition {rep}","kind":"measured",
        "dynamics":"unforced_scalar_rotation","inertia":None,"initialRate":rate,
        "source":{"label":"EnzeXu PASCO damped pendulum dataset","recordingId":f"EnzeXu/Damped_Pendulum_Dataset@{PIN}:raw_data/{name}",
            "url":BASE+"/raw_data/"+name,"repositoryCommit":PIN,"rawSHA256":sha(raw),"rawBytes":len(raw),"license":"Apache-2.0",
            "file":name,"nominalLengthMeters":0.330,"condition":condition,"conditionLabel":label,"repetition":rep,
            "retainedTimeIntervalSeconds":[5,15],"retainedZeroBasedDataRows":[500,1500],
            "initialRateSource":{"column":rate_key,"zeroBasedDataRow":500,"value":rate},
            "transforms":"None: original angle, timestamps, and initial recorded rate preserved."},
        "samples":samples}
def verify_freeze(path):
    receipt = json.loads(path.read_text())
    if receipt.get("schema") != "worldlaw.environment-training-freeze/v1": raise ValueError("A training freeze is required")
    for name, expected in receipt["sourceSHA256"].items():
        actual = sha((ROOT/name).read_bytes())
        if actual != expected: raise ValueError("Frozen source changed: "+name)
    for name, expected in receipt["trainingRawSHA256"].items():
        actual = sha((HERE/"raw"/name).read_bytes())
        if actual != expected: raise ValueError("Frozen training CSV changed: "+name)
    return sha(path.read_bytes())
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--receive-challenge",action="store_true")
    ap.add_argument("--frozen-receipt",type=pathlib.Path)
    args=ap.parse_args()
    freeze=None
    if args.receive_challenge:
        if not args.frozen_receipt: raise ValueError("--frozen-receipt is required before opening repetition 3")
        freeze=verify_freeze(args.frozen_receipt)
    reps=[3] if args.receive_challenge else [1,2]
    role="challengeRuns" if args.receive_challenge else "trainingRuns"
    bundle={"schema":"worldlaw.environment-challenge/v1" if args.receive_challenge else "worldlaw.environment-bundle/v1",
        "label":"PASCO 0.330 m: air and small paper baffle","units":UNITS,
        "environments":[{"id":eid,"label":label,role:[run(cond,label,rep) for rep in reps]} for cond,eid,label in CONDITIONS]}
    output=ROOT/"examples"/("physical-environments-challenge-03ae912a3e15.json" if args.receive_challenge else "physical-environments-training-03ae912a3e15.json")
    output.write_text(json.dumps(bundle,ensure_ascii=False,separators=(",",":"))+"\n")
    receipt={"role":role,"output":str(output.relative_to(ROOT)),"sha256":sha(output.read_bytes()),"freezeReceiptSHA256":freeze,
        "recordings":[{"id":r["id"],"rawSHA256":r["source"]["rawSHA256"],"samples":len(r["samples"]),"initialRate":r["initialRate"]} for e in bundle["environments"] for r in e[role]]}
    print(json.dumps(receipt))
if __name__=="__main__":main()
