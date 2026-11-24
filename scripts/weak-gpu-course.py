"""Frozen state-only symbolic support selection and unseen-initial-condition audit."""
import argparse
import base64
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
import time

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "science"))
from weak_gpu import (DT, GRID, N, design_drive, estimate, forecast_error, observation,
                      permute, syntax)


def assess(training, verify, audit, layout, method):
    model = estimate(training, layout, method)[0]
    validation = forecast_error(model, verify, layout)
    hidden = forecast_error(model, audit, layout)
    return {"validation_noise_rmse": validation, "audit_noise_rmse": hidden,
            "admitted": validation is not None and validation <= 3,
            "transfers": hidden is not None and hidden <= 3,
            "trees": [[{"tree": syntax(t, layout), "weight": c} for t, c in channel] for channel in model]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output")
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()
    folder = ROOT / "experiments" / "weak-gpu-course"
    registry = json.loads((folder/"protocol.json").read_text())
    if not torch.cuda.is_available():
        raise RuntimeError("physical CUDA device required")
    device = torch.cuda.get_device_properties(0)
    if device.total_memory < 4*1024**3:
        raise RuntimeError("requires 4 GiB physical VRAM")
    output = Path(args.output) if args.output else Path(os.environ.get("ARTIFACT_DIR", "."))/"weak-gpu-result.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    rows = []
    header = {"schema": "worldlaw.weak-gpu-evolution/1", "device": device.name,
              "torch": torch.__version__, "seed_pairs": registry["seeds"],
              "protocol_sha256": sha256((folder/"protocol.json").read_bytes()).hexdigest(),
              "smoke": args.smoke, "rows": rows}
    def save(status):
        header.update(status=status, elapsed_s=time.monotonic()-started)
        pending = output.with_suffix(".tmp")
        pending.write_text(json.dumps(header, separators=(",", ":"), allow_nan=False)+"\n")
        pending.replace(output)
    cases = registry["cases"][:1] if args.smoke else registry["cases"]
    for index, case in enumerate(cases):
        name, layout = case["name"], case["layout"]
        frame = (folder/"packets"/(name+".f32le.b64")).read_bytes()
        values = base64.b64decode(frame.strip(), validate=True)
        if sha256(frame).hexdigest() != case["sha256"]:
            raise RuntimeError("acquisition source mismatch: "+name)
        channels = GRID if layout == "periodic" else 2
        paths = np.frombuffer(values, dtype="<f4").reshape(2, 11, N+1, channels).astype(np.float64)
        for world, seed in enumerate(registry["seeds"]):
            for db in registry["snr_db"]:
                s = seed+10163*index+421*db
                def read(slot, drive, noise):
                    return observation(paths[world,slot], db, noise, drive)
                pilot = read(0,-1,s+1)
                verification = read(9,2,s+3)
                audit = read(10,5,s+13)
                drive,scores = design_drive(pilot,layout)
                random = int(np.random.default_rng(s+47).integers(8))
                arms = {}
                for arm, intervention, method in [("active",drive,"weak"),("random",random,"weak"),("passive",-1,"sindy")]:
                    response = read(intervention+1,intervention,s+2)
                    fit = assess([pilot,response], verification, audit, layout, method)
                    sham = assess([permute(pilot,s+5),permute(response,s+7)],permute(verification,s+11),
                                  permute(audit,s+17),layout,method)
                    arms[arm] = {"drive":intervention,"fit":fit,"sham":sham}
                rows.append({"family": name,"world":world,"db":db,"ood":case["ood"],"scores":scores,"arms":arms})
        save("running")
        print(f"completed {name}; {len(rows)} rows",flush=True)
    expected = len(cases)*len(registry["seeds"])*len(registry["snr_db"])
    if len(rows) != expected:
        raise RuntimeError("incomplete result")
    def count(arm, pred):
        return sum(bool(pred(row, row["arms"][arm])) for row in rows)
    scores = {}
    for arm in ["active","random","passive"]:
        scores[arm] = {"in_roster_transfer":count(arm,lambda r,a:not r["ood"] and a["fit"]["admitted"] and a["fit"]["transfers"]),
                       "in_roster_admitted":count(arm,lambda r,a:not r["ood"] and a["fit"]["admitted"]),
                       "sham_admitted":count(arm,lambda r,a:a["sham"]["admitted"]),
                       "ood_admitted":count(arm,lambda r,a:r["ood"] and a["fit"]["admitted"])}
    a = scores["active"]
    header["scores"] = scores
    header["passed"] = (not args.smoke and a["in_roster_transfer"]>max(scores[k]["in_roster_transfer"] for k in ("random","passive"))
                        and a["sham_admitted"]==0 and a["ood_admitted"]==0)
    header["peak_cuda_allocated_bytes"] = torch.cuda.max_memory_allocated()
    save("complete")
    print(json.dumps({k:v for k,v in header.items() if k!="rows"},sort_keys=True),flush=True)


if __name__ == "__main__":
    main()
