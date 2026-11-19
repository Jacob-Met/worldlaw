#!/usr/bin/env python3
"""Original 4TU Cascaded Tanks: independently frozen train and blind receiver.

USAGE
  python3 experiments/cascaded-tanks-physical.py fit ORIGINAL.zip frozen.json
  python3 experiments/cascaded-tanks-physical.py evaluate ORIGINAL.zip frozen.json receipt.json

Fit loads only the named uEst, yEst, Ts fields. The official separate test
uVal/yVal fields are parsed ONLY in the evaluate process after immutable fit
JSON, source SHA and solver SHA checks. No heldout numerical value influences
training model structure, hyperparameters, or latent-state solver choice.
"""
from __future__ import annotations
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sys
import time
import zipfile
import numpy as np
from scipy.io import loadmat
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"/"science"))
import controlled_hydraulics as hyd

SCHEMA="worldlaw.original-cascaded-tanks/v1"
DOI="10.4121/12960104"
ZIP_SHA256="eb0fa05851e8a7136846c2e3b61fbef87def78d0852c86ab91b02ac5db541b51"
ZIP_SIZE=7520592
MAT_NAME="CascadedTanksFiles/dataBenchmark.mat"
FIT_N=716
TOTAL_N=1024
PREFIX=50
def sha(data):return hashlib.sha256(data).hexdigest()
def safe_json(obj):return (json.dumps(obj,sort_keys=True,indent=2,allow_nan=False)+"\n").encode()
def insist(cond,why):
    if not cond:raise ValueError("cascaded original physical benchmark: "+why)
def code_hashes():
    return {
      "solver":sha((ROOT/"src"/"science"/"controlled_hydraulics.py").read_bytes()),
      "receiver":sha(Path(__file__).read_bytes()),
    }
def authenticate(original):
    source=Path(original).read_bytes()
    insist(len(source)==ZIP_SIZE,"author original archive size changed")
    insist(sha(source)==ZIP_SHA256,"author original archive SHA mismatch: "+sha(source))
    with zipfile.ZipFile(io.BytesIO(source)) as z:
        names=z.namelist()
        insist(MAT_NAME in names,"missing author original dataBenchmark.mat")
        insist(len(names)<100 and all(not (n.startswith("/") or ".." in n or "\\" in n) for n in names),
               "unsafe or unexpected original ZIP layout")
        b=z.read(MAT_NAME)
    insist(len(b)>10000 and len(b)<2_000_000,"unexpected author MAT data size")
    return b,{"archiveSha256":ZIP_SHA256,"archiveBytes":len(source),
              "matSha256":sha(b),"matBytes":len(b),
              "originalDataset":"Schoukens/Mattsson/Wigren/Noel 4TU Cascaded Tanks With Overflow",
              "sourceDOI":DOI,"license":"CC BY-SA 4.0",
              "sourceURL":"https://data.4tu.nl/file/d4810b78-6cdd-48fe-8950-9bd601e5f47f/3b697e42-01a4-4979-a370-813a456c36f5"}
def load_named_original(mat_bytes,phase):
    if phase=="fit":
        allowed=["uEst","yEst","Ts"]
    elif phase=="evaluate":
        allowed=["uVal","yVal","Ts"]
    else:raise ValueError("unknown source split phase")
    # The loader itself never decodes or returns forbidden test source fields
    # in the fit phase. Separate process and frozen artifact enforce the gate.
    d=loadmat(io.BytesIO(mat_bytes),variable_names=allowed)
    insist(not any(k in d for k in ["uVal","yVal"] if phase=="fit"),
           "blind test fields entered fitting memory")
    assert "Ts" in d
    ts=float(np.asarray(d["Ts"]).squeeze())
    insist(abs(ts-4.)<1e-8,"author source sampling period changed")
    keys=("uEst","yEst") if phase=="fit" else ("uVal","yVal")
    insist(all(k in d for k in keys),"named author original source fields missing")
    u,y=hyd.numeric_series(np.asarray(d[keys[0]]).reshape(-1),
                           np.asarray(d[keys[1]]).reshape(-1))
    insist(len(u)==TOTAL_N,"original estimation and test must each be 1024 ZOH samples")
    return u,y,ts
