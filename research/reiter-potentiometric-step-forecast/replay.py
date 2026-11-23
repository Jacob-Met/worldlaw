"""Replay the complete A1/A2 finite-time course from the original OSF measurement ZIP."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from baselines import fit_forecasts,matched_stage_correction
from extract import decode
from independent import receive
from modal_forecast import control
from finite_horizon import check as check_examples


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("measurement_zip",type=Path)
    args=parser.parse_args()
    package=Path(__file__).resolve().parent
    expected=json.loads((package/"observed.json").read_text())
    assert args.measurement_zip.stat().st_size==expected["source_bytes"]
    with args.measurement_zip.open("rb") as f:
        assert hashlib.file_digest(f,"sha256").hexdigest()==expected["source_sha256"]
    train,tf=decode(args.measurement_zip,"train",True)
    dev,df=decode(args.measurement_zip,"development",True)
    assert (len(train),len(dev))==(199,80) and tf==expected["train_exclusions"] and df==expected["dev_exclusions"]
    ref=fit_forecasts(train,dev)
    for p,q in zip(ref,matched_stage_correction(train,dev)):p["matched_stage"]=q
    diffs={method:[] for method in ref[0]}
    for row,p,locked in zip(dev,ref,expected["development"]):
        assert [row[k] for k in ("cell","soc","approach","ordinal")]==locked["key"]
        assert row["bin_counts"]==locked["prefix_minute_counts"] and abs(row["endpoint_mV"]-locked["endpoint_mV"])<1e-9
        for method,error in diffs.items():error.append(abs(p[method]-locked["reference_predictions"][method]))
    maximum={k:max(vals) for k,vals in diffs.items()}
    assert max(maximum.values())<2e-7,maximum
    assert control()
    check_examples()
    out=receive({"train":train,"development":dev,"predictions":ref,"dev_fail":df},expected["modal"])
    print(json.dumps({"source_archive_sha256":expected["source_sha256"],"training_stages":len(train),"development_stages":len(dev),
                      "max_control_prediction_change_mV":maximum,"independent":out},sort_keys=True))


if __name__=="__main__":
    main()
