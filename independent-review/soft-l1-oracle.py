"""Optional independent SciPy check; never a WORLDLAW runtime dependency."""
import json
import pathlib
import subprocess

import numpy as np
from scipy.optimize import least_squares

ROOT = pathlib.Path(__file__).resolve().parents[1]
cases = []
for name, phase, scale, size in [
    ("offset", .1, .05, 1), ("line", .7, .12, 2), ("three", 1.9, .08, 3),
    ("scaled", .3, .02, 2), ("correlated", .9, .04, 3),
]:
    time = np.linspace(-2, 2, 47)
    matrix = np.column_stack([np.ones(len(time)), time, np.sin(2.7 * time + phase)])[:, :size]
    if name == "scaled":
        matrix[:, 1] *= 1e-8
    if name == "correlated":
        matrix[:, 2] = matrix[:, 1] + 1e-3 * matrix[:, 2]
    coefficients = np.array([.7, -1.3, .4])[:size]
    if name == "scaled":
        coefficients[1] /= 1e-8
    readings = matrix @ coefficients + .006 * np.cos(np.arange(len(time)) * 1.91 + phase)
    readings[4] += 4.2
    readings[37] -= 2.3
    cases.append({"name": name, "columns": matrix.T.tolist(), "target": readings.tolist(), "scale": scale})

bridge = """
import fs from 'node:fs';
import {fitSoftL1Columns} from './src/science/robust-fit.mjs';
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(cases.map(c=>({name:c.name,result:fitSoftL1Columns(c.columns,c.target,c.scale)}))));
"""
actual = json.loads(subprocess.check_output(
    ["node", "--input-type=module", "-e", bridge], cwd=ROOT, input=json.dumps(cases).encode()
))
results = []
for case, output in zip(cases, actual):
    matrix = np.array(case["columns"]).T
    readings = np.array(case["target"])
    retained_matrix = matrix.copy()
    scale = case["scale"]
    reference = least_squares(
        lambda coefficients: matrix @ coefficients - readings,
        np.linalg.lstsq(matrix, readings, rcond=None)[0],
        jac=lambda coefficients: matrix.copy(), loss="soft_l1", f_scale=scale,
        x_scale="jac", ftol=1e-13, xtol=1e-13, gtol=1e-13, max_nfev=4000,
    )
    assert np.array_equal(matrix, retained_matrix), "The reference solver changed its source design"
    found = output["result"]
    assert found["status"] == "converged", output
    assert reference.success, reference.message

    def objective(coefficients):
        residuals = matrix @ np.asarray(coefficients) - readings
        return float(np.sum(residuals * residuals / (np.hypot(1, residuals / scale) + 1)))

    ours, oracle = objective(found["coefficients"]), objective(reference.x)
    assert abs(ours - oracle) < 1e-8 * max(1, oracle), (case["name"], ours, oracle)
    results.append({"case": case["name"], "rows": len(readings), "columns": matrix.shape[1],
                    "scale": scale, "oursObjective": ours, "scipyObjective": oracle,
                    "objectiveDifference": ours - oracle, "scipySuccess": bool(reference.success),
                    "iterations": found["iterations"], "scaledGradient": found["scaledGradient"],
                    "gradientTolerance": found["stationarityTolerance"]})
print(json.dumps({"scope": "Independent authored fixed-design controls; not physical validation", "results": results}, indent=2))
