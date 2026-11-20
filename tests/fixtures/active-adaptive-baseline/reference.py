#!/usr/bin/env python3
"""Independent Fraction images, certified SciPy primal/dual bases and policy DP.

SciPy is used only to propose a basis. Every returned radius is accepted only
after exact Fraction primal feasibility and matching dual equality. No numerical
tolerance determines whether closed model tubes intersect.
"""
from __future__ import annotations
import argparse
import functools
import itertools
import json
from fractions import Fraction as F
from pathlib import Path


def literal(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else str(x)


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), F(0))


def compile_images(request, experiment):
    ticks = [r["tick"] for r in experiment["readings"]]
    controls = [[F(x) for x in row] for row in experiment["controls"]]
    answer = []
    for law in request["hypotheses"]:
        A = [[F(x) for x in row] for row in law["A"]]
        B = [[F(x) for x in row] for row in law["B"]]
        C = [F(x) for x in law["C"]]
        row, state, obs, forced = C[:], [F(0)] * len(C), [], []
        for tick in range(len(controls) + 1):
            if tick in ticks:
                obs.append(row[:])
                forced.append(dot(C, state))
            if tick < len(controls):
                state = [dot(arow, state) + dot(brow, controls[tick]) for arow, brow in zip(A, B)]
                row = [dot(row, [arow[j] for arow in A]) for j in range(len(C))]
        answer.append({"id": law["id"], "O": obs, "f": forced})
    return answer


def verify_radius(images, radius, centre, states, weights):
    assert radius >= 0
    assert all(abs(dot(row, state) + f - y) <= radius
               for image, state in zip(images, states)
               for row, f, y in zip(image["O"], image["f"], centre))
    assert sum(abs(w) for group in weights for w in group) <= 1
    assert all(sum(group[j] for group in weights) == 0 for j in range(len(centre)))
    for image, group in zip(images, weights):
        assert all(dot(group, [row[j] for row in image["O"]]) == 0
                   for j in range(len(image["O"][0])))
    assert sum(dot(group, image["f"]) for image, group in zip(images, weights)) == radius


def intersection(images):
    count, width = len(images), len(images[0]["f"])
    dimensions = [len(image["O"][0]) for image in images]
    zero_states = [[F(0)] * n for n in dimensions]
    zero_weights = [[F(0)] * width for _ in images]
    if count == 1 or all(not f for image in images for f in image["f"]):
        centre = images[0]["f"][:] if count == 1 else [F(0)] * width
        verify_radius(images, F(0), centre, zero_states, zero_weights)
        return F(0), {"centre": centre, "states": zero_states, "weights": zero_weights, "basis": "zero"}
    if all(not x for image in images for row in image["O"] for x in row):
        low = [min(image["f"][j] for image in images) for j in range(width)]
        high = [max(image["f"][j] for image in images) for j in range(width)]
        radius = max((hi - lo) / 2 for lo, hi in zip(low, high))
        centre = [(hi + lo) / 2 for lo, hi in zip(low, high)]
        weights = [row[:] for row in zero_weights]
        if radius:
            j = next(j for j in range(width) if high[j] - low[j] == 2 * radius)
            weights[next(i for i in range(count) if images[i]["f"][j] == high[j])][j] = F(1, 2)
            weights[next(i for i in range(count) if images[i]["f"][j] == low[j])][j] = F(-1, 2)
        verify_radius(images, radius, centre, zero_states, weights)
        return radius, {"centre": centre, "states": zero_states, "weights": weights, "basis": "exact-box"}
    from scipy.optimize import linprog
    offsets = [sum(dimensions[:i]) for i in range(count)]
    centre_start = sum(dimensions)
    variables = centre_start + width + 1
    scale = max(abs(f) for image in images for f in image["f"])
    A, b, owners = [], [], []
    for i, image in enumerate(images):
        for j in range(width):
            for sign in [1, -1]:
                row = [F(0)] * variables
                for k, value in enumerate(image["O"][j]):
                    row[offsets[i] + k] = sign * value
                row[centre_start + j] = F(-sign)
                row[-1] = F(-1)
                A.append(row)
                b.append(-sign * image["f"][j] / scale)
                owners.append((i, j, sign))
    objective = [0] * (variables - 1) + [1]
    result = linprog(objective, A_ub=[[float(x) for x in row] for row in A],
                     b_ub=[float(x) for x in b], bounds=[(None, None)] * (variables - 1) + [(0, None)],
                     method="highs", options={"dual_feasibility_tolerance": 1e-9,
                                               "primal_feasibility_tolerance": 1e-9})
    assert result.success, result.message
    proposed = [F(float(x)).limit_denominator(10**9) for x in result.x]
    dual = [F(float(-x)).limit_denominator(10**9) for x in result.ineqlin.marginals]
    assert all(x >= 0 for x in dual)
    assert all(dot(row, proposed) <= rhs for row, rhs in zip(A, b)), "independent proposed primal is not exact"
    assert all(dot(dual, [row[k] for row in A]) == 0 for k in range(variables - 1))
    assert sum(dual) <= 1
    assert proposed[-1] >= 0 and proposed[-1] == -dot(b, dual), "independent exact dual equality failed"
    radius = proposed[-1] * scale
    states = [[x * scale for x in proposed[offset:offset + n]] for offset, n in zip(offsets, dimensions)]
    centre = [x * scale for x in proposed[centre_start:-1]]
    weights = [row[:] for row in zero_weights]
    for value, (i, j, sign) in zip(dual, owners):
        weights[i][j] += sign * value
    verify_radius(images, radius, centre, states, weights)
    return radius, {"centre": centre, "states": states, "weights": weights, "basis": "independently-certified-highs"}


