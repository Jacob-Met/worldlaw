"""Rebuild all three calibration folds, reconstruct held predictions and repeat the external read."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zlib
import numpy as np
from independent import verify

HERE = Path(__file__).resolve().parent
SOURCES = {
    "index.xlsx": (39797446, "2d9e4e2ee78deed8a5c32ba0f9e07fe0889ee31780b04c850c759829d3a81861"),
    "unsteady.zip": (26677382, "e16a71d2c8b867f71508f6a929849da9c417eba913db5129ed7ebeb4c776434c"),
}
FROZEN = {
    "scored.json": "7a833fc388472f92681ad910ae36a6d4f2264f03ff4b750ae1ec3c1f21cf707b",
    "inputs-and-parameters.json": "a79720e2331057c1f622e4c1e43f3e6b9d88ff91aebd2f68482285fd620fc033",
    "full-worst.npz": "c5d110cb9193f39354e06046b2b82253779d2187910615b12c4e093e89834e25",
}
BANK = "1f98db0d20b03db1965478204faadd47cc95fd249d1c324763c188a464fbd416"

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def replay(work, source_dir, bank_path):
    for name, (num, sha) in SOURCES.items():
        dest = work / name
        if source_dir is not None:
            shutil.copyfile(source_dir / name, dest)
        else:
            req = urllib.request.Request(f"https://ndownloader.figshare.com/files/{num}", headers={"User-Agent": "WORLDLAW reproducibility"})
            with urllib.request.urlopen(req, timeout=90) as src, dest.open("wb") as out:
                shutil.copyfileobj(src, out)
        if digest(dest) != sha:
            raise ValueError(f"Source checksum mismatch for {name}")
    for name, sha in FROZEN.items():
        dest = work / ("original-" + name)
        dest.write_bytes(zlib.decompress((HERE / (name + ".zlib")).read_bytes()))
        if digest(dest) != sha:
            raise ValueError(f"Original checksum mismatch for {name}")
    if bank_path is not None:
        if digest(bank_path) != BANK:
            raise ValueError("Forecast bank checksum mismatch")
        verify(work/"unsteady.zip",bank_path,work/"original-inputs-and-parameters.json",work/"original-scored.json",work/"original-full-worst.npz")
        return
    for name in ("advection.cpp","transport.py","time_model.py","time_train.py","time_score.py"):
        shutil.copyfile(HERE/name,work/name)
    env = dict(os.environ,OPENBLAS_NUM_THREADS="1",OMP_NUM_THREADS="1",PYTHONDONTWRITEBYTECODE="1")
    def run(*args):
        subprocess.run(args, cwd=work, check=True, env=env)
    run("g++","-O3","-std=c++17","-shared","-fPIC","advection.cpp","-o","libtransport.so")
    for prog in (1,2,4):
        run(sys.executable,"time_train.py",".",str(prog),f"train-{prog}.json")
    run(sys.executable,"time_model.py",".","forecasts.npz","metadata.json")
    run(sys.executable,"time_score.py",".","forecasts.npz","metadata.json","scored.json","worst.npz")
    verify(work/"unsteady.zip",work/"forecasts.npz",work/"metadata.json",work/"scored.json",work/"worst.npz")
    original = json.loads((work/"original-scored.json").read_text())
    rebuilt = json.loads((work/"scored.json").read_text())
    assert original["gates"] == rebuilt["gates"] == [False]*4
    vals = []
    for a,b in zip(original["rows"],rebuilt["rows"],strict=True):
        assert (a["run"],a["station"],a["condition"]) == (b["run"],b["station"],b["condition"])
        vals.extend(abs(a["loss"][k]-b["loss"][k]) for k in a["loss"])
    assert max(vals)<2e-7
    with np.load(work/"original-full-worst.npz") as old, np.load(work/"worst.npz") as new:
        for k in old.files:
            assert np.allclose(old[k],new[k],rtol=3e-7,atol=2e-7)
    print("Portable replay maximum loss difference",max(vals),"reconstructed forecast SHA256",digest(work/"forecasts.npz"),"original byte equality",digest(work/"forecasts.npz")==BANK)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir",type=Path,help="Use locally supplied, hash-verified versions of the two source files")
    parser.add_argument("--frozen-bank",type=Path,help="Recount the exact original forecast file without recalibrating")
    args=parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        replay(Path(tmp),args.source_dir,args.frozen_bank)
if __name__=="__main__":main()
