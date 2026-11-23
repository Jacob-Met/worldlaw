"""Replay four whole-preparation leave-one-out comparisons on the released archive."""
import argparse
import json
import statistics
from pathlib import Path

import numpy as np

from data import CALIBRATION, RECIPES, read_course
from models import Forecast


CANDIDATE = "OU_cross_covariance"


def score(y, pred, scale, q, t):
    if not np.isfinite(pred).all():
        raise ValueError("Nonfinite forecast")
    residual = ((pred[None, :, :] - y)/scale)[..., 1:]
    primary = float(np.sqrt(np.mean(residual**2, axis=(1, 2))).mean())
    obs_plateau = y[:, :, -4:].mean(-1, keepdims=True)
    pred_plateau = pred[:, -4:].mean(-1, keepdims=True)
    if not (np.all(obs_plateau > 0) and np.all(pred_plateau > 0)):
        raise ValueError("Unresolved four-lag contrast normalization")
    shape_error = (y/obs_plateau - pred/pred_plateau)[..., 1:]
    shape = float(np.sqrt(np.mean(shape_error**2, axis=(1, 2))).mean())
    record, annulus, lag = np.unravel_index(np.argmax(np.abs(residual)), residual.shape)
    worst = {"repeat": int(record)+1, "q": float(q[annulus]), "t": float(t[lag+1]),
             "observed": float(y[record, annulus, lag+1]), "predicted": float(pred[annulus, lag+1]),
             "normalized_error": float(residual[record, annulus, lag])}
    return {"primary": primary, "shape": shape, "worst": worst}


def calculate(archive):
    q, t, bins, fits, observations, opened = read_course(archive)
    forecast = Forecast(q, t, bins, fits, observations)
    recipes = sorted(RECIPES[pos] for pos in CALIBRATION)
    scores, correlations, worst_curves = {}, {}, {}
    for p in recipes:
        training = [c for c in recipes if c != p]
        predictions, correlations[str(p)] = forecast.predict(p, training)
        by_method = {k: score(observations[p], y, forecast.scale(p), q, t)
                     for k, y in predictions.items()}
        scores[str(p)] = by_method
        worst_q = by_method[CANDIDATE]["worst"]["q"]
        j = np.flatnonzero(q == worst_q).item()
        worst_curves[str(p)] = {"q": worst_q, "t": t.tolist(),
                                "observed_five": observations[p][:,j,:].tolist(),
                                "all_forecasts": {k: y[j].tolist() for k, y in predictions.items()}}
    names = list(scores[str(recipes[0])])
    means = {name: {measure: statistics.mean(scores[str(p)][name][measure] for p in recipes)
                    for measure in ("primary", "shape")} for name in names}
    controls = [name for name in names if name != CANDIDATE]
    best = min(controls, key=lambda name: means[name]["primary"])
    best_shape = min(controls, key=lambda name: means[name]["shape"])
    ratios = [scores[str(p)][CANDIDATE]["primary"]/scores[str(p)][best]["primary"]
              for p in recipes]
    mean_ratio = means[CANDIDATE]["primary"]/means[best]["primary"]
    shape_ratio = means[CANDIDATE]["shape"]/means[best_shape]["shape"]
    gates = [mean_ratio <= .98, sum(r < 1 for r in ratios) >= 2,
             max(ratios) <= 1.20, shape_ratio <= 1.05]
    return {"means": means, "by_recipe": scores, "correlations": correlations,
            "raw_curves": worst_curves, "best_primary": best, "best_shape": best_shape,
            "ratios": ratios, "mean_ratio": mean_ratio, "shape_ratio": shape_ratio,
            "gates": gates, "opened_members": opened}


def verify(report, frozen):
    if set(report["means"]) != set(frozen["means"]) or len(report["means"]) != 12:
        raise ValueError("Method roster mismatch")
    for p, methods in frozen["by_recipe"].items():
        for k, expected in methods.items():
            observed = report["by_recipe"][p][k]
            for metric in ("primary", "shape"):
                np.testing.assert_allclose(observed[metric], expected[metric], rtol=2e-10, atol=2e-12)
            for key, value in expected["worst"].items():
                np.testing.assert_allclose(observed["worst"][key], value, rtol=2e-10, atol=2e-12)
        np.testing.assert_allclose(report["correlations"][p], frozen["params"][p]["rhos"],
                                   rtol=2e-10, atol=2e-12)
        raw = frozen["raw_curves"][p]
        fresh = report["raw_curves"][p]
        for key in ("q", "t", "observed_five"):
            np.testing.assert_array_equal(fresh[key], raw[key])
        for name, curve in raw["all_forecasts"].items():
            np.testing.assert_allclose(fresh["all_forecasts"][name], curve, rtol=2e-10, atol=1e-7)
    for key in ("best_primary", "best_shape", "gates"):
        if report[key] != frozen[key]:
            raise ValueError(f"Frozen {key} mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Publisher Processed_Data.zip")
    parser.add_argument("--output", type=Path, help="Write all per-recipe scores and worst-annulus traces")
    args = parser.parse_args()
    report = calculate(args.archive)
    frozen = json.loads(Path(__file__).with_name("frozen.json").read_text())
    verify(report, frozen)
    if args.output:
        args.output.write_text(json.dumps(report, sort_keys=True, allow_nan=False) + "\n")
    print(json.dumps({key: report[key] for key in ("means", "best_primary", "best_shape",
                                                    "ratios", "mean_ratio", "shape_ratio", "gates")},
                     sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
