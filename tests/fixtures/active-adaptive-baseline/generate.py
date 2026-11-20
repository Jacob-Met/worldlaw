#!/usr/bin/env python3
"""Prospective source courses. No production adaptive implementation is used."""
from __future__ import annotations
import copy
import json
import random
from fractions import Fraction as F
from pathlib import Path

SEED = 6094353
ROOT = Path(__file__).resolve().parent
CASES = []


def literal(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else str(x)


def source(codes, mode="point", noise="1/10", name="source", action_costs=None):
    channels = len(codes[0])
    if mode == "point":
        matrix, output, ticks, length = [[0]], [1], [1], 2
    elif mode == "integrator":
        matrix, output, ticks, length = [[1]], [1], [0, 1], 2
    elif mode == "coupled":
        matrix, output, ticks, length = [[1, 1], [0, 1]], [1, 0], [0, 1, 2], 3
    else:
        raise ValueError(mode)
    laws = []
    for i, code in enumerate(codes):
        gain = [list(code)] if mode != "coupled" else [[0] * channels, list(code)]
        laws.append({"id": f"law_{i}", "A": copy.deepcopy(matrix), "B": gain, "C": output[:]})
    experiments = []
    for channel in range(channels):
        controls = [[0] * channels for _ in range(length)]
        controls[0][channel] = 1
        experiments.append({"id": f"probe_{channel}", "controls": controls,
                            "readings": [{"tick": t, "cost": 1} for t in ticks],
                            "actuationCost": (action_costs or [0] * channels)[channel]})
    return {"schema": "worldlaw.active-linear-adaptive/v1",
            "source": f"Prospectively authored synthetic adaptive experiment course: {name}. No measured provenance.",
            "resetSemantics": "independent-unknown-state-per-experiment",
            "hypotheses": laws, "experiments": experiments, "noiseBound": noise,
            "maxTotalReadings": 32, "workLimit": 50000}


def add(name, request, expected=None):
    CASES.append({"id": name, "request": request, **({"analytic": expected} if expected else {})})


codes = [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 0, 1]]
for mode, adaptive, static, noise in [("point", 2, 3, "1/10"),
                                      ("integrator", 4, 6, "1/10"),
                                      ("coupled", 6, 9, "1/100")]:
    add(f"four_laws_{mode}", source(codes, mode, noise, f"four laws {mode}"),
        {"adaptiveReadings": adaptive, "adaptiveCost": adaptive, "staticReadings": static})

# Root probe separates a three-law hard branch from a two-law branch. The latter
# has a fast expensive test and a slower cheap test. Its extra reading fits the
# slack imposed by the hard branch. Childwise lexicographic minimization fails.
slack = source([[0, 0, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0],
                [1, 0, 0, 0], [1, 0, 0, 1]], name="remaining budget matters",
               action_costs=[0, 0, 0, 99])
slack["experiments"].append({"id": "slow_cheap", "controls": [[0, 0, 0, 0], [0, 0, 0, 1]],
                             "readings": [{"tick": 1, "cost": 1}, {"tick": 2, "cost": 1}],
                             "actuationCost": 0})
add("five_laws_budget_slack", slack, {"adaptiveReadings": 3, "adaptiveCost": 3, "staticReadings": 4})

touch = source(codes, noise="1/2", name="closed interval contact")
add("closed_contact", touch, {"possible": False})
idle = source(codes, name="no actuation")
for experiment in idle["experiments"]:
    experiment["controls"] = [[0, 0, 0], [0, 0, 0]]
add("zero_input", idle, {"possible": False})
same = source([codes[0], codes[0], codes[2], codes[3]], name="equivalent offered laws")
add("equivalent_laws", same, {"possible": False})

