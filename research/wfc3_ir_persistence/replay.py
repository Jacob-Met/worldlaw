"""Verify recorded observations offline, with optional reconstruction from the public calibration."""
import argparse
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

ROOT=Path(__file__).resolve().parent
PER_CAL_URL="https://www.stsci.edu/~long/xpub/Persistence/z.PerCal.170529.tar.gz"
ARCHIVE_SHA="3dbb9f2c2f923d0f4a1d9e5909935fc57b508f22000625b5cf696dc2670b003e"
FITS_SHA="4fb2c770d8d7eba4f09bb61a3466d1442af9f765b7b72e8d76141f4ec74df27d"
METHODS=("maximum","capacity","published_repeat_shape","shrunken_sum","sum")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(name):
    return json.loads((ROOT/name).read_text())


def check(value,message):
    if not value:
        raise ValueError(message)


def near(a,b,tol=1e-9):
    return math.isclose(a,b,rel_tol=tol,abs_tol=tol)


def offline():
    manifest=load("checksums.json")
    for name,digest in manifest.items():
        check(sha((ROOT/name).read_bytes())==digest, f"SHA mismatch for {name}")
    rows=list(csv.DictReader((ROOT/"source-repeat-all-216.csv").read_text().splitlines()))
    source=load("source-repeat-native-result.json")
    cert=load("source-repeat-analytic-certificate.json")
    check(len(rows)==216 and len({(r["visit"],r["fluence_e"],r["age_s"]) for r in rows})==216, "Source-cell census")
    means={}
    for method in METHODS:
        visit_errors=[]
        for v,record in source["rows"].items():
            visit=[r for r in rows if r["visit"]==v]
            check(len(visit)==24,"Visit source grid")
            error=math.sqrt(sum(math.log(float(r[method])/float(r["published_ratio"]))**2 for r in visit)/24)
            check(near(error,record["log_rmse"][method]),f"{method} error in visit {v}")
            visit_errors.append(error)
        means[method]=sum(visit_errors)/len(visit_errors)
        check(near(means[method],source["mean_per_visit_log_rmse"][method]),"Visit mean error")
    repeated=[r for r in rows if int(r['visit'][1])>1]
    check(len(repeated)==168 and all(float(r["C1_lower_bound_ratio"])>float(r["published_ratio"]) for r in repeated),"All-capacity lower envelope")
    check(all(near(float(r["C1_lower_bound_ratio"]),float(r["capacity"])) for r in rows),"Selected lower-bound model")
    check(near(means["capacity"],cert["exact_minimum_mean_per_visit_log_rmse_for_all_C_ge1"]),"Exact envelope score")
    check(not source["source_gate"] and source["full_source_capacity_multiplier"]==1.0,"Source decision")
    support=json.loads((ROOT/"stellar-support-original.txt").read_text().splitlines()[-1])
    satur=json.loads((ROOT/"raw-last-read-source-original.txt").read_text().splitlines()[-1])
    for v,n in zip(("01","02","03"),(7,5,3)):
        check(len(support[v]["members"])==len(satur[v]["inputs"])==n,"Stellar member count")
        for prior,last in zip(support[v]["members"],satur[v]["inputs"]):
            check(prior["rootname"]==last["rootname"] and prior["sha256"]==last["flt_sha256"],"Byte-bound FLT re-use")
            check(last["raw_reads"][0]["t_s"]==0 and last["raw_reads"][-1]["extver"]==1,"Native raw ramp order")
        matrix=satur[v]["joint_flt70k_count_by_ima_final256_count_good"]
        check([sum(line) for line in matrix]==support[v]["histograms"]["good_ge70000_all_good"],"Extrapolated support marginal")
        check([sum(line[j] for line in matrix) for j in range(n+1)]==satur[v]["all_good_full_time_saturation_hist"],"Final-read saturation marginal")
    history=load("history-reconciled-summary.json")
    check(sum(len(item["all_dark_receivers"]) for item in history.values())==48,"Dark exposure time inventory")
    check(all(not item["native_only_inside_window"] and not item["legacy_not_in_native"] for item in history.values()),"Archive membership mismatch")
    check(load("source-custody.json")["acquisition"]["target_dark_image_arrays_opened"]==0,"Recorded target access")
    return {"verified_member_hashes":len(manifest),"source_cells":len(rows),"five_method_cells":len(rows)*len(METHODS),"continuous_minimum":means["capacity"],"source_gate":False,"recorded_target_dark_images":0}


