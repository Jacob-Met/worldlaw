"""Replay NIST input projection, locked normal-force forecasts, and independent raw-cell recount."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np

import freeze_predictions
import independent_recount
import mode_witness
import project_input
import score_course


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def receive(root):
    root.mkdir(parents=True,exist_ok=True)
    for m,n in [(2490,143),(2491,147)]:
        p=root/f"{m}-primary.pdf"
        if not p.exists():
            url=f"https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication260-{n}.pdf"
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"NIST-rheology-replay"}),timeout=60) as r:
                b=r.read(12_000_000)
            if hashlib.sha256(b).hexdigest()!=project_input.DIGEST[m]:
                raise ValueError("primary source hash differs")
            p.write_bytes(b)
        if digest(p)!=project_input.DIGEST[m]:
            raise ValueError(f"unexpected bytes in {p}")


def check_numeric(a,b):
    if isinstance(a,dict):
        assert set(a)==set(b)
        for k in a:
            check_numeric(a[k],b[k])
    elif isinstance(a,(list,np.ndarray)):
        assert len(a)==len(b)
        for x,y in zip(a,b):
            check_numeric(x,y)
    elif isinstance(a,(float,np.floating)):
        assert np.isclose(a,b,rtol=1e-8,atol=1e-7),(a,b)
    else:
        assert a==b,(a,b)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir",type=Path,help="Cache the two hash-checked primary NIST PDFs here.")
    args=parser.parse_args()
    here=Path(__file__).resolve().parent
    fp=here/"frozen-predictions.json";ob=here/"observed.json"
    assert digest(fp)=="79f8b00d5fe394b318c368ffe26d381f739a8b160b7a5065590792509934dc66"
    assert digest(ob)=="8fa135cd2f12981a63da419d16e14ef0b49c3e2290f3819afa9ac110135b7080"
    receive(args.source_dir)
    inputs=project_input.project(args.source_dir)
    encoded=(json.dumps(inputs,separators=(",",":"))+"\n").encode()
    assert hashlib.sha256(encoded).hexdigest()=="006407dab8fbd78626aa977331722e2cf06b2fa5554287b7764f9ebda23bf267"
    present=freeze_predictions.run(inputs)
    frozen=json.loads(fp.read_bytes())
    check_numeric(present,frozen)
    # Open observed axial columns only after complete input-only numeric agreement.
    obtained=score_course.score(frozen,args.source_dir);record=json.loads(ob.read_bytes())
    check_numeric(obtained,record)
    check_numeric(mode_witness.witness(inputs,frozen),json.loads((here/"mode-receipt.json").read_bytes()))
    counts=independent_recount.check(args.source_dir,frozen,obtained)
    print(json.dumps({"recount":counts,"overall":obtained["overall"],
                      "point_gates":obtained["point_gates"],"interval_gates":obtained["interval_gates"]},sort_keys=True))


if __name__=="__main__":
    main()
