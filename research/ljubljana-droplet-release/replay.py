"""Replay the frozen Ljubljana score, optionally reconstructing the training-only forecast."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

import recount
import score

ROOT = Path(__file__).resolve().parent
ARCHIVE = "31c138fa6d8580d89d8729d3a2cd3380b4cf17ff331003d83c917f8b25da8b2a"
FILES = {"main": "organizer.csv", "reference": "reference.csv",
         "forecasts": "five-arm-locked-forecasts.json", "result": "five-arm-all-surfaces.json",
         "independent": "independent.json"}
PINS = {**recount.PINS, "independent":"0a8473948541668ea1f7a7df9877435a1a1a65e2b13bf254763e54a1ce402db4"}


def digest(b):
    return hashlib.sha256(b).hexdigest()


def training_projection(m,ref):
    records=[];targets={}
    for file,raw in (("01",m),("02",ref)):
        for i, row in enumerate(raw.splitlines()[1:],2):
            count = 8 if file=="01" else 6
            pre = row.split(b",",count)[:count]
            name=pre[0].decode("cp1252")
            x=[float(z) for z in pre[1:]]
            if file=="01":
                split="train" if x[5] in (50,200,800) else "development" if x[5]==400 else "final"
            else:
                split="reference_no_endpoint"
            if split=="train":
                both=row.split(b",")[10:12]
                targets[str(i)]=[float(y) for y in both]
            records.append({"file":file,"line":i,"material":name,"x":x,"split":split})
    return records,targets


def refit(m,ref,frozen):
    import forecast
    inputs,targets=training_projection(m,ref)
    for item,expected in ((inputs,forecast.INPUT_SHA),(targets,forecast.FIT_SHA)):
        b=(json.dumps(item,sort_keys=True,separators=(",",":"))+"\n").encode()
        if digest(b)!=expected:
            raise ValueError("Training or input-only projection differs")
    rebuilt=forecast.forecasts(inputs,targets)
    max_delta=[0.,0.]
    for orig,new in zip(frozen["rows"],rebuilt["rows"],strict=True):
        assert (orig["line"],orig["split"],orig["surface"])==(new["line"],new["split"],new["surface"])
        for arm in score.ARMS:
            for i in (0,1):
                max_delta[i]=max(max_delta[i],abs(orig["pred"][arm][i]-new["pred"][arm][i]))
    rebuilt_raw=(json.dumps(rebuilt,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()
    if max_delta[0]>2e-6 or max_delta[1]>2e-5:
        raise ValueError(f"Refit beyond numerical replay tolerance: {max_delta}")
    return {"refit_max_absolute_delta":max_delta,"rebuilt_forecast_sha256":digest(rebuilt_raw),
            "original_forecast_sha256":recount.PINS["forecasts"]}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--refit",action="store_true",help="Recompute the five locked arms from the original seven inputs")
    args=ap.parse_args()
    archive=ROOT/"original-course.zip"
    if digest(archive.read_bytes())!=ARCHIVE:
        raise ValueError("Original archive mismatch")
    with zipfile.ZipFile(archive) as z:
        if sorted(z.namelist())!=sorted(FILES.values()):
            raise ValueError("Archive roster mismatch")
        data={k:z.read(n) for k,n in FILES.items()}
    for k,v in data.items():
        if digest(v)!=PINS[k]:
            raise ValueError(k+" member mismatch")
    forecast=json.loads(data["forecasts"])
    refit_receipt=refit(data["main"],data["reference"],forecast) if args.refit else None
    official=score.score(data["main"],data["reference"],forecast)
    if official!=json.loads(data["result"]):
        raise ValueError("Frozen score mismatch")
    independent=recount.analyze(data["main"],data["reference"],forecast,official)
    independent=json.loads(json.dumps(independent))
    if independent!=json.loads(data["independent"]):
        raise ValueError("Independent residual or mask sensitivity mismatch")
    print(json.dumps({"archive_sha256":ARCHIVE,"final":official["final"]["summary"],
                      "joint":official["final"]["joint"],"raw_worst":official["final"]["worst_force"],
                      "recount":independent,"refit":refit_receipt},indent=2))


if __name__=="__main__":
    main()