def maximal_masks(feasible, mask):
    selected = [m for m in feasible if m & mask == m]
    return [m for m in selected if not any(m != n and m & n == m for n in selected)]


def solve(request):
    n = len(request["hypotheses"])
    full = (1 << n) - 1
    eps = F(request["noiseBound"])
    geometry, actions, radius_count = [], [], 0
    for action in request["experiments"]:
        images = compile_images(request, action)
        intersections = []
        for mask in range(1, full + 1):
            selected = [images[i] for i in range(n) if mask & (1 << i)]
            radius, cert = intersection(selected)
            radius_count += 1
            intersections.append({"mask": mask, "radius": literal(radius), "feasible": radius <= eps,
                                  "certificate": cert})
        feasible = [row["mask"] for row in intersections if row["feasible"]]
        geometry.append({"experimentId": action["id"], "intersections": intersections,
                         "maximalMasks": maximal_masks(feasible, full)})
        actions.append({"id": action["id"], "readings": len(action["readings"]),
                        "cost": action["actuationCost"] + sum(row["cost"] for row in action["readings"]),
                        "feasible": feasible})
    pairs = [(1 << i) | (1 << j) for i in range(n) for j in range(i + 1, n)]
    static = None
    for bits in range(1, 1 << len(actions)):
        chosen = [action for j, action in enumerate(actions) if bits & (1 << j)]
        if any(all(pair in action["feasible"] for action in chosen) for pair in pairs):
            continue
        score = (sum(a["readings"] for a in chosen), sum(a["cost"] for a in chosen), bits)
        if static is None or score < static["score"]:
            static = {"score": score, "actions": [a["id"] for a in chosen]}

    @functools.lru_cache(None)
    def policy(mask, budget):
        if mask & (mask - 1) == 0:
            return (0, None, 0)
        winner = None
        for index, action in enumerate(actions):
            if action["readings"] > budget or mask in action["feasible"]:
                continue
            children = maximal_masks(action["feasible"], mask)
            downstream = [policy(m, budget - action["readings"]) for m in children]
            if any(child is None for child in downstream):
                continue
            cost = action["cost"] + max(child[0] for child in downstream)
            actual_readings = action["readings"] + max(child[2] for child in downstream)
            if winner is None or cost < winner[0]:
                winner = (cost, index, actual_readings)
        return winner

    root = None
    if static is not None:
        for budget in range(1, request["maxTotalReadings"] + 1):
            value = policy(full, budget)
            if value is not None:
                root = {"budget": budget, "cost": value[0], "action": actions[value[1]]["id"], "actualReadings": value[2]}
                break
    states = []
    if root:
        for budget in range(root["budget"] + 1):
            for mask in range(1, full + 1):
                if mask & (mask - 1) == 0:
                    continue
                value = policy(mask, budget)
                if value is not None:
                    states.append({"mask": mask, "budget": budget, "cost": value[0],
                                   "action": actions[value[1]]["id"], "actualReadings": value[2]})
    return {"root": root, "static": static, "geometry": geometry, "states": states,
            "intersectionCount": radius_count, "memoStates": policy.cache_info().currsize}


def serial(value):
    if isinstance(value, F):
        return literal(value)
    raise TypeError(type(value).__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=Path, default=Path(__file__).with_name("cases.json"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--only")
    args = parser.parse_args()
    results = []
    for row in json.loads(args.cases.read_text())["cases"]:
        if args.only and row["id"] != args.only:
            continue
        result = solve(row["request"])
        expected = row.get("analytic", {})
        if "adaptiveReadings" in expected:
            assert result["root"]["budget"] == expected["adaptiveReadings"], row["id"]
            assert result["root"]["cost"] == expected["adaptiveCost"], row["id"]
        if "staticReadings" in expected:
            assert result["static"]["score"][0] == expected["staticReadings"], row["id"]
        if expected.get("possible") is False:
            assert result["static"] is None and result["root"] is None, row["id"]
        if expected.get("withinBudget") is False:
            assert result["root"] is None, row["id"]
        if "fullIntersectionRadius" in expected:
            assert result["geometry"][0]["intersections"][-1]["radius"] == expected["fullIntersectionRadius"], row["id"]
            assert result["geometry"][0]["maximalMasks"] == expected["maximalMasks"], row["id"]
        results.append({"id": row["id"], **result})
        print(json.dumps({"id": row["id"], "root": result["root"], "static": result["static"],
                          "intersectionCount": result["intersectionCount"]}), flush=True)
    if args.output:
        args.output.write_text(json.dumps({"schema": "worldlaw.adaptive-independent-reference/v1", "results": results},
                                         default=serial, indent=2) + "\n")


if __name__ == "__main__":
    main()
