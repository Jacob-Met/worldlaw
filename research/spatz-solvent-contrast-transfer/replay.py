"""Replay the frozen seven forecasts and evaluate all nine raw acquisitions."""
import argparse
import importlib.metadata
import json
import pathlib

import numpy as np
from forecast import HELD, disk_design, disk_eval, empirical, pack, slab_eval
from independent import evaluate, unpack


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", required=True, type=pathlib.Path)
    args = parser.parse_args()
    here = pathlib.Path(__file__).resolve().parent
    protocol = json.loads((here / "protocol.json").read_bytes())
    for name, expected in protocol["receiver"]["versions"].items():
        if importlib.metadata.version(name) != expected:
            raise ValueError(f"{name} must match {expected}")
    bank = unpack(here / "forecast.json.zlib",
                  "3424f6ab23acd97a38ec43a9f3ba6aec8d708f5d2a9236566d86b2468fdc14d7")
    design = json.loads((here / "design.json").read_bytes())
    parameters = {name: np.asarray(fit["p"]) for name, fit in bank["fits"].items()}
    errors = []
    for scan in HELD:
        q, width, solvent = pack(design, [scan])
        forecasts = empirical(bank["calibration"], scan, q)
        forecasts["shared_disk"] = disk_eval(parameters["disk"], disk_design(q, width, solvent), solvent)
        for label, group, wet, floating in (
            ("dry_slabs", "dry", False, False),
            ("author_solvated_slabs", "solvated", True, False),
            ("author_free_backing", "solvated_free_backing", True, True),
        ):
            forecasts[label] = slab_eval(parameters[group], q, width, solvent, wet, floating)
        original = bank["points"][str(scan)]
        if set(original) != set(forecasts):
            raise ValueError(f"Forecast roster differs for {scan}")
        for name, result in forecasts.items():
            np.testing.assert_allclose(result, original[name], rtol=2e-9, atol=2e-12)
            errors.extend(np.abs(result-original[name]).tolist())
    outcome = unpack(here / "outcome.json.zlib",
                     "f4e3b56b82ec7e84a2c259f622bb8fe78a48c8b36263588a865b3edd73754a24")
    receipt = evaluate(args.raw_dir, bank, outcome)
    print(json.dumps({"reconstructed_forecasts":len(errors),
                      "maximum_forecast_error":max(errors),"raw_recount":receipt},
                     sort_keys=True, allow_nan=False))


if __name__ == "__main__":
    main()
