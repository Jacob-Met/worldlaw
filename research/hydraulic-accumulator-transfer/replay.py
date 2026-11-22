"""Reproduce the source-locked 115-bar pressure and transit experiment."""
import argparse
from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

import numpy as np

import models

URL="https://zenodo.org/records/1323611/files/data.zip?download=1"
SOURCE="24128aad2ee45eea7e6b63ebbd9992cdf25d0483a2cebefbfc13bc69079af1f2"
ARM_NAMES={
    "source_volume_lower_anchor","lower_anchor_only","source_affine","source_pchip",
    "source_quadratic","conditional_kernel","gas_coordinate_interpolation",
}


def unseen(condition):
    cooler,valve,leak=map(int,condition[:3])
    return ([3,20,100].index(cooler)+[73,80,90,100].index(valve)+leak)%3==0


def read_rows(archive,member,mask):
    rows=[]
    with archive.open(member) as source:
        for i,line in enumerate(source):
            if mask[i]:
                head=line.split(b"\t",151)[:151]
                if len(head)!=151:
                    raise ValueError(f"Incomplete charging record {i}")
                rows.append([float(item) for item in head])
        if i+1!=len(mask):
            raise ValueError("Row alignment differs from the condition profile")
    return np.asarray(rows)


def run(packet,details=False):
    if hashlib.sha256(packet).hexdigest()!=SOURCE:
        raise ValueError("Organizer archive checksum differs")
    with zipfile.ZipFile(io.BytesIO(packet)) as archive:
        files={p.rsplit("/",1)[-1]:p for p in archive.namelist()}
        profile=np.loadtxt(io.BytesIO(archive.read(files["profile.txt"])),dtype=int)
        train=np.array([r[3]!=115 and not unseen(r) for r in profile])
        target=profile[:,3]==115
        if (len(profile),int(train.sum()),int(target.sum()))!=(2205,1207,399):
            raise ValueError("Registered cohort counts differ")
        # Pass one projects the known development pressure settings only.
        dev=read_rows(archive,files["PS1.txt"],train)
        m=profile[train]
        cells=np.array([(c,v,l) for c in (3,20,100) for v in (73,80,90,100) for l in (0,1,2)])
        scalar=models.predict_transit(dev,m,cells,(90,100,130),115)
        wave=models.predictions(dev,m,cells,models.KERNEL)
        wave.update(models.arms(dev,m,cells,115,models.KERNEL))
        if set(scalar)!=ARM_NAMES or len(wave)!=10:
            raise ValueError("Frozen model roster differs")
        # A second pass consumes only the registered window in all 399 target rows.
        y=read_rows(archive,files["PS1.txt"],target)
    idx=np.flatnonzero(target)
    metadata=profile[target]
    results,status=models.scores(scalar,cells,y,metadata,idx)
    truth,_=models.spans(y)
    trajectory={}
    for name,forecast in wave.items():
        cell_errors=[]
        worst=(-1,None)
        for cell,pred in zip(cells,forecast):
            take=np.flatnonzero(np.all(metadata[:,:3]==cell,axis=1))
            error=pred-y[take]
            i,t=np.unravel_index(np.argmax(abs(error)),error.shape)
            if abs(error[i,t])>worst[0]:
                worst=(abs(error[i,t]),dict(row=int(idx[take[i]]),sample=int(t),
                       signed_error=float(error[i,t]),truth=float(y[take[i],t]),pred=float(pred[t]),
                       condition=metadata[take[i]].tolist()))
            cell_errors.append(float(np.sqrt(np.mean(error**2))))
        stats={}
        for group in ("all","matched","novel"):
            subset=[e for e,c in zip(cell_errors,cells) if group=="all" or unseen(c)==(group=="novel")]
            stats[group]=[float(np.mean(subset)),max(subset)]
        trajectory[name]={"groups":stats,"worst":worst[1]}
    anchor=scalar["lower_anchor_only"]
    delta=[float(truth[np.all(metadata[:,:3]==c,axis=1)].mean()-a) for c,a in zip(cells,anchor) if not unseen(c)]
    current=results["source_volume_lower_anchor"]
    others=[v for k,v in results.items() if k!="source_volume_lower_anchor"]
    def wins(group,metric):
        return current["groups"][group][metric]<min(v["groups"][group][metric] for v in others)
    gates={"matched_mean_beats_all":wins("matched","mean_abs_cell_bias"),
           "matched_mean_within_10ms":current["groups"]["matched"]["mean_abs_cell_bias"]<=.010,
           "all24_observed_mean_contrasts_positive":min(delta)>0,
           "novel_mean_beats_all":wins("novel","mean_abs_cell_bias"),
           "all36_worst_beats_all":wins("all","worst_abs_cell_bias")}
    output={"archive_sha256":SOURCE,"development_cycles":len(dev),"target_cycles":len(y),
            "time_samples_per_cycle":y.shape[1],"censor_counts":dict(Counter("/".join(s) for s in status)),
            "matched24_observed_deltas_s":delta,"registered_gates":gates,
            "scoped_matched_pass":all(list(gates.values())[:3]),"broad_transfer_pass":all(gates.values()),
            "scalar_groups":{k:v["groups"] for k,v in results.items()},"waveform":trajectory}
    if details:
        output["scalar_cells"]={k:v["cells"] for k,v in results.items()}
    return output


def compare(actual,expected,path="result"):
    if isinstance(expected,dict):
        if set(actual)!=set(expected):
            raise ValueError(path+" fields differ")
        for k,v in expected.items():
            compare(actual[k],v,path+"."+k)
    elif isinstance(expected,list):
        if len(actual)!=len(expected):
            raise ValueError(path+" length differs")
        for i,(a,b) in enumerate(zip(actual,expected)):
            compare(a,b,path+"["+str(i)+"]")
    elif isinstance(expected,float):
        if not np.isclose(actual,expected,atol=1e-8,rtol=1e-9):
            raise ValueError(f"{path}: {actual} differs from {expected}")
    elif actual!=expected:
        raise ValueError(f"{path}: {actual} differs from {expected}")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive",type=Path,help="Local original data.zip")
    parser.add_argument("--details",action="store_true",help="Include each cell and its worst trial")
    args=parser.parse_args()
    if args.archive:
        packet=args.archive.read_bytes()
    else:
        with urllib.request.urlopen(URL,timeout=180) as f:
            packet=f.read()
    actual=run(packet,args.details)
    frozen=json.loads(Path(__file__).with_name("frozen.json").read_text())
    compare({k:v for k,v in actual.items() if k!="scalar_cells"},frozen)
    print(json.dumps(actual,sort_keys=True,indent=2))


if __name__=="__main__":
    main()
