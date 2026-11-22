"""Project declared CSV columns and preserve every batch and laboratory replicate."""
import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil


def rows(path):
    data=path.read_bytes()
    lines=data.splitlines()
    header=lines[0].decode("utf-8-sig").split(",")
    for line in lines[1:]:
        if not line.strip():
            continue
        fields=line.split(b",")
        if b'"' in line or len(fields)!=len(header):
            raise ValueError("numeric CSV syntax changed")
        yield dict(zip(header,fields))


def number(x):
    return None if x.strip() in (b"",b"nd",b"NaN") else float(x)


def assays(path, active):
    values={i:{"TA":[],"DIC":[]} for i in active}
    for row in rows(path):
        i=int(row["Batch"])
        if i not in active:
            continue
        for out,key in (("TA","meas_TA"),("DIC","meas_DIC")):
            values[i][out].append(number(row[key]))
    result={}
    for i,records in values.items():
        if len(records["TA"])!=4 or len(records["DIC"])!=4:
            raise ValueError(("assay replicate roster",i))
        result[i]={"replicates":records}
        for key,v in records.items():
            present=[x for x in v if x is not None and math.isfinite(x)]
            result[i][key]=math.fsum(present)/len(present) if present else None
    return result


def optics(path,active):
    obs=defaultdict(list)
    allowed=("Practical_Salinity","Temp","meas_pHt","pHt_std_err","PO4","Si")
    for row in rows(path):
        i=int(row["Batch"])
        if i not in active:
            continue
        obs[i].append([number(row[k]) for k in allowed])
    result=[]
    for i in sorted(active):
        rr=obs[i]
        if len(rr)!=9:
            raise ValueError(("optical bath roster",i))
        s,t,h,err,p,si=zip(*rr)
        if any(x is None for x in (*s,*t,*h)) or len(set(s))!=1:
            raise ValueError(("incomplete optical input",i))
        if len(set(p))!=1 or len(set(si))!=1:
            raise ValueError(("inconsistent within-batch nutrient",i))
        result.append({"batch":i,"salinity":s[0],"temp":t,"pH":h,"pH_std_err":err,
                       "PO4":p[0],"Si":si[0]})
    return result


def write(path,value):
    raw=(json.dumps(value,sort_keys=True,allow_nan=False)+"\n").encode()
    with path.open("xb") as f:
        f.write(raw)
    return hashlib.sha256(raw).hexdigest()


def stage(source, target, phase, split_path):
    split=json.loads(split_path.read_bytes())
    reg=json.loads((Path(__file__).parent/"source-registry.json").read_bytes())
    for i in ("905357","905278"):
        if hashlib.sha256((source/(i+".csv")).read_bytes()).hexdigest()!=reg[i]["sha256"]:
            raise ValueError("official source hash mismatch")
    target.mkdir()
    if phase=="forecast":
        a=set(split["calibration"]);both=a|set(split["held"])
        print("OPTICAL",write(target/"optical-inputs.json",optics(source/"905357.csv",both)))
        print("CALIBRATION",write(target/"calibration-assays.json",assays(source/"905278.csv",a)))
        shutil.copyfile(split_path,target/"split.json")
    elif phase=="score":
        print("ALL_ASSAYS",write(target/"all-assays.json",assays(source/"905278.csv",set(split["calibration"])|set(split["held"]))))
    else:
        raise ValueError(phase)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("source",type=Path);p.add_argument("target",type=Path)
    p.add_argument("phase",choices=("forecast","score"));p.add_argument("split",type=Path)
    a=p.parse_args();stage(a.source,a.target,a.phase,a.split)
