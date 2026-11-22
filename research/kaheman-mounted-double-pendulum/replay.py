"""Check the published results, optionally recomputing from the original four records."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

HERE=Path(__file__).resolve().parent
RECORDS=("1","2","4")
BASELINES=("author","viscous","quadratic")
METHODS=(*BASELINES,"coulomb")
def average(rows):
    return sum(rows)/len(rows)

def checksum(b):
    return hashlib.sha256(b).hexdigest()

def validate(evidence):
    run=evidence["result"]
    fixed=evidence["record"]
    assert set(fixed)==set(RECORDS)
    assert run["rows"]=={"1":170834,"2":182529,"4":208921}
    assert set(run["guards"])=={"mean","each","energy","velocity","step"}
    for i,row in fixed.items():
        modes={f"{name}-{kind}-{n}" for name in METHODS for kind in ("restart","full") for n in ((1,2) if name in ("author","coulomb") else (1,))}
        assert set(row)==modes
        for s in row.values():
            blocks=s["blocks"]
            expected=(run["rows"][i]+2666)//2667
            assert len(blocks)==expected
            widths=[min(2667,run["rows"][i]-2667*j) for j in range(expected)]
            for k in range(3):
                rebuilt=math.sqrt(sum(n*b[k]**2 for n,b in zip(widths,blocks))/sum(widths))
                assert math.isclose(rebuilt,s["metric"][k],rel_tol=3e-12,abs_tol=3e-14)
            assert len(s["worst"]["prediction"])==len(s["worst"]["observation"])==4
    def agg(name,kind,col):
        return average([fixed[i][name+"-"+kind+"-1"]["metric"][col] for i in RECORDS])
    def best(kind,col):
        return min(agg(x,kind,col) for x in BASELINES)
    for kind in ("full","restart"):
        for name in METHODS:
            for k in range(3):
                assert math.isclose(agg(name,kind,k),run["mean_"+kind][name][k],rel_tol=2e-12)
    assert math.isclose(best("restart",0),run["best"],rel_tol=2e-12)
    assert math.isclose(agg("coulomb","restart",0),run["primary"],rel_tol=2e-12)
    gates=dict(mean=run["primary"]<=.95*run["best"],
               each=all(fixed[i]["coulomb-restart-1"]["metric"][0]<=min(fixed[i][m+"-restart-1"]["metric"][0] for m in BASELINES) for i in RECORDS),
               velocity=agg("coulomb","restart",1)<=1.05*best("restart",1),
               energy=agg("coulomb","full",2)<=1.05*best("full",2),
               step=all(abs(fixed[i][m+"-restart-1"]["metric"][0]-fixed[i][m+"-restart-2"]["metric"][0])<=.002 for i in RECORDS for m in ("author","coulomb")))
    assert gates==run["guards"] and all(gates.values())==run["success"]
    assert not run["success"]
    print("Records",run["rows"],"primary",run["primary"],"best",run["best"],"gates",gates)

def physical(evidence,work):
    from range_reader import RangeFile
    for k in ("physical.py","range_reader.py","protocol.txt","mounted.c","exact_mounted.py"):
        shutil.copyfile(HERE/k,work/k)
    with urllib.request.urlopen("https://zenodo.org/api/records/6633719",timeout=60) as h:
        record=json.load(h)
    member=next(x for x in record["files"] if x["key"]=="MultiArm-Pendulum.zip")
    assert member["checksum"]=="md5:b7ef285267d3ebb7f31370ad1df55b99"
    prefix="ParameterEstimation/DoublePendulum/"
    with zipfile.ZipFile(RangeFile(member["links"]["self"],member["size"])) as arc:
        data={}
        for name in ("DoublePendulumODE_Mounted.m","DoublePendulumSymbolicCalculation.m"):
            b=arc.read(prefix+name);data[prefix+name]={"source":b.decode(),"sha":checksum(b)}
        (work/"code-and-schema.json").write_text(json.dumps({"author_scripts":data}))
        b=arc.read(prefix+"EstimatedParameters_DoublePendulum.mat")
        assert checksum(b)==evidence["calibration"]["parameter_sha"]
        (work/"published-parameters.mat").write_bytes(b)
    subprocess.run([sys.executable,"physical.py"],check=True,cwd=work)
    actual=json.loads((work/"result.json").read_text())
    assert actual["rows"]==evidence["result"]["rows"] and actual["guards"]==evidence["result"]["guards"]
    for i in RECORDS:
        new=json.loads((work/("record-"+i)/"metrics.json").read_text())
        ref=evidence["record"][i]
        assert set(new)==set(ref)
        for key,row in new.items():
            for measured,frozen in zip(row["metric"],ref[key]["metric"]):
                assert math.isclose(measured,frozen,rel_tol=1e-8,abs_tol=1e-10)
            for calc,old in zip(row["blocks"],ref[key]["blocks"]):
                assert all(math.isclose(v,w,rel_tol=1e-7,abs_tol=1e-9) for v,w in zip(calc,old))
    print("Physical replay verified all 36 output streams and their fixed-block errors.")

def main():
    p=argparse.ArgumentParser();p.add_argument("--physical",action="store_true")
    arg=p.parse_args()
    evidence=json.loads((HERE/"frozen-results.json").read_text())
    assert checksum((HERE/"protocol.txt").read_bytes())==evidence["calibration"]["protocol"]
    validate(evidence)
    if arg.physical:
        with tempfile.TemporaryDirectory(prefix="kaheman-physical-") as d:
            physical(evidence,Path(d))

if __name__=="__main__":
    main()