def source_signature(original):
    mat,meta=authenticate(original)
    return mat,meta
def fit_original(original,destination):
    start=time.perf_counter()
    mat,source=source_signature(original)
    u_est,y_est,ts=load_named_original(mat,"fit")
    u_train,y_train=u_est[:FIT_N],y_est[:FIT_N]
    u_dev,y_dev=u_est[FIT_N:],y_est[FIT_N:]
    selected,attempts=hyd.select_on_development(u_train,y_train,u_dev,y_dev)
    # All candidate/parameter selection is frozen before even importing
    # uVal/yVal into this process. Preserve every attempted structure.
    summary=[]
    for a in attempts:
        item={"family":a["family"],"model":a["model"],"developmentRmseVolts":a["dev_rmse"]}
        if "dev_prefix_calibration" in a:item["dev_prefix_calibration"]=a["dev_prefix_calibration"]
        summary.append(item)
    model={
      "schema":SCHEMA,"source":source,"solverSha256":code_hashes(),
      "prospectiveTask":"t-mwn6ceogovzg","preregistrationMessage":156260,
      "split":{"fit":"uEst/yEst original first716 samples only",
               "development":"uEst/yEst original last308; first50 dev y allowed only for initialization",
               "sealed":"whole uVal/yVal original 1024 untouched until separate evaluate process",
               "testPermittedInitialization":50,"samplePeriodSeconds":ts,
               "primaryMetric":"full free-run lower-tank output-volts RMSE on original official test y[50:]"},
      "selected":selected,
      "baseline":{"family":"persistence"},
      "candidates":summary,
      "fitRuntime":{"wallSeconds":time.perf_counter()-start,
             "python":sys.version.split()[0],
             "numpy":np.__version__},
      "decisionFrozenBeforeTest":True,
      "explanation":"Hydraulic upper state is hidden; physical coefficients in pseudo-voltage units are not absolute apparatus parameters."
    }
    payload=safe_json(model)
    destination=Path(destination)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_bytes(payload)
    print(json.dumps({"mode":"fit","frozen":str(destination),
          "frozenSha256":sha(payload),"selectedFamilyScores":{
          k:min(x["developmentRmseVolts"] for x in summary if x["family"]==k)
          for k in ("arx","hydraulic")},
          "sourceZipSha":source["archiveSha256"],"sourceMatSha":source["matSha256"],
          "candidateCount":len(summary),"seconds":model["fitRuntime"]["wallSeconds"]},sort_keys=True))
