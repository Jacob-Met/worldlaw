#!/usr/bin/env python3
"""First-party original InTaSet multi-sensor four-tank physical transfer study.

The user and author's sensor data remain outside git. Authoritative original ZIP
SHA and CC-BY-4.0 metadata are pinned. This two-PROCESS entrypoint ensures
original independent test XLSX files are *never even opened* during the fit
process. The fit artifact cryptographically pins code/source/selected models.

python3 experiments/intaset-quadruple-physical.py fit original.zip frozen.json
python3 experiments/intaset-quadruple-physical.py evaluate original.zip frozen.json report.json
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
from openpyxl import load_workbook

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"/"science"))
import quadruple_tank_hydraulics as hyd

SCHEMA="worldlaw.original-intaset-four-tank/v1"
SOURCE_SHA="a0aac3b0985bec232afa8f9e95cd87612515904f5e574bc483777e4d532e8c85"
SOURCE_MD5="0fe80940a3c9520e665b769f4b8d5ab8"
SOURCE_BYTES=6107043
BASE="InTaSet/InTaSet-ID"
SOURCE_PATHS={
  "4T-M1":{
    "train":(BASE+"/InTaSet-ID-4T-M1/InTaSet-ID-4T-M1_Training/"
             "InTaSet-ID-4T-M1_Training.xlsx","Training"),
    "test":(BASE+"/InTaSet-ID-4T-M1/InTaSet-ID-4T-M1_Testing/"
            "InTaSet-ID-4T-M1_Testing.xlsx","Validation")
  },
  "4T-M2":{
    "train":(BASE+"/InTaSet-ID-4T-M2/InTaSet-ID-4T-M2_Training/"
             "InTaSet-ID-4T-M2_Training.xlsx","Training"),
    "test":(BASE+"/InTaSet-ID-4T-M2/InTaSet-ID-4T-M2_Testing/"
            "InTaSet-ID-4T-M2_Testing.xlsx","Testing")
  }
}
PERCENT_TRAIN=.7
MIN_SEGMENT=128
SAMPLE_SECONDS=.1

def require(ok,why):
    if not ok:raise ValueError("original InTaSet receiver: "+why)
def digest(x):return hashlib.sha256(x).hexdigest()
def safe_json(obj):return (json.dumps(obj,sort_keys=True,indent=2,allow_nan=False)+"\n").encode()
def hash_code():
    return {"core":digest((ROOT/"src"/"science"/"quadruple_tank_hydraulics.py").read_bytes()),
      "receiver":digest(Path(__file__).read_bytes())}
def authenticate(p):
    p=Path(p)
    require(p.is_file(),"original author ZIP source does not exist")
    raw=p.read_bytes()
    require(len(raw)==SOURCE_BYTES,"original author ZIP byte length mismatch")
    require(digest(raw)==SOURCE_SHA,"original author ZIP SHA mismatch "+digest(raw))
    require(hashlib.md5(raw).hexdigest()==SOURCE_MD5,"Zenodo published MD5 mismatch")
    z=zipfile.ZipFile(io.BytesIO(raw))
    allfiles=z.infolist()
    require(len(allfiles)<50 and sum(i.file_size for i in allfiles)<25_000_000,
        "original ZIP index/expanded byte limits violated")
    require(all(not (i.filename.startswith('/') or '..' in i.filename.split('/')
             or chr(92) in i.filename) for i in allfiles),
        "original ZIP invalid path traversal")
    expected=[p for modes in SOURCE_PATHS.values() for p,_ in modes.values()]
    require(all(p in z.namelist() for p in expected),
            "author original four-tank workbook/sheet IDs changed")
    return z,{"doi":"10.5281/zenodo.17652851",
       "publication":"10.1061/9780784486931.058",
       "authors":"Putri, Villacres, Raza, Iwakin, Moazeni",
       "datasetLicense":"CC-BY-4.0 (original Zenodo API metadata)",
       "sourceArchiveSha256":SOURCE_SHA,"sourceArchiveMd5":SOURCE_MD5,
       "sourceArchiveBytes":SOURCE_BYTES,
       "authorRepository":"Moazeni-s-Concise-Lab/InTaSet"}

def extract_numeric_row(row):
    vals=[]
    for cell in row[:7]:
        try:
            if isinstance(cell,bool) or cell is None:return None
            v=float(cell)
            if not math.isfinite(v):return None
            vals.append(v)
        except (ValueError,TypeError):
            return None
    return vals if len(vals)==7 else None

def load_workbook_segments(z,mode,role):
    require(mode in SOURCE_PATHS and role in ("train","test"),
            "unknown preregistered original source role")
    name,sheet=SOURCE_PATHS[mode][role]
    source_bytes=z.read(name)
    require(1000<len(source_bytes)<2_000_000,"unexpected author original workbook size")
    wb=load_workbook(io.BytesIO(source_bytes),read_only=True,data_only=True)
    try:
        require(sheet in wb.sheetnames,
                "source workbook sheet name changed "+name)
        ws=wb[sheet]
        it=ws.iter_rows(values_only=True)
        headers=next(it,None)
        require(headers is not None,"missing author source first-row schema")
        labels=[str(x or "").strip().lower().replace(" ","").replace("-","")
                for x in headers[:7]]
        require(len(labels)>=7 and all("tank"+str(i) in labels[i]
                for i in (1,2,3,4)) and "pump1" in labels[5] and "pump2" in labels[6],
                "author's actual four-tank first-row sensor/pump header differs")
        # A1 in M1 training may be numeric, NOT a reliable Time header.
        # Exactly one entire first-row record is excluded uniformly.
        segments=[]
        current=[]
        start_line=2
        prevtime=None
        original_rows=0
        invalid_rows=0
        time_breaks=0
        ts_observed=[]
        def flush(end_line):
            nonlocal current,start_line
            if current:
                segments.append({"startRow":start_line,"endRow":end_line,
                    "rows":current})
            current=[]
            start_line=end_line+1
        for excel_row,raw in enumerate(it,start=2):
            original_rows+=1
            parsed=extract_numeric_row(raw)
            if parsed is None:
                invalid_rows+=1
                flush(excel_row-1)
                prevtime=None
                start_line=excel_row+1
                continue
            t,y1,y2,y3,y4,u1,u2=parsed
            if prevtime is not None:
                interval=t-prevtime
                if not (SAMPLE_SECONDS*.5 <=interval<=SAMPLE_SECONDS*1.5):
                    time_breaks+=1
                    flush(excel_row-1)
                    start_line=excel_row
                else:ts_observed.append(interval)
            current.append(parsed)
            prevtime=t
        flush(original_rows+1)
        output=[]
        discarded_short=0
        for i,seg in enumerate(segments):
            rows=seg["rows"]
            if len(rows)<MIN_SEGMENT:
                discarded_short+=len(rows)
                continue
            a=np.asarray(rows,dtype=np.float64)
            output.append({"id":mode+"/"+role+"/segment"+str(i+1),
              "u":a[:,5:7],"y":a[:,1:5],
              "sourceRows":[seg["startRow"],seg["endRow"]],
              "timeSpanNative":[float(a[0,0]),float(a[-1,0])]})
        require(output,"original "+mode+"/"+role+" has no 128-point contiguous physical observations")
        # Fail rather than silently accepting a different apparatus time axis.
        # Time gap segments are disclosed, never stitched or filled.
        median=float(np.median(ts_observed)) if ts_observed else None
        require(median is not None and abs(median-SAMPLE_SECONDS)<=0.005,
                "original observed time step differs from author reported 0.1s: "+str(median))
        metadata={"mode":mode,"role":role,"originalWorkbook":name,
          "workbookSha256":digest(source_bytes),"workbookBytes":len(source_bytes),
          "sourceSheet":sheet,"headers":[str(v) if v is not None else None for v in headers[:7]],
          "headerDiscardedRows":1,"originalRowsFollowingHeader":original_rows,
          "nonfiniteOrMissingRows":invalid_rows,"timeDiscontinuities":time_breaks,
          "discardedShortSegmentRows":discarded_short,
          "keptContiguousSegments":len(output),
          "keptRows":sum(len(s["u"]) for s in output),
          "medianOriginalTimeIntervalSeconds":median,
          "segmentCatalog":[{"id":s["id"],"rows":len(s["u"]),
              "sourceRows":s["sourceRows"],
              "timeSpanNative":s["timeSpanNative"]} for s in output]}
        return output,metadata
    finally:
        wb.close()

def split_chronological(segments):
    require(len(segments)>0,"no original training source segments")
    n=sum(len(s["u"]) for s in segments)
    cutoff=int(PERCENT_TRAIN*n)
    require(cutoff>=MIN_SEGMENT and n-cutoff>=MIN_SEGMENT,
            "source original train too small to freeze chronological 70/30")
    first=[]
    later=[]
    consumed=0
    boundaries=[]
    for s in segments:
        length=len(s["u"])
        left=max(0,min(length,cutoff-consumed))
        for start,end,target,label in ((0,left,first,"train"),(left,length,later,"development")):
            if end-start>=MIN_SEGMENT:
                item={"id":s["id"]+"/"+label,"u":s["u"][start:end].copy(),
                      "y":s["y"][start:end].copy()}
                target.append(item)
                boundaries.append({"source":s["id"],"role":label,
                  "withinSegment":[int(start),int(end)],"kept":end-start})
            elif end-start>0:
                boundaries.append({"source":s["id"],"role":label,
                  "withinSegment":[int(start),int(end)],"droppedShort":end-start})
        consumed+=length
    require(first and later,"original source chronological train/dev unusable")
    return first,later,{"policy":"first 70% chronological per original mode Training workbook, last 30% development; no row interleaving",
      "originalValidRows":n,"originalCutoff":cutoff,
      "trainRows":sum(len(s["u"]) for s in first),
      "devRows":sum(len(s["u"]) for s in later),"sourceBoundaries":boundaries}

def remove_meta_segments(items):
    return [{"id":s["id"],"u":s["u"],"y":s["y"]} for s in items]

def safe_run(model,segments,norm,**kw):
    if model is None:return {"error":"registered family had no finite fitted candidate"}
    try:
        return hyd.score_model(model,remove_meta_segments(segments),norm,**kw)
    except Exception as exc:
        return {"error":str(exc)}
def scalar(result):
    if result is None:return None
    v=result.get("macroNormalizedRmse")
    return v if v is not None and math.isfinite(v) else None

def fit_original(source_path,destination):
    started=time.perf_counter()
    z,source=authenticate(source_path)
    source_roles={}
    frozen={}
    for mode in ("4T-M1","4T-M2"):
        data,meta=load_workbook_segments(z,mode,"train")
        fit,dev,split=split_chronological(data)
        selected=hyd.fit_select_original(fit,dev)
        # Sham is independently frozen from training only, BEFORE Test access.
        sham=None
        arx=selected["selected"].get("arx")
        if arx is not None:
            shifted=[{"id":s["id"],"u":s["u"],
              "y":np.roll(s["y"],37,axis=0)} for s in fit]
            try:
                sham=hyd.fit_data_model(shifted,arx["order"],arx["ridge"],"arx")
            except Exception as exc:
                sham={"trainingFailure":str(exc)}
        frozen[mode]={"selected":selected["selected"],
             "sourceTrainMetadata":meta,"split":split,
             "trainScale":selected["trainingNormalization"],
             "referenceType":selected["referenceType"],
             "referenceDevScore":selected["referenceDevelopmentScore"],
             "physicalStatus":selected["physicalStatus"],
             "allCandidates":selected["candidates"],
             "frozenTrainLabelShift37Sham":sham}
        source_roles[mode]={"train":meta["workbookSha256"],
             "test":"DO NOT OPEN TEST XLSX DURING FIT; exact full ZIP SHA pins test bytes"}
    model={"schema":SCHEMA,"source":source,
       "sourceRoles":source_roles,"codeSha256":hash_code(),
       "prospective":{"task":"t-mwn7gi0jrr9e",
         "preregistrationTaskPost":156855,
         "preregistrationRepoDocument":"docs/INTASET_QUADRUPLE_PREREG.md",
         "sourceOnlyActions":[44477228204,44477527045],
         "sensorChannels":["Tank1","Tank2","Tank3","Tank4"],
         "commandChannels":["Pump1","Pump2"],
         "allowedInitialTestSensorSamples":hyd.PREFIX,
         "primary":"entire original Test workbook autonomous 4-sensor macro NRMSE using target MODE training std",
         "crossModes":["M1-fit->M2-original-test","M2-fit->M1-original-test"],
         "noTestNumericReadInFit":True},
       "frozen":frozen,
       "fitRuntime":{"wallSeconds":time.perf_counter()-started,
           "python":sys.version.split()[0],
           "numpy":np.__version__},
       "interpretation":"Observed 4 tank sensors and 2 pump commands on ONE source rig, pseudo-sensor units; author mode transfer not a new apparatus or randomized intervention."}
    payload=safe_json(model)
    out=Path(destination)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_bytes(payload)
    summary={"mode":"ORIGINAL_TRAIN_ONLY_FROZEN","sourceZipSha":SOURCE_SHA,
      "frozenSha256":digest(payload),"output":str(out),
      "selected":{mode:{"strongReference":frozen[mode]["referenceType"],
      "developmentScore":frozen[mode]["referenceDevScore"],
      "physicalStatus":frozen[mode]["physicalStatus"],
      "trainRows":frozen[mode]["split"]["trainRows"],
      "devRows":frozen[mode]["split"]["devRows"],
      "candidates":len(frozen[mode]["allCandidates"])} for mode in frozen},
      "wallSeconds":model["fitRuntime"]["wallSeconds"]}
    print(json.dumps(summary,sort_keys=True))

def run_control(model,segments,norm,method):
    params={
       "pumpShift97":{"shift":97},
       "zeroPumps":{"zero_input":True},
       "swapTank1Tank2":{"swap_tank12":True}
    }
    return safe_run(model,segments,norm,**params[method])
def assess(frozen,results,controls):
    checks=[]
    within_improve={}
    transfer_factors={}
    for mode in ("4T-M1","4T-M2"):
        within=results[mode][mode]
        b=scalar(within.get("best_reference"))
        p=scalar(within.get("physical"))
        improvement=1-p/b if b and p is not None else None
        within_improve[mode]=improvement
        checks.append({"name":"within-mode physical >=10% better "+mode,
                       "passed":improvement is not None and improvement>=.10})
        if improvement is not None and b is not None:
            for method in ("pumpShift97","zeroPumps"):
                q=scalar(controls[mode]["physical"].get(method))
                checks.append({"name":"physical input negative worsens "+mode+" "+method,
                               "passed":q is not None and q>p})
    for source_mode,target_mode in (("4T-M1","4T-M2"),("4T-M2","4T-M1")):
        transf=results[source_mode][target_mode]
        b=scalar(transf.get("best_reference"))
        p=scalar(transf.get("physical"))
        factor=p/b if b and p is not None else None
        transfer_factors[source_mode+"->"+target_mode]=factor
        checks.append({"name":"frozen physical transfer <=1.5x matched ARX/NARX "
                        +source_mode+"->"+target_mode,
                       "passed":factor is not None and factor<=1.5})
    return {"qualifiedPhysicalTransfer":all(x["passed"] for x in checks),
            "checks":checks,"withinModeRelativeImprovement":within_improve,
            "crossModeRelativeFactor":transfer_factors,
            "criterion":">=10% better original within-test macro NRMSE than the *development-selected* stronger ARX/NARX in BOTH real modes, cross-config error <=1.5x SAME source-model reference cross-test, pump-shift+zero controls worsen; all before Test opened.",
            "limitations":"One physical rig, uncalibrated per-tank native sensor units, variant M1/M2 plumbing and pump split unknown, no independent hardware validation or causal coefficient identification."}

def evaluate_original(source_path,frozen_path,receipt_path):
    started=time.perf_counter()
    frozen_bytes=Path(frozen_path).read_bytes()
    model=json.loads(frozen_bytes)
    require(model.get("schema")==SCHEMA and
            model.get("prospective",{}).get("noTestNumericReadInFit") is True,
            "valid frozen original source-only model required")
    require(model.get("codeSha256")==hash_code(),
            "original model or receiver code changed after fitting; refuse receiving")
    z,source=authenticate(source_path)
    require(source==model.get("source"),
            "original source changed since frozen original training")
    # Critically no original Test workbook has been materialized/decoded above.
    # First Test numerical read is after checking source, full candidate
    # coefficients, roles, execution code, source ZIP SHA and frozen document.
    targets={}
    source_test_meta={}
    for mode in ("4T-M1","4T-M2"):
        source_test,meta=load_workbook_segments(z,mode,"test")
        targets[mode]=source_test
        source_test_meta[mode]=meta
    results={}
    controls={}
    for fitted_mode in ("4T-M1","4T-M2"):
        models=model["frozen"][fitted_mode]["selected"]
        results[fitted_mode]={}
        controls[fitted_mode]={}
        for target_mode in ("4T-M1","4T-M2"):
            target_scale=model["frozen"][target_mode]["trainScale"]
            tests=targets[target_mode]
            values={}
            for family in ("persistence","arx","narx","best_reference","physical"):
                selected=({"family":"persistence"} if family=="persistence"
                          else models.get(family))
                values[family]=safe_run(selected,tests,target_scale)
            results[fitted_mode][target_mode]=values
        # Negative controls are performed only on each source's within-mode
        # Test after all candidate selection is already frozen.
        reference=model["frozen"][fitted_mode]["referenceType"]
        sham=model["frozen"][fitted_mode].get("frozenTrainLabelShift37Sham")
        norm=model["frozen"][fitted_mode]["trainScale"]
        tests=targets[fitted_mode]
        for family in ("best_reference","physical"):
            m=models.get(family)
            controls[fitted_mode][family]={
              key:run_control(m,tests,norm,key)
              for key in ("pumpShift97","zeroPumps","swapTank1Tank2")}
        controls[fitted_mode]["shift37TrainLabelsArx"]=(
          safe_run(sham,tests,norm) if isinstance(sham,dict)
          and "family" in sham else {"error":sham.get("trainingFailure","not fit")
            if isinstance(sham,dict) else "ARX unavailable"} )
    verdict=assess(model,results,controls)
    report={"schema":"worldlaw.original-intaset-four-tank-receiving/v1",
      "source":source,"frozenModelSha256":digest(frozen_bytes),
      "trainingAndRegistration":{"task":model["prospective"]["task"],
         "preregistrationTaskPost":model["prospective"]["preregistrationTaskPost"],
         "preNumericSourceOnlyProof":model["prospective"]["sourceOnlyActions"],
         "fourTankFrozenModels":model["frozen"],
         "sourceRoles":model["sourceRoles"]},
      "originalTestMetadata":source_test_meta,
      "originalFourReceiverScenarios":results,
      "originalWithinModeNegativeControls":controls,
      "physicalTransferProspectiveGate":verdict,
      "runtime":{"evaluateWallSeconds":time.perf_counter()-started,
        "python":sys.version.split()[0],"numpy":np.__version__},
      "conclusionBoundary":"Original multi-sensor source on same apparatus, independent mode files, test outputs beyond first64 forbidden in prediction. Negative physical transfer is a valid source-authentic result, not evidence to retune models. No SI calibration or independent replicated hardware."}
    payload=safe_json(report)
    out=Path(receipt_path)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_bytes(payload)
    print(json.dumps({"mode":"ORIGINAL_TEST_RECEIVED","sourceSha":SOURCE_SHA,
      "frozenSha256":digest(frozen_bytes),"receiptSha256":digest(payload),
      "report":str(out),"originalSourceRows":{m:source_test_meta[m]["keptRows"] for m in targets},
      "primary":{origin:{target:{family:scalar(values.get(family))
                  for family in ("best_reference","physical","persistence")}
                  for target,values in target_dict.items()}
                  for origin,target_dict in results.items()},
      "gate":verdict,"seconds":report["runtime"]["evaluateWallSeconds"]},sort_keys=True))

def main(argv):
    require(len(argv) in (4,5),
       "usage: fit original.zip frozen.json | evaluate original.zip frozen.json receipt.json")
    if argv[1]=="fit" and len(argv)==4:fit_original(argv[2],argv[3])
    elif argv[1]=="evaluate" and len(argv)==5:
        evaluate_original(argv[2],argv[3],argv[4])
    else:raise ValueError("unknown original source phase")
if __name__=="__main__":
    try:main(sys.argv)
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
