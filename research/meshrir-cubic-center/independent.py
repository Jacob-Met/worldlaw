"""Independent check from raw little-endian NPY samples and a 128-phase direct DFT."""
import argparse
import ast
import cmath
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import sys
from array import array
import zipfile

MULTIPLIERS=(1,2,4,6,8,10,12)
FREQUENCIES=(375,750,1500,2250,3000,3750,4500)
ARM_NAMES=("direction_minimax","radial_mean","author_isotropic","author_directional",
           "empirical_shell_ridge","empirical_26_ridge","equal_26","zero")

def read_signal(raw):
    f=io.BytesIO(raw)
    assert f.read(6)==b"\x93NUMPY"
    major,_=f.read(2)
    fmt="<H" if major==1 else "<I"
    header=ast.literal_eval(f.read(struct.unpack(fmt,f.read(struct.calcsize(fmt)))[0]).decode("latin1"))
    assert header["shape"]==(1,32768) and header["descr"] in ("<f4","<f8")
    a=array("d" if header["descr"]=="<f8" else "f")
    a.frombytes(f.read())
    if sys.byteorder!="little":a.byteswap()
    assert len(a)==32768
    folded=[math.fsum(a[n::128]) for n in range(128)]
    return [complex(math.fsum(v*math.cos(2*math.pi*k*n/128) for n,v in enumerate(folded)),
                    -math.fsum(v*math.sin(2*math.pi*k*n/128) for n,v in enumerate(folded))) for k in MULTIPLIERS]

def compare(archive,bankfile,scorefile):
    with open(archive,"rb") as f:
        s=hashlib.sha256()
        while block:=f.read(2**20):s.update(block)
        assert s.hexdigest()=="8f25e09401b3592b682bebbbb0ef093aea2a82b8156327dc05d5c49e2e56aa57"
    bank=json.loads(Path(bankfile).read_bytes()); scored=json.loads(Path(scorefile).read_bytes())
    assert hashlib.sha256(Path(bankfile).read_bytes()).hexdigest()==scored["bank_sha256"]
    assert bank["arms"]==list(ARM_NAMES) and bank["frequencies"]==list(FREQUENCIES)
    error=[]; metrics=[]; global_values={}
    with zipfile.ZipFile(archive) as z:
        meta=json.loads(z.read("S1-M3969_npy/data.json"))
        centers=[]
        for idx in range(3969):
            pos=meta["ir_"+str(idx)]["pos"]
            xyz=tuple(round((float(pos[key])+r)/.05) for key,r in zip(("x","y","z"),(.5,.5,.2)))
            if all(i%3==1 for i in xyz) and xyz[2] in (1,7):
                centers.append((xyz,idx))
        centers.sort()
        assert [idx for xyz,idx in centers]==bank["held_member_ids"] and len(centers)==98
        members={int(Path(x).stem.split("_")[-1]):x for x in z.namelist()
                 if "__MACOSX" not in x.split("/") and Path(x).stem.startswith("ir_") and x.endswith(".npy")}
        signal=[read_signal(z.read(members[idx])) for _,idx in centers]
    for i,row in enumerate(signal):
        for j,v in enumerate(row):
            error.append(abs(v-complex(*scored["held"][i][j])))
    for arm in ARM_NAMES:
        pred=[[complex(*v) for v in row] for row in bank["forecasts"][arm]]
        worst=max(range(98*7),key=lambda ij: abs(pred[ij//7][ij%7]-signal[ij//7][ij%7]))
        wi,wj=divmod(worst,7)
        witness=scored["witnesses"][arm]
        assert witness["id"]==centers[wi][1] and FREQUENCIES[wj]==witness["hz"]
        for v,target in ((signal[wi][wj],witness["response"]),(pred[wi][wj],witness["prediction"]),
                         (pred[wi][wj]-signal[wi][wj],witness["residual"])):
            error.append(abs(v-complex(*target)))
        for name in ("all","lower","upper"):
            ids=[i for i,(xyz,_) in enumerate(centers) if name=="all" or xyz[2]==(1 if name=="lower" else 7)]
            nrm=[math.sqrt(math.fsum(abs(pred[i][j]-signal[i][j])**2 for i in ids) /
                           math.fsum(abs(signal[i][j])**2 for i in ids)) for j in range(7)]
            a=scored["metrics"][arm][name]
            metrics.extend(abs(x-y) for x,y in zip(nrm,a["per_frequency"]))
            metrics.extend((abs(sum(nrm)/7-a["mean"]),abs(max(nrm)-a["worst_frequency"])))
            if name=="all":global_values[arm]=(sum(nrm)/7,max(nrm))
    gates={title:{arm:global_values[ARM_NAMES[0]][j]<global_values[arm][j] for arm in ARM_NAMES[1:]}
           for j,title in enumerate(("mean","worst_frequency"))}
    assert gates==scored["gates"] and all(v for g in gates.values() for v in g.values())==scored["joint"]
    assert max(error)<1e-9 and max(metrics)<1e-9
    print("RECOUNT",len(error),"complex comparisons including all686 held coefficients and8 raw worst cases;",
          len(metrics),"metric comparisons across24 slices; 14 gates; max absolute discrepancies",max(error),max(metrics),gates)

if __name__=="__main__":
    compare(*sys.argv[1:])
