#!/usr/bin/env python3
"""Prospective MAGF-ID Conf2 external-reference/stationary identifiability study.

Source selection precedes *any* numeric CSV parse. Train and final held-out
evaluation are separate processes; untouched test needs frozen validation.
This tests conditional sensor covariance, never absolute gyroscope calibration.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import itertools
import json
from pathlib import Path
import struct
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
import zlib

import numpy as np

import magfid_covariance as original

HERE = Path(__file__).resolve().parents[1]
SOURCE = HERE / "research/magfid-covariance/magfid-v1-zip-manifest.json"
PROTOCOL = HERE / "research/magfid-reference/CONF2_PROSPECTIVE.md"
EXPECTED_MANIFEST_SHA = "dc16b7253a151c88b3dd18a4b8ed2b72bbbc3989443ac0c6db691f94c3708a00"
STUDY = "worldlaw.magfid-conf2-reference.v1"
SENSORS = ("9", "10", "11", "15")
COMBINATIONS = tuple(itertools.combinations(range(4), 2))
SEED = 20261119
NATIVE_PERIOD_US = 8333
MAX_SOURCE_BYTES = 8_000_000


def sha(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def canon(obj) -> bytes:
    return json.dumps(obj, separators=(",", ":"), sort_keys=True, allow_nan=False).encode()


def immutable(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise RuntimeError("immutable prospective receipt differs: " + str(path))
    else:
        with path.open("xb") as f:
            f.write(data)
            f.flush()


def save(path: Path, obj):
    immutable(path, json.dumps(original.json_ready(obj), indent=2, sort_keys=True,
                               allow_nan=False).encode() + b"\n")


def load(path: Path):
    return json.loads(path.read_bytes())


def source_code_sha():
    return sha(Path(__file__).read_bytes())


def check_frozen(selection):
    if selection["schema"] != STUDY + ".selection":
        raise RuntimeError("wrong frozen source cohort")
    if sha(SOURCE.read_bytes()) != EXPECTED_MANIFEST_SHA:
        raise RuntimeError("publisher source directory manifest changed")
    if selection["source_manifest_sha256"] != EXPECTED_MANIFEST_SHA:
        raise RuntimeError("selection not bound to publisher directory")
    if selection["protocol_sha256"] != sha(PROTOCOL.read_bytes()):
        raise RuntimeError("prospective protocol changed after cohort freeze")
    if selection["script_sha256"] != source_code_sha():
        raise RuntimeError("study script changed after cohort freeze")
    if [len(selection[x]) for x in ("train", "validation", "test")] != [9, 4, 4]:
        raise RuntimeError("study is not the preselected 9/4/4 recording split")
    all_rows = selection["train"] + selection["validation"] + selection["test"]
    if len({r["recording"] for r in all_rows}) != 17:
        raise RuntimeError("source cohort reused a recording")
    return all_rows


def select_source():
    raw = SOURCE.read_bytes()
    if sha(raw) != EXPECTED_MANIFEST_SHA:
        raise RuntimeError("original publisher directory SHA mismatch")
    index = json.loads(raw)
    if index["file_id"] != 48979765 or index["bytes"] != 1581124263:
        raise RuntimeError("source ZIP identity differs")
    entries = {r["name"]: r for r in index["entries"] if r["name"].endswith(".csv")}
    mru_pref = "Data/Car_Exp/Conf_2/MRU/MRU measurs "
    mru = sorted(n for n in entries if n.startswith(mru_pref))
    if len(mru) != 17:
        raise RuntimeError(f"published Conf_2 MRU count changed: {len(mru)}")
    rows = []
    for reference in mru:
        recording = reference[len(mru_pref):-4]
        members = {"MRU": reference}
        for sensor in SENSORS:
            name = f"Data/Car_Exp/Conf_2/DOTs/Bottom/DOT {sensor} {recording}.csv"
            if name not in entries:
                raise RuntimeError("missing published paired four-DOT recording: " + name)
            members[sensor] = name
        selected = []
        for name in sorted(members.values()):
            item = entries[name]
            if item["method"] != 8 or not 0 < item["size"] <= MAX_SOURCE_BYTES or not item["compressed"] or item["crc32"] == "00000000":
                raise RuntimeError("source member size/CRC/compression invariant: " + name)
            selected.append({k: item[k] for k in ("name","offset","size","compressed","crc32")})
        rows.append({"recording": recording, "members": members,
                     "selection_sha256": sha(canon(selected))})
    rows.sort(key=lambda r: (r["selection_sha256"],r["recording"]))
    if len({name for row in rows for name in row["members"].values()}) != 85:
        raise RuntimeError("not exactly 85 distinct source inputs")
    return {"schema": STUDY + ".selection", "source_manifest_sha256": sha(raw),
            "source": index["source"], "source_file_id": index["file_id"],
            "protocol_sha256": sha(PROTOCOL.read_bytes()),
            "script_sha256": source_code_sha(),
            "numeric_rows_opened_before_freeze": False,
            "train": rows[:9], "validation": rows[9:13], "test": rows[13:],
            "source_entries": {name: entries[name] for row in rows
                               for name in row["members"].values()}}


def get_range(url, total, offset, length):
    if not 0 < length <= MAX_SOURCE_BYTES:
        raise RuntimeError("unbounded source ZIP byte-range request")
    expected = f"bytes {offset}-{offset+length-1}/{total}"
    for attempt in range(4):
        try:
            req = Request(url, headers={"Range": f"bytes={offset}-{offset+length-1}",
                                       "User-Agent": "Worldlaw-Conf2-physical-reference-v1"})
            with urlopen(req, timeout=45) as res:
                if res.status != 206 or res.headers.get("Content-Range") != expected:
                    raise RuntimeError("source refused exact bounded range")
                chunk = res.read(length + 1)
                if len(chunk) != length:
                    raise RuntimeError("short/oversize immutable ZIP member range")
                return chunk
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)


def receive(work: Path):
    selection = load(work / "selection.json")
    check_frozen(selection)
    manifest = load(SOURCE)
    rawdir = work / "raw"
    rawdir.mkdir(parents=True, exist_ok=True)
    if (work / "verified-raw.json").exists():
        raise RuntimeError("original intake already closed; use frozen receipt, do not redownload")
    names = sorted(selection["source_entries"], key=lambda n: selection["source_entries"][n]["offset"])

    def retrieve(name):
        row = selection["source_entries"][name]
        basename = Path(name).name
        if basename in ("", ".", "..") or "/" in basename:
            raise RuntimeError("illegal raw source basename")
        dest = rawdir / basename
        if dest.exists():
            data = dest.read_bytes()
        else:
            offset = int(row["offset"])
            length = min(int(row["compressed"])+2078, manifest["bytes"]-offset)
            chunk = get_range(manifest["url"], manifest["bytes"], offset, length)
            if len(chunk) < 30:
                raise RuntimeError("source local ZIP header truncated")
            vals = struct.unpack("<4s5H3I2H", chunk[:30])
            if vals[0] != b"PK\x03\x04" or vals[3] != 8 or vals[2] & 1:
                raise RuntimeError("original source ZIP member not supported deflate")
            nlen, xlen = vals[-2:]
            start = 30+nlen+xlen
            if start > 2078 or chunk[30:30+nlen].decode() != name:
                raise RuntimeError("source member name/extra header changed")
            data = zlib.decompress(chunk[start:start+row["compressed"]], -15)
        if len(data) != row["size"] or f"{zlib.crc32(data)&0xffffffff:08x}" != row["crc32"]:
            raise RuntimeError("source ZIP raw data CRC/length changed")
        immutable(dest, data)
        return name, {"local_name": basename, "bytes": len(data), "sha256": sha(data),
                      "crc32": row["crc32"]}

    verified = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for name, receipt in pool.map(retrieve, names):
            verified[name] = receipt
            if len(verified) % 10 == 0 or len(verified) == 85:
                print(json.dumps({"stage":"intake","verified_members":len(verified),
                                  "total":85,"parsed_numeric_rows":False}), flush=True)
    save(work/"verified-raw.json", {"schema":STUDY+".intake",
       "selection_sha256":sha((work/"selection.json").read_bytes()),
       "members":verified,"numeric_rows_opened":False})
    return {"members":len(verified), "verified_bytes":sum(r["bytes"] for r in verified.values())}


def checked(work: Path):
    sel = load(work/"selection.json")
    rows = check_frozen(sel)
    rec = load(work/"verified-raw.json")
    if rec["schema"] != STUDY+".intake" or rec["selection_sha256"] != sha((work/"selection.json").read_bytes()):
        raise RuntimeError("raw intake does not bind to frozen selection")
    if set(rec["members"]) != set(sel["source_entries"]) or len(rec["members"]) != 85:
        raise RuntimeError("incomplete original source intake")
    for name, receipt in rec["members"].items():
        data = (work/"raw"/receipt["local_name"]).read_bytes()
        if len(data) != receipt["bytes"] or sha(data) != receipt["sha256"]:
            raise RuntimeError("source raw SHA changed after intake: "+name)
    return sel, rec


def axis_times(raw: bytes, time_name: str, axes: list[str]):
    header = next(csv.reader(io.StringIO(raw.split(b"\n",1)[0].decode("utf-8-sig"))))
    columns = [header.index(n) for n in [time_name,*axes]]
    vals = np.loadtxt(io.BytesIO(raw), delimiter=",", usecols=columns, skiprows=1, ndmin=2)
    if vals.shape[1] != 4 or len(vals) < 1500 or not np.isfinite(vals).all():
        raise RuntimeError("reference original 100Hz gyro geometry is invalid")
    t = vals[:,0]
    if np.any(np.diff(t) <= 0) or np.median(np.diff(t)) < .008 or np.median(np.diff(t)) > .012:
        raise RuntimeError("MRU source is not monotone near 100Hz")
    return t, vals[:,1:]


def read(work: Path, sel, intake, record):
    split = {"member_hashes": intake["members"]}
    streams = original.read_record(work, split, record)
    grid, temporal = original.native_grid(streams, NATIVE_PERIOD_US)
    if temporal["interpolated_samples"] != 0 or temporal["duration_seconds"] < 50:
        raise RuntimeError("source DOT native clock is insufficient for disjoint stationary intervals")
    name = record["members"]["MRU"]
    payload = (work/"raw"/intake["members"][name]["local_name"]).read_bytes()
    if sha(payload) != intake["members"][name]["sha256"]:
        raise RuntimeError("reference MRU source SHA mismatch")
    r_times, r_axes = axis_times(payload, "Time_Sample [sec]",
                               ["Gyro_X [dps]","Gyro_Y [dps]","Gyro_Z [dps]"])
    return grid, temporal, (r_times,r_axes)


def stationary_slices(n, dt):
    # 10s effective first/last stationary spans, one-second exclusion at edges.
    at = int(round(1/dt)); full = int(round(10/dt)); outer = int(round(11/dt))
    if n < 4*outer or at+full+int(round(2/dt)) >= n:
        raise RuntimeError("source stationary windows too short")
    return [(at,at+full),(n-outer,n-at)]


def frozen_bias(work, sel, intake):
    dot_means, mru_means = [], []
    for row in sel["train"]:
        grid, tempo, (t,mru) = read(work,sel,intake,row)
        dt = tempo["native_period_us"]/1e6
        segments = stationary_slices(len(grid),dt)
        dot_means.append(np.mean([np.nanmean(grid[a:b],axis=0) for a,b in segments],axis=0))
        sec = t-t[0]; end=sec[-1]
        masks=[(sec>=1)&(sec<11),(sec>=end-11)&(sec<end-1)]
        if min(int(mask.sum()) for mask in masks)<850:
            raise RuntimeError("MRU precommitted stationary interval absent")
        mru_means.append(np.mean([mru[mask].mean(axis=0) for mask in masks],axis=0))
    dot_bias=np.mean(dot_means,axis=0)
    ref_bias=np.mean(mru_means,axis=0)
    if not np.isfinite(dot_bias).all() or not np.isfinite(ref_bias).all():
        raise RuntimeError("training stationary mean nonfinite")
    return dot_bias,ref_bias


def lag_indices():
    dt=NATIVE_PERIOD_US/1e6
    lags=sorted(set(list(range(25))+[int(round(s/dt)) for s in (.5,1.,2.)]))
    if len(lags)!=28:
        raise RuntimeError("fixed 28 original source lags changed")
    return np.array(lags,dtype=np.int64),np.array(lags,dtype=float)*dt


def stationary_moments(grid,dot_bias,ref_data,ref_bias):
    dt=NATIVE_PERIOD_US/1e6
    lags,_=lag_indices()
    block=int(round(2/dt))
    blocks=[]
    for first,stop in stationary_slices(len(grid),dt):
        for offset in range(4):
            start=first+offset*block
            if start+block+int(max(lags))>stop:
                raise RuntimeError("2s stationary anchor with 2s halo exceeded physical standstill")
            ix=np.arange(start,start+block)
            series=[]
            for lag in lags:
                a=grid[ix,:,2]-dot_bias[None,:,2]
                b=grid[ix+lag,:,2]-dot_bias[None,:,2]
                mask=np.isfinite(a).all(axis=1)&np.isfinite(b).all(axis=1)
                if mask.sum()<.95*block:
                    raise RuntimeError("missing >5% of native stationary sample pairs")
                c=a[mask].T@b[mask]/mask.sum()
                series.append((c+c.T)/2)
            blocks.append(np.array(series))
    t,mru=ref_data; sec=t-t[0]; end=float(sec[-1])
    masks=[(sec>=1)&(sec<11),(sec>=end-11)&(sec<end-1)]
    resid=[]
    for mask in masks:
        if mask.sum()<850:
            raise RuntimeError("MRU 100Hz standalone stillness interval too short")
        resid.extend((mru[mask,2]-ref_bias[2]).tolist())
    resid=np.array(resid)
    # MRU is an independent *motion falsifier*, never a perfect reference.
    ref_rms=float(np.sqrt(np.mean(resid**2)))
    if not np.isfinite(ref_rms):
        raise RuntimeError("nonfinite MRU source stationary diagnostic")
    return np.array(blocks),ref_rms


def source_cohort(work, sel, intake, part, dot_bias, ref_bias):
    outcomes=[]
    for record in sel[part]:
        grid,temporal,ref=read(work,sel,intake,record)
        blocks,mru_rms=stationary_moments(grid,dot_bias,ref,ref_bias)
        outcomes.append({"recording":record["recording"],
                         "raw_members_sha256":{k:intake["members"][name]["sha256"]
                                               for k,name in record["members"].items()},
                         "blocks":blocks,
                         "mru_stationary_rms_dps":mru_rms,
                         "dot_temporal":temporal})
    return outcomes


def curve_model(curve, t, family):
    curve=np.asarray(curve,dtype=float)
    if not np.isfinite(curve).all() or len(curve)!=28:
        raise RuntimeError("nonfinite source covariance curve")
    fit,meta=original.fit_curve(curve,t,family)
    if not np.isfinite(fit).all() or fit.shape!=(28,):
        raise RuntimeError("invalid stationary covariance model")
    return fit,meta


def build_models(recs):
    _,t=lag_indices()
    source=np.mean([np.mean(x["blocks"],axis=0) for x in recs],axis=0)
    if source.shape!=(28,4,4) or not np.isfinite(source).all():
        raise RuntimeError("source stationarity covariance geometry invalid")
    pair=np.stack([source[:,i,i]+source[:,j,j]-2*source[:,i,j]
                   for i,j in COMBINATIONS],axis=1)
    components=np.array([original.COLLOCATION @ pair[k] for k in range(28)])
    shared=np.mean([source[:,i,j] for i,j in COMBINATIONS],axis=0)
    residual=np.stack([source[:,i,i]-shared for i in range(4)],axis=1)

    def matrix(diag,off=None):
        result=np.zeros((28,4,4))
        for i in range(4):
            result[:,i,i]=diag[:,i]
        if off is not None:
            for i,j in COMBINATIONS:
                result[:,i,j]=result[:,j,i]=off
        return result

    cfit, cmeta=[],[]
    for i in range(4):
        a,b=curve_model(components[:,i],t,"white_ou")
        cfit.append(a);cmeta.append(b)
    contrast=matrix(np.stack(cfit,axis=1))
    ofit, ometa=[],[]
    for i in range(4):
        a,b=curve_model(source[:,i,i],t,"white_ou")
        ofit.append(a);ometa.append(b)
    ou=matrix(np.stack(ofit,axis=1))
    iid=matrix(np.stack([np.maximum(source[0].diagonal(),0.0) if j==0
                       else np.zeros(4) for j in range(28)]))
    common, commonmeta=curve_model(shared,t,"white_ou")
    resfit,resmeta=[],[]
    for i in range(4):
        a,b=curve_model(residual[:,i],t,"white_ou")
        resfit.append(a);resmeta.append(b)
    candidate=matrix(np.stack(resfit,axis=1)+common[:,None],common)
    diagnostics={"train_raw_shared_lag0":float(shared[0]),
                 "train_raw_independent_lag0":residual[0].tolist(),
                 "pair_contrast_components_lag0":components[0].tolist(),
                 "conditional_variances_nonnegative":bool(shared[0]>=0 and np.all(residual[0]>=0)),
                 "shared_model":commonmeta,"individual_models":resmeta,
                 "contrast_models":cmeta,"ou_models":ometa,
                 "train_trajectories":len(recs)}
    return {"reference_shared":candidate, "contrast_only":contrast,
            "iid":iid, "single_ou":ou},diagnostics


def evaluate(models,recs):
    if not recs:
        raise RuntimeError("empty source evaluation partition")
    observed=np.stack([np.mean(r["blocks"],axis=0) for r in recs])
    if observed.shape[1:]!=(28,4,4):
        raise RuntimeError("heldout receiver not original 28x4x4")
    mean=observed.mean(axis=0)
    variance=mean[0].diagonal()
    if not np.isfinite(variance).all() or np.any(variance<=1e-10):
        raise RuntimeError("stationary covariance zero/negative normalizer")
    scale=np.sqrt(variance[:,None]*variance[None,:])
    results={}
    for name,model in models.items():
        pred=np.asarray(model)
        if pred.shape!=(28,4,4) or not np.isfinite(pred).all():
            raise RuntimeError("model covariance is not frozen 28x4x4")
        errors=(observed-pred[None,:,:,:])/scale[None,None,:,:]
        scores=np.mean(errors**2,axis=(1,2,3))
        pair_ratios={}
        for i,j in COMBINATIONS:
            truth=mean[0,i,i]+mean[0,j,j]-2*mean[0,i,j]
            predicted=pred[0,i,i]+pred[0,j,j]-2*pred[0,i,j]
            pair_ratios[f"{SENSORS[i]}-{SENSORS[j]}"]=float(predicted/truth) if truth>1e-10 else None
        results[name]={"recording_scores":scores.tolist(),
                       "mean_normalized_mse":float(scores.mean()),
                       "per_sensor_lag0_ratio":(pred[0].diagonal()/variance).tolist(),
                       "per_pair_contrast_lag0_ratio":pair_ratios,
                       "max_normalized_residual":float(np.max(abs((mean-pred)/scale)))}
    # A recording-first, nested 2-second block bootstrap; original model stays frozen.
    rng=np.random.default_rng(SEED)
    boot=np.empty((2000,28,4,4))
    for n in range(2000):
        chosen=rng.integers(len(recs),size=len(recs))
        per=[]
        for i in chosen:
            rows=recs[int(i)]["blocks"]
            subs=rows[rng.integers(len(rows),size=len(rows))]
            per.append(subs.mean(axis=0))
        boot[n]=np.mean(per,axis=0)
    band=np.quantile(np.max(abs((boot-mean[None,:,:,:])/scale[None,None,:,:]),
                             axis=(1,2,3)),.95)
    candidate=results["reference_shared"]; control=results["contrast_only"]
    cmean=candidate["mean_normalized_mse"]; bmean=control["mean_normalized_mse"]
    improvements=float(1-cmean/bmean) if bmean>0 else None
    ratios=candidate["per_sensor_lag0_ratio"]+list(candidate["per_pair_contrast_lag0_ratio"].values())
    ratio_ok=bool(all(r is not None and .75<=r<=1.25 for r in ratios))
    return {"recordings":len(recs),
       "readings_each_recording":[len(r["blocks"]) for r in recs],
       "mrup_stationary_rms_dps":[r["mru_stationary_rms_dps"] for r in recs],
       "methods":results,
       "source_recordings":[r["recording"] for r in recs],
       "candidate_vs_contrast_relative_gain":improvements,
       "simultaneous_bootstrap_band_95":float(band),
       "candidate_inside_bootstrap_band":candidate["max_normalized_residual"]<=band,
       "candidate_lag0_ratios_in_band":ratio_ok,
       "mrup_stationarity_refusal":bool(any(r["mru_stationary_rms_dps"]>.5 for r in recs)),
       "recording_bootstrap_draws":2000, "bootstrap_seed":SEED}


def selftest():
    if len(lag_indices()[0])!=28:
        raise AssertionError("28 lag protocol")
    source=select_source()
    check_frozen(source)
    if len(source["source_entries"])!=85:
        raise AssertionError("85 actual directory records")
    rng=np.random.default_rng(SEED)
    n=9000
    common=np.zeros(n)
    for i in range(1,n):
        common[i]=.92*common[i-1]+rng.normal(scale=.08)
    private=rng.normal(scale=.11,size=(n,4))
    stationary=common[:,None]+private
    paired=stationary[:,0]-stationary[:,1]
    injected=np.sin(np.arange(n)*.02)*.6
    mutated=stationary+injected[:,None]
    if np.max(abs(paired-(mutated[:,0]-mutated[:,1])))>1e-12:
        raise AssertionError("injected correlated error changed contrast")
    before=float(np.cov(stationary[:,0],stationary[:,1])[0,1])
    after=float(np.cov(mutated[:,0],mutated[:,1])[0,1])
    if after-before<.1:
        raise AssertionError("stationary cross-DOT covariance missed true common-mode")
    # Even the independent MRU cannot distinguish a shared nuisance when it
    # is injected into MRU too: it is observationally equivalent to true rate.
    ref=rng.normal(scale=.04,size=n)
    if not np.allclose(mutated-ref[:,None]-injected[:,None],
                       stationary-ref[:,None],atol=1e-12,rtol=0):
        raise AssertionError("five-sensor common motion nullspace disappeared")
    duplicated=stationary.copy();duplicated[:,3]=duplicated[:,2]
    if np.var(duplicated[:,3]-duplicated[:,2])!=0:
        raise AssertionError("duplicate physical sensor not singular")
    shaken=np.tile(np.array([0.,3.0,-3.0,2.0,-2.0]),1800)
    if float(np.sqrt(np.mean(shaken**2)))<=.5:
        raise AssertionError("imposed shake not refused as false stationary")
    return {"passed":True,"actual_source_metadata_rows":len(source["source_entries"]),
            "frozen_train_val_test":[len(source[k]) for k in ("train","validation","test")],
            "contrast_common_mode_max_error":float(np.max(abs(paired-(mutated[:,0]-mutated[:,1])))),
            "stationary_shared_covariance_increment":after-before,
            "five_sensor_common_motion_unidentifiable":True,
            "duplicated_sensor_pair_variance":float(np.var(duplicated[:,3]-duplicated[:,2])),
            "shaken_reference_rms":float(np.sqrt(np.mean(shaken**2)))}


def packed_model(work, sel, intake):
    if not (work/"train-model.json").exists():
        raise RuntimeError("train model absent")
    m=load(work/"train-model.json")
    if (m["schema"]!=STUDY+".train" or
        m["source_selection_sha256"]!=sha((work/"selection.json").read_bytes()) or
        m["verified_raw_sha256"]!=sha((work/"verified-raw.json").read_bytes()) or
        m["source_script_sha256"]!=source_code_sha()):
        raise RuntimeError("train model not bound to frozen source/software")
    return m


def original_training(work,sel,intake):
    bias,rbias=frozen_bias(work,sel,intake)
    recs=source_cohort(work,sel,intake,"train",bias,rbias)
    models,diagnostics=build_models(recs)
    return {"schema":STUDY+".train",
      "source_selection_sha256":sha((work/"selection.json").read_bytes()),
      "verified_raw_sha256":sha((work/"verified-raw.json").read_bytes()),
      "source_script_sha256":source_code_sha(),
      "dot_bias_dps":bias.tolist(),"mrup_bias_dps":rbias.tolist(),
      "models":{k:v.tolist() for k,v in models.items()},
      "source_diagnostics":diagnostics,
      "train_recording_mru_rms":[r["mru_stationary_rms_dps"] for r in recs],
      "lags_samples":lag_indices()[0].tolist(),
      "no_target_numeric_rows_read":True}


def scoring(work,part,m):
    sel,intake=checked(work)
    dbias=np.array(m["dot_bias_dps"]);rbias=np.array(m["mrup_bias_dps"])
    recs=source_cohort(work,sel,intake,part,dbias,rbias)
    return {"schema":STUDY+"."+part,"partition":part,
      "train_model_sha256":sha((work/"train-model.json").read_bytes()),
      "source_selection_sha256":sha((work/"selection.json").read_bytes()),
      "source_script_sha256":source_code_sha(),
      "scores":evaluate({k:np.asarray(v) for k,v in m["models"].items()},recs)}


def final_gates(report,m):
    score=report["scores"]
    valid_baseline=score["methods"]["contrast_only"]["mean_normalized_mse"]>0
    ref=score["methods"]["reference_shared"]
    numeric=[ref["mean_normalized_mse"],ref["max_normalized_residual"]]
    cnd=m["source_diagnostics"]["conditional_variances_nonnegative"]
    gates={"three_distinct_unseen_recordings":score["recordings"]>=3,
           "training_conditional_variances":bool(cnd),
           "heldout_mru_stationary":not score["mrup_stationarity_refusal"],
           "all_candidate_lagzero_ratios":score["candidate_lag0_ratios_in_band"],
           "simultaneous_95pct_residual_band":score["candidate_inside_bootstrap_band"],
           "vs_contrast_gain_10pct":bool(valid_baseline and
             score["candidate_vs_contrast_relative_gain"] is not None and
             score["candidate_vs_contrast_relative_gain"]>=.10),
           "negative_controls":False}
    return {"gates":gates,"all_gates_passed":False,
            "claim":"No unconditional sensor or Worldlaw planner calibration. "
                    "The negative-control physical run must be independently received "
                    "before any scientific promotion."}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage",choices=("selftest","prepare","intake","train","validate","freeze","test"))
    parser.add_argument("--workdir",default="/workspace/tmp/worldlaw-magfid-conf2-reference")
    args=parser.parse_args()
    work=Path(args.workdir)
    if args.stage=="selftest":
        print(json.dumps(selftest(),sort_keys=True));return
    if args.stage=="prepare":
        work.mkdir(parents=True,exist_ok=True)
        saved=select_source();save(work/"selection.json",saved)
        print(json.dumps({"stage":"prepare","recordings":17,
              "source_entries":85,"source_selection_sha256":sha((work/"selection.json").read_bytes()),
              "parse_numeric":False}));return
    sel=load(work/"selection.json");check_frozen(sel)
    if args.stage=="intake":
        print(json.dumps(receive(work),sort_keys=True));return
    sel,intake=checked(work)
    if args.stage=="train":
        result=original_training(work,sel,intake)
        save(work/"train-model.json",result)
        print(json.dumps({"stage":"train","sha256":sha((work/"train-model.json").read_bytes()),
                          "diagnostics":result["source_diagnostics"]},sort_keys=True));return
    m=packed_model(work,sel,intake)
    if args.stage=="validate":
        result=scoring(work,"validation",m)
        save(work/"validation.json",result)
        print(json.dumps({"stage":"validation","sha256":sha((work/"validation.json").read_bytes()),
                          "scores":result["scores"]},sort_keys=True));return
    if args.stage=="freeze":
        val=load(work/"validation.json")
        if val["partition"]!="validation" or val["train_model_sha256"]!=sha((work/"train-model.json").read_bytes()):
            raise RuntimeError("validation receipt not source/fitting pinned")
        receipt={"schema":STUDY+".test-freeze","source_script_sha256":source_code_sha(),
                 "train_model_sha256":sha((work/"train-model.json").read_bytes()),
                 "validation_sha256":sha((work/"validation.json").read_bytes()),
                 "selection_sha256":sha((work/"selection.json").read_bytes()),
                 "original_source_control":"taskboard:161657",
                 "heldout_rows_opened_before_freeze":False}
        save(work/"test-freeze.json",receipt)
        print(json.dumps({"stage":"freeze","sha256":sha((work/"test-freeze.json").read_bytes())}));return
    if args.stage=="test":
        freeze=load(work/"test-freeze.json")
        if (freeze["schema"]!=STUDY+".test-freeze" or
            freeze["source_script_sha256"]!=source_code_sha() or
            freeze["selection_sha256"]!=sha((work/"selection.json").read_bytes()) or
            freeze["train_model_sha256"]!=sha((work/"train-model.json").read_bytes()) or
            freeze["validation_sha256"]!=sha((work/"validation.json").read_bytes())):
            raise RuntimeError("untouched test blocked: frozen original changed")
        result=scoring(work,"test",m)
        result["test_freeze_sha256"]=sha((work/"test-freeze.json").read_bytes())
        result["promotion"]=final_gates(result,m)
        save(work/"test.json",result)
        print(json.dumps({"stage":"test","sha256":sha((work/"test.json").read_bytes()),
                          "promotion":result["promotion"],
                          "scores":result["scores"]},sort_keys=True))


if __name__=="__main__":
    main()