def read_calibration(path):
    if path:
        b=Path(path).read_bytes()
    else:
        req=urllib.request.Request(PER_CAL_URL,headers={"User-Agent":"WORLDLAW WFC3 reproducible calibration replay"})
        with urllib.request.urlopen(req,timeout=120) as stream:
            b=stream.read(10_887_938)
    check(len(b)==10_887_937 and sha(b)==ARCHIVE_SHA,"Wrong public author calibration archive")
    with tarfile.open(fileobj=io.BytesIO(b),mode="r:gz") as tf:
        member=tf.getmember("PerCal.170529/a_gamma.fits")
        check(member.isfile() and member.size==141120,"Wrong A-gamma table member")
        data=tf.extractfile(member).read()
    check(sha(data)==FITS_SHA,"Wrong published A-gamma bytes")
    return data


def numerical(calibration):
    with tempfile.TemporaryDirectory(prefix="wfc3-repeat-") as td:
        tmp=Path(td)
        for name in ["reservoir.py","qualify_reservoir.py","source_repeat_calibration.py","recount_capacity.py","source-12694-actual-members.json","table1-12694.csv","source-repeat-native-result.json"]:
            shutil.copyfile(ROOT/name,tmp/name)
        (tmp/"PerCal-a_gamma.fits").write_bytes(calibration)
        env=dict(os.environ,OPENBLAS_NUM_THREADS="1",OMP_NUM_THREADS="1",MKL_NUM_THREADS="1")
        def run(name,*args):
            raw=subprocess.check_output([sys.executable,name,*args],cwd=tmp,env=env)
            return json.loads(raw)
        single=run("qualify_reservoir.py","PerCal-a_gamma.fits")
        repeat=run("source_repeat_calibration.py")
        independent=run("recount_capacity.py")
        check(single["passed"] and not repeat["source_gate"],"Fresh numerical qualification")
        for key,val in repeat["mean_per_visit_log_rmse"].items():
            check(near(val,independent["mean_per_visit_log_rmse"][key]), "Independent source score")
        fresh=list(csv.DictReader((tmp/"source-repeat-all-216.csv").read_text().splitlines()))
        old=list(csv.DictReader((ROOT/"source-repeat-all-216.csv").read_text().splitlines()))
        check(len(fresh)==len(old)==216,"Fresh cell census")
        for a,b in zip(fresh,old):
            check(a["visit"]==b["visit"] and all(near(float(a[k]),float(b[k])) for k in a if k!="visit"),"Fresh source cell changed")
        return {"numerical_cells":len(fresh),"source_gate":repeat["source_gate"],"worst_single_pulse_relative_error":single["worst"]["max_relative_rate_error"],"proof_bound":independent["exact_minimum_mean_per_visit_log_rmse_for_all_C_ge1"]}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    mode=p.add_mutually_exclusive_group()
    mode.add_argument("--percal",metavar="PATH",help="Exact z.PerCal.170529.tar.gz archive")
    mode.add_argument("--fetch-calibration",action="store_true",help="Read the public STScI calibration tarball")
    args=p.parse_args()
    out=offline()
    if args.percal or args.fetch_calibration:
        out.update(numerical(read_calibration(args.percal)))
    print(json.dumps(out,sort_keys=True))


if __name__=="__main__":
    main()
