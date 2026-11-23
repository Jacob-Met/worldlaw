"""Recount the physical held-analyzer test or reproduce it from source."""
import argparse
from fractions import Fraction
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
from statistics import mean
import subprocess
import sys

HERE = Path(__file__).resolve().parent
LOCK = "2a290ff5fc0458f18273549fc5b576e03b268989dc26c8c775450904baf8ec46"
SCORE = "17833743a0028bc86e571af0cdc9f8eaca2903c7da2cae74224df2f60bd90259"

def digest(path):
    with path.open("rb") as fp:
        return hashlib.file_digest(fp, "sha256").hexdigest()

def recount(path):
    record = json.loads(path.read_text())
    rows = record["rows"]
    assert len(rows) == 15
    methods = set(next(iter(rows.values()))["methods"])
    assert len(methods) == 11
    rms = {}
    for scene, row in rows.items():
        assert set(row["methods"]) == methods
        rms[scene] = {}
        for name, slices in row["methods"].items():
            assert len(slices) == 6
            assert slices["interior"][0] == 736 * 992
            rms[scene][name] = {
                key: math.sqrt(squared / n)
                for key, (n, squared, _) in slices.items() if n
            }
    def average(name, key):
        return mean(sc[name][key] for sc in rms.values() if key in sc[name])
    candidate = "physical_joint"
    competitors = methods - {candidate}
    best = min(competitors, key=lambda m: average(m, "interior"))
    best_edge = min(competitors, key=lambda m: average(m, "high_gradient"))
    wins = sum(sc[candidate]["interior"] < sc[best]["interior"] for sc in rms.values())
    peak = {m: max(sc[m]["interior"] for sc in rms.values()) for m in methods}
    checks = [
        True,
        average(candidate, "interior") <= .95 * average(best, "interior"),
        wins >= 10,
        peak[candidate] <= 1.10 * peak[best],
        average(candidate, "high_gradient") <= 1.05 * average(best_edge, "high_gradient"),
    ]
    assert (checks, wins, best, best_edge) == (
        record["gates"], record["wins"], record["best"], record["best_edge"]
    )
    for key, saved in record["means"].items():
        for name, value in saved.items():
            assert math.isclose(average(name, key), value, rel_tol=1e-12, abs_tol=1e-15)
    a, growth = Fraction(9, 25), Fraction(6, 5)
    x0, x45, x90 = [a * growth ** i for i in range(3)]
    s0, q, u = x0 + x90, x0 - x90, 2*x45 - x0 - x90
    assert s0*s0 >= q*q + u*u
    assert ((s0+q)/2, (s0+u)/2, (s0-q)/2) == (x0, x45, x90)
    static, drift = (s0-u)/2, a * growth**3
    assert (static, drift, (drift-static)/2) == (
        Fraction(279,625), Fraction(1944,3125), Fraction(549,6250)
    )
    return {
        "scenes": len(rows), "methods": len(methods), "gates": checks,
        "wins": wins, "primary_rms": average(candidate, "interior"),
        "strongest": best, "strongest_rms": average(best, "interior"),
        "two_world_lower_bound": str((drift-static)/2)
    }

def main():
    ap = argparse.ArgumentParser(description=__doc__, epilog=(
        "For physical replay, install Python 3.11+, NumPy, SciPy and OpenCV, "
        "and GNU Octave plus image. Check out the author Git at "
        "bef123c5024aca12ef0eeae70fb98fedd665bf13. "
        "Runtime JSON fields are octave (absolute octave-cli executable), "
        "source (author checkout), env (object of overrides), and image_paths "
        "(list of image-package directories, or [] to use pkg load image)."
    ))
    ap.add_argument("--physical", type=Path, help="fresh empty directory for instrument images")
    ap.add_argument("--runtime", type=Path, help="native author-functions runtime JSON")
    ap.add_argument("--receive-existing", type=Path, help="verify complete original maps and source PNGs")
    args = ap.parse_args()
    assert digest(HERE/"score.json") == SCORE
    assert digest(HERE/"forecast-lock.json") == LOCK
    published = recount(HERE/"score.json")
    print(json.dumps(published, sort_keys=True), flush=True)
    environment = {**os.environ, "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"}
    if args.receive_existing and args.physical:
        ap.error("Choose a saved physical run or a fresh new work directory.")
    if args.receive_existing:
        subprocess.run([sys.executable, str(HERE/"independent.py"), str(args.receive_existing.resolve()),
                        LOCK, SCORE], env=environment, check=True)
        return
    if not args.physical:
        return
    if not args.runtime:
        ap.error("--physical requires --runtime")
    runtime = args.runtime.resolve()
    cfg = json.loads(runtime.read_text())
    source = Path(cfg["source"])
    for filename, expected in [
        ("EARI.m", "f5d3725b635dcd6aa70997ea23c9fa83ac17e0df934833f4b971767c2b9e84e8"),
        ("IGRI2.m", "a269202c796a2ec0ce164f48dec0b746ab2ec6e739c1568b061d36e2abf73ce5"),
    ]:
        assert digest(source/"Functions"/filename) == expected
    work = args.physical.resolve()
    work.mkdir(parents=True, exist_ok=True)
    if any(work.iterdir()):
        ap.error("Choose an empty working directory to preserve target isolation.")
    for name in ["source-freeze.json", "training.py", "course.py", "score.py", "independent.py", "author.py"]:
        shutil.copyfile(HERE/name, work/name)
    environment["MORIMATSU_AUTHOR_RUNTIME"] = str(runtime)
    subprocess.run([sys.executable, str(work/"training.py"), str(runtime)], env=environment, check=True)
    environment["PYTHONPATH"] = str(work/"python") + os.pathsep + environment.get("PYTHONPATH", "")
    subprocess.run([sys.executable, str(work/"course.py")], env=environment, check=True)
    lock_digest = digest(work/"locked"/"lock.json")
    subprocess.run([sys.executable, str(work/"score.py"), lock_digest], env=environment, check=True)
    result_digest = digest(work/"score.json")
    subprocess.run([sys.executable, str(work/"independent.py"), str(work), lock_digest, result_digest],
                   env=environment, check=True)
    observed = recount(work/"score.json")
    assert observed["gates"] == published["gates"]
    for key in ("primary_rms", "strongest_rms"):
        assert math.isclose(observed[key], published[key], rel_tol=2e-5, abs_tol=1e-8)
    print(json.dumps(observed, sort_keys=True))

if __name__ == "__main__":
    main()
