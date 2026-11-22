"""Replay the registered DLR interpolation development course from the two released sources."""

import argparse
import json
from pathlib import Path
import zipfile
import numpy as np
from mesh import read, endpoint_features, middle_response
from prediction import Readout, forecast_digest, metrics
from source import raw_roster, load_crosswalk, check_training_witness


def material_reference(z, first):
    ids, ref, _, edges = read(z, first)
    order = np.argsort(ids)
    ids = ids[order]
    ref = ref[order]
    finite = np.isfinite(ref).all(axis=1)
    edges = edges[np.isin(edges, ids[finite]).all(axis=1)]
    ids, ref = ids[finite], ref[finite]
    ends = np.searchsorted(ids, edges)
    left, right = ends.T
    lengths = np.linalg.norm(ref[right] - ref[left], axis=1)
    assert len(ids) == 40069 and len(edges) == 118401
    return dict(
        ids=ids,
        ref=ref,
        edges=edges,
        centers=(ref[left] + ref[right]) / 2,
        lengths=lengths,
        orient=(ref[right] - ref[left]) / lengths[:, None],
    ), ends


def run(archive, training, expected):
    stages, all_groups = raw_roster(archive)
    matched = load_crosswalk(training, stages)
    assert matched == expected["crosswalk"]
    check_training_witness(archive, expected["raw_worst_witness"])
    # First57 include the first calibration case. Subsequent28+29 middle responses stay closed.
    groups = all_groups[:57]
    with zipfile.ZipFile(archive) as z:
        mat, ij = material_reference(z, groups[0]["low"][0])
        machine = Readout(mat)
        atlas = np.zeros(len(mat["ids"]), dtype=bool)
        rows = []
        for i, g in enumerate(groups):
            ex = endpoint_features(z, g, mat, ij)
            if i:
                pred = machine.predict(ex)
                lock = forecast_digest(pred)
            y, yc, middle, flags = middle_response(z, g, mat, ij)
            valid = ex["common"] & middle
            if i:
                assert forecast_digest(pred) == lock
                met = metrics(pred, y, valid, mat["edges"], mat["ids"][atlas])
                ref = expected["development_rows"][i - 1]
                assert (
                    i == ref["index"]
                    and met["n"] == ref["n"]
                    and met["slice_edges"] == ref["slice_edges"]
                )
                for name, error in met["rmse_um"].items():
                    np.testing.assert_allclose(error, ref["rmse_um"][name], atol=2e-8, rtol=2e-9)
                for label, arms in met["slice_sum_squared_um2"].items():
                    for name, value in arms.items():
                        np.testing.assert_allclose(
                            value, ref["slice_sum_squared_um2"][label][name], atol=2e-6, rtol=2e-8
                        )
                rows.append(met)
            machine.learn(ex, y, yc, valid)
            atlas |= ex["node_flags"] | flags
            if (i + 1) % 10 == 0:
                print("Completed development group", i + 1, flush=True)
    arms = rows[0]["rmse_um"]
    summary = {k: float(np.mean([v["rmse_um"][k] for v in rows])) for k in arms}
    p95 = {k: float(np.quantile([v["rmse_um"][k] for v in rows], 0.95)) for k in arms}
    candidate = "sparse_endpoint_conditional"
    comparator = "past_same_edge"
    original = (
        "length_secant",
        "vector_secant",
        "past_global_strain",
        "past_effective_load",
        comparator,
        "past_spatial_orientation",
    )
    best = min(original, key=summary.get)
    wins = sum(v["rmse_um"][candidate] < v["rmse_um"][comparator] for v in rows)
    gates = [summary[candidate] <= 0.95 * summary[best], p95[candidate] <= p95[best], wins >= 32]
    assert gates == [False, False, False] and wins == 27 and int(atlas.sum()) == 165
    result = {
        "original_groups": len(all_groups),
        "development_groups": len(groups),
        "scored_development_groups": len(rows),
        "unopened_middle_groups": len(all_groups) - len(groups),
        "mean_group_RMSE_um": summary,
        "p95_group_RMSE_um": p95,
        "paired_wins": wins,
        "admission_gates": gates,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("physical_zip", type=Path)
    p.add_argument("crackmnist_L28", type=Path)
    args = p.parse_args()
    run(
        args.physical_zip,
        args.crackmnist_L28,
        json.loads(Path(__file__).with_name("evidence.json").read_text()),
    )
