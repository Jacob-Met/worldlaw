"""Recount every retained error by physical material, coordinate, and wavelength."""
import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np


def close(a,b):
    if not math.isclose(a,b,rel_tol=2e-12,abs_tol=2e-13):
        raise ValueError((a,b))


def compare(root, phase):
    path=root/(phase+".json")
    parsed=json.loads(path.read_text())
    tables={}
    raw_worst={}
    counts={"sources":0,"rows":0,"target_present":0,"target_absent":0,"errors":0}
    with np.load(root/(phase+"-predictions.npz")) as pred:
        for key,meta in parsed["materials"].items():
            folder=root/key;receipt=json.loads((folder/"source-receipt.json").read_text())
            for fname,sha in [("linear.npz",receipt["linear_sha256"]),("circular.npz",receipt["circular_sha256"])]:
                if hashlib.sha256((folder/fname).read_bytes()).hexdigest()!=sha:
                    raise ValueError("wrong source projection")
            with np.load(folder/"linear.npz") as f:
                A=f["a"];xyz=f["geometry"]
            with np.load(folder/"circular.npz") as f:
                V=f["vv"]
            assert len(A)==len(V)==len(xyz)==3840
            counts["sources"]+=1;counts["rows"]+=len(A)
            valid=np.isfinite(V)
            counts["target_present"]+=int(valid.sum());counts["target_absent"]+=int((~valid).sum())
            rfull=np.where(np.isfinite(A[:,0,0]),np.abs(A[:,0,0].astype(float)),0.)
            denom=math.fsum(rfull[valid])
            table={}
            for arm,expected in meta["errors"].items():
                out=pred[key+"-"+arm]
                dif=np.abs(out[valid]-V[valid].astype(float))
                table[arm]=math.fsum(dif)/denom
                close(table[arm],expected)
                counts["errors"]+=len(dif)
            tables[key]=table
            # Per-wavelength values preserve all five observation panels separately.
            wavelength={}
            for j,w in enumerate((450,500,550,600,650)):
                active=valid&(xyz[:,3]==j);den=math.fsum(rfull[active])
                wavelength[w]={a:(math.fsum(abs(pred[key+"-"+a][active]-V[active]))/den if den>0 else None) for a in table}
            raw=np.zeros(len(V));raw[valid]=abs(pred[key+"-candidate"][valid]-V[valid])
            j=int(np.argmax(np.where(valid,raw,-np.inf)))
            assert list(map(int,xyz[j]))==meta["worst"]["index"]
            close(float(V[j]),meta["worst"]["measured_VV"])
            for arm in table:
                close(float(pred[key+"-"+arm][j]),meta["worst"]["predictions"][arm])
            raw_worst[key]={**meta["worst"],"source_linear_block":[
                [float(v) if np.isfinite(v) else None for v in row] for row in A[j]]}
            meta["independent_by_wavelength"]=wavelength
    for arm,old in parsed["overall"].items():
        vals=[s[arm] for s in tables.values()]
        close(math.fsum(vals)/len(vals),old["mean"]);close(max(vals),old["worst"])
    controls=set(parsed["overall"])-{"candidate"}
    expected_gates={}
    for metric,measure in (("mean",lambda v:math.fsum(v)/len(v)),("worst",max)):
        scores={a:measure([v[a] for v in tables.values()]) for a in parsed["overall"]}
        expected_gates[metric]=all(scores["candidate"]<scores[a] for a in controls)
    if expected_gates!=parsed["gates"] or all(expected_gates.values())!=parsed["primary_joint"]:
        raise ValueError("independent admission verdict disagrees")
    result={"counts":counts,"gates":expected_gates,"raw_worst_by_material":raw_worst,"by_material_wavelength":{k:v["independent_by_wavelength"] for k,v in parsed["materials"].items()},
            "worst":max(((abs(v["worst"]["predictions"]["candidate"]-v["worst"]["measured_VV"]),k,raw_worst[k])
                         for k,v in parsed["materials"].items()),key=lambda z:z[0]),"primary_joint":parsed["primary_joint"]}
    (root/(phase+"-independent.json")).write_text(json.dumps(result,sort_keys=True,allow_nan=False)+"\n")
    return result


if __name__=="__main__":
    out=compare(Path(sys.argv[1]),sys.argv[2]);print(json.dumps({k:v for k,v in out.items() if k not in ("by_material_wavelength","raw_worst_by_material")}))
