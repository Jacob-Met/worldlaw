"""Replay the donor fit, full and diagonal operators, native SPCAT and all feature scores."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import subprocess
import urllib.request

from model import calibrate,forecast
from score import score
from source import source_file

ROOT=Path(__file__).resolve().parent
FORECAST="66a7d1803ca57fcee6ce3e678fd9f3f5cfaabf02da418a47e178bf0f5a38ad36"
OUTCOME="8a22c10f59adb058b57aee3788e504fd52334839d52fe009acbfea5945411f6d"
ORIGINAL_SPCAT="8d3eb357347e9678d699cee1ee7d9df12c20b91d220f788aea7ad50be3ca533c"

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def program(directory,existing):
    if existing is not None:
        if digest(existing)!=ORIGINAL_SPCAT:
            raise ValueError("External binary differs from original. Build the pinned source instead.")
        return existing.resolve()
    directory.mkdir(parents=True,exist_ok=True)
    for name,pin in json.loads((ROOT/"calpgm-source.json").read_text()).items():
        path=directory/name
        if not path.exists():
            with urllib.request.urlopen("https://spec.jpl.nasa.gov/ftp/pub/calpgm/"+name,timeout=40) as r:
                data=r.read()
            if hashlib.sha256(data).hexdigest()!=pin:
                raise ValueError(("Downloaded upstream source",name))
            path.write_bytes(data)
        if digest(path)!=pin:
            raise ValueError(("Cached upstream source",name))
    subprocess.run(["make","-B","--jobs=1","spcat"],cwd=directory,check=True)
    return (directory/"spcat").resolve()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--sources",type=Path,required=True)
    parser.add_argument("--spcat",type=Path)
    args=parser.parse_args()
    for name,pin in [("forecast.json",FORECAST),("outcome.json",OUTCOME)]:
        if digest(ROOT/name)!=pin:
            raise ValueError(("Frozen output hash",name))
    reference=json.loads((ROOT/"forecast.json").read_bytes())
    actual=forecast(args.sources,calibrate(args.sources),program(args.sources/"calpgm",args.spcat))
    # JSON stores the five (J, twice-F1) slot tuples as arrays.
    kernel=json.loads(json.dumps(actual["calibration"]["exact_donor_kernel"]))
    if kernel!=reference["calibration"]["exact_donor_kernel"]:
        raise ValueError("Donor null family")
    largest=0.
    count=0
    for label,group in reference["features"].items():
        current=actual["features"][label]
        if current["ids"]!=group["ids"] or set(current["centered_kHz"])!=set(group["centered_kHz"]):
            raise ValueError("Feature registry")
        for arm,expected in group["centered_kHz"].items():
            values=current["centered_kHz"][arm]
            if len(values)!=len(expected):
                raise ValueError("Feature count")
            for x,y in zip(values,expected):
                difference=abs(x-y)
                if not difference<=1e-6:
                    raise ValueError(("Portable forecast kHz",label,arm,x,y))
                largest=max(largest,difference)
                count+=1
    received=score(args.sources,actual)
    stored=json.loads((ROOT/"outcome.json").read_bytes())
    for key in ("relative","absolute","joint"):
        assert received[key]==stored[key], key
    for arm,values in received["aggregate"].items():
        for key,val in values.items():
            assert abs(val-stored["aggregate"][arm][key])<=1e-6
    source_file(args.sources,"SiS.lin")
    print("FORECAST_COMPONENTS",count,"MAX_KHZ_DIFFERENCE",largest,"GATES",received["relative"],received["absolute"])
    subprocess.run([sys.executable,"-I",str(ROOT/"independent.py"),str(args.sources/"SiS.lin"),
                    str(ROOT/"forecast.json"),str(ROOT/"outcome.json")],check=True)

if __name__=="__main__":
    main()