# Three affine output lines in R^2. Every pair intersects, but the three closed
# epsilon tubes have common intersection iff epsilon >= 1/8. Pairwise graphs
# therefore cannot be used as exact ambiguity sets.
triangle = {"schema": "worldlaw.active-linear-adaptive/v1",
            "source": "Prospective synthetic three-line tube intersection; all nuisance starts remain arbitrary.",
            "resetSemantics": "independent-unknown-state-per-experiment",
            "hypotheses": [{"id": f"line_{a}", "A": [[a]], "B": [[b]], "C": [1]}
                           for a, b in [(0, 0), (1, 0), (2, 1)]],
            "experiments": [{"id": "triangle", "controls": [[1], [0]],
                             "readings": [{"tick": 0, "cost": 1}, {"tick": 1, "cost": 1}],
                             "actuationCost": 0}],
            "noiseBound": "1/10", "maxTotalReadings": 32, "workLimit": 50000}
add("non_helly_pair_graph", triangle,
    {"possible": False, "fullIntersectionRadius": "1/8", "maximalMasks": [3, 5, 6]})
triangle_touch = copy.deepcopy(triangle)
triangle_touch["noiseBound"] = "1/8"
add("three_tube_closed_contact", triangle_touch,
    {"possible": False, "fullIntersectionRadius": "1/8", "maximalMasks": [7]})
add("one_bundle_suffices", source([[0], [1], [2], [3], [4]], name="one bundle suffices"),
    {"adaptiveReadings": 1, "adaptiveCost": 1, "staticReadings": 1})
tiny = [[literal(F(x, 999999999997)) for x in row] for row in codes]
add("tiny_exact_forcing", source(tiny, noise="0", name="tiny exact forcing"),
    {"adaptiveReadings": 2, "adaptiveCost": 2, "staticReadings": 3})
negative = [[literal(-7 * F(x)) for x in row] for row in codes]
add("signed_forcing", source(negative, noise="1", name="signed forcing"),
    {"adaptiveReadings": 2, "adaptiveCost": 2, "staticReadings": 3})
too_short = source(codes, name="one reading budget")
too_short["maxTotalReadings"] = 1
add("insufficient_total_budget", too_short, {"withinBudget": False, "possible": True, "staticReadings": 3})
permuted = source([codes[i] for i in [3, 0, 2, 1]], name="permuted law names")
add("permuted_family", permuted, {"adaptiveReadings": 2, "adaptiveCost": 2, "staticReadings": 3})

rng = random.Random(SEED)
for mode, count, noise in [("point", 12, "1/10"), ("integrator", 12, "1/20"),
                           ("coupled", 6, "1/100"), ("different_decay", 6, "1/100")]:
    for j in range(count):
        n = rng.randrange(3, 6)
        channels = rng.randrange(2, 5)
        bits = [[rng.randrange(-1, 2) for _ in range(channels)] for _ in range(n)]
        request = source(bits, mode if mode != "different_decay" else "integrator", noise,
                         f"seed {SEED} {mode} course {j}", [rng.randrange(0, 4) for _ in range(channels)])
        if mode == "different_decay":
            for law in request["hypotheses"]:
                law["A"] = [[literal(rng.choice([F(-1), F(0), F(1, 2), F(1), F(2)]))]]
            for experiment in request["experiments"]:
                experiment["controls"].append([0] * channels)
                experiment["readings"] = [{"tick": t, "cost": 1} for t in [0, 1, 2, 3]]
        if j % 3 == 0:
            request["experiments"].append({"id": "idle", "controls": [[0] * channels for _ in request["experiments"][0]["controls"]],
                                           "readings": copy.deepcopy(request["experiments"][0]["readings"]), "actuationCost": 0})
        add(f"prospective_{mode}_{j:02d}", request)

assert len(CASES) == 50
output = {"schema": "worldlaw.adaptive-prospective-course/v1", "seed": SEED,
          "scope": "14 analytic and 36 prospectively authored synthetic courses. Not physical or unseen-real-mechanism evidence.",
          "cases": CASES}
(ROOT / "cases.json").write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps({"cases": len(CASES), "seed": SEED, "path": str(ROOT / "cases.json")}))