def evaluate_original(original,frozen_path,receipt_path):
    start=time.perf_counter()
    text=Path(frozen_path).read_bytes()
    frozen=json.loads(text)
    insist(frozen.get("schema")==SCHEMA and frozen.get("decisionFrozenBeforeTest") is True,
           "prospectively frozen model required")
    insist(frozen.get("solverSha256")==code_hashes(),
           "source solver changed after frozen training; test receiving refused")
    mat,source=source_signature(original)
    insist(source==frozen.get("source"),"source bytes/metadata changed since fitting")
    # Numeric official-test fields are first loaded below, AFTER exact frozen
    # source/candidate checks. No further optimization/selection follows.
    u_test,y_test,ts=load_named_original(mat,"evaluate")
    model_results={}
    for family,model in [("persistence",frozen["baseline"]),*frozen["selected"].items()]:
        applied=hyd.free_run(model,u_test,y_test,init=PREFIX)
        pred=applied.pop("prediction")
        model_results[family]={"rmseVolts":applied["rmse"],"count":applied["count"],
            "calibration":applied["calibration"],"predictionSha256":sha(pred.astype("<f8").tobytes())}
    controls={}
    for family in ("arx","hydraulic"):
        model=frozen["selected"][family]
        shifted=hyd.free_run(model,u_test,y_test,init=PREFIX,shift=97)
        zero=hyd.free_run(model,u_test,y_test,init=PREFIX,zero_input=True)
        controls[family]={"shift97":shifted["rmse"],"zeroInput":zero["rmse"],
            "unshifted":model_results[family]["rmseVolts"]}
    arx=frozen["selected"]["arx"]
    # A sham label relation is built from the ORIGINAL estimation-only prefix.
    # This sham never participates in model selection, and yVal is absent from
    # the original fitting process.
    source_est=load_named_original(mat,"fit")
    sham=hyd.fit_arx(source_est[0][:FIT_N],np.roll(source_est[1][:FIT_N],37),
                    arx["order"],arx["ridge"])
    controls["shuffledTrainingLabelsArx"]=hyd.free_run(sham,u_test,y_test,init=PREFIX)["rmse"]
    baseline=model_results["arx"]["rmseVolts"]
    nonlinear=model_results["hydraulic"]["rmseVolts"]
    phys=frozen["selected"]["hydraulic"]
    enough=(nonlinear<=.9*baseline and controls["hydraulic"]["shift97"]>nonlinear
            and controls["hydraulic"]["zeroInput"]>nonlinear
            and bool(phys.get("converged")))
    # Explicitly posthoc: original official test is ALREADY consumed; this
    # diagnoses latent-state saturation without changing the selected model,
    # the test predictions, the preregistered score, or the promotion gate.
    model_diagnostics={
        "testPredictedStatesAndCapacity":hyd.inspect_physical_excitation(
            phys,u_test,y_test[:PREFIX]),
        "fitPredictedStatesAndCapacity":hyd.inspect_physical_excitation(
            phys,source_est[0][:FIT_N],source_est[1][:PREFIX]),
        "scope":"Predicted water state, not independent measured overflow evidence; first50 observed output only for hidden-state start."
    }
    verdict={"promoted":bool(enough),"baselineArxVolts":baseline,
        "physicalVolts":nonlinear,"relativeImprovement":1.-nonlinear/baseline if baseline>0 else None,
        "criterion":"original full 974-step free-run physically signed hydraulic >=10% better than development-tuned ARX; both shifted and zero-input controls worsen; numerical solver converged.",
        "interpretation":"Only one separately recorded official test series. This does not by itself identify unique hidden states, calibrate voltage as depth, or establish safe actuator intervention."}
    report={"schema":"worldlaw.original-cascaded-tanks-receipt/v1",
        "frozenModelSha256":sha(text),
        "source":source,"preRegistration":{"task":"t-mwn6ceogovzg","message":156260,
        "sourceProofMessage":156323,"sourceOnlyProofActionsRun":44473434246},
        "fitSummary":{"trainingAndDevelopment":frozen["split"],
                      "selected":frozen["selected"],
                      "developmentCandidates":frozen["candidates"],
                      "fitRuntime":frozen["fitRuntime"]},
        "officialTest":{"name":"original disjoint uVal/yVal multisine, sample period 4s",
                        "length":TOTAL_N,"observedInitialization":PREFIX,
                        "scored":TOTAL_N-PREFIX,"models":model_results,
                        "controls":controls,"gate":verdict,
                        "posthocObservability":model_diagnostics},
        "evaluation":{"wallSeconds":time.perf_counter()-start,
                      "python":sys.version.split()[0],"numpy":np.__version__},
        "limitations":"Source instrument voltage not calibrated depth; latent first-tank state and overflow stochastic; no test refitting, no causal uniqueness or randomized trials beyond published multisine."}
    payload=safe_json(report)
    destination=Path(receipt_path)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_bytes(payload)
    print(json.dumps({"mode":"official-blind-evaluate","receipt":str(destination),
        "source":source["archiveSha256"],"receiptSha256":sha(payload),
        "frozenModelSha256":sha(text),"scored":TOTAL_N-PREFIX,
        "metrics":{k:v["rmseVolts"] for k,v in model_results.items()},
        "controls":controls,"gate":verdict,
        "seconds":report["evaluation"]["wallSeconds"]},sort_keys=True))
def main(argv):
    insist(len(argv) in (4,5),
        "usage fit source.zip model.json | evaluate source.zip model.json receipt.json")
    if argv[1]=="fit" and len(argv)==4:fit_original(argv[2],argv[3])
    elif argv[1]=="evaluate" and len(argv)==5:evaluate_original(argv[2],argv[3],argv[4])
    else:raise ValueError("invalid separated-model test mode")
if __name__=="__main__":
    try:main(sys.argv)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        sys.exit(1)
