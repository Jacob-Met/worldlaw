#!/usr/bin/env python3
"""Frozen independent all-box-corners / all-reading-subsets primal LP oracle.

No production circuit, nullspace, state compiler or selection code is imported.
Only the Node bridge calls the candidate public API. Tolerance is locked 1e-9.
"""
import argparse
from fractions import Fraction as F
import hashlib
import itertools
import json
from pathlib import Path
import subprocess
import numpy as np
from scipy.optimize import linprog

TOL = 1e-9

def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), F(0))

def matvec(matrix, vector):
    return [dot(row, vector) for row in matrix]

def dynamics(law, controls, initial=None):
    A, B, C = [[list(map(F, row)) for row in law[k]] for k in ['A', 'B']] + [list(map(F, law['C']))]
    n = len(A)
    state = list(map(F, initial)) if initial is not None else [F(0)] * n
    power = [[F(i == j) for j in range(n)] for i in range(n)]
    output, observable = [], []
    for t in range(len(controls) + 1):
        output.append(dot(C, state))
        observable.append([dot(C, col) for col in zip(*power)])
        if t < len(controls):
            state = [a + b for a, b in zip(matvec(A, state), matvec(B, list(map(F, controls[t]))))]
            power = [[dot(row, col) for col in zip(*power)] for row in A]
    return observable, output

def corners(request):
    channels = len(request['controlBounds'][0]['min'])
    endpoints = []
    for b in request['controlBounds']:
        endpoints.extend([(lo,) if F(lo) == F(hi) else (lo, hi) for lo, hi in zip(b['min'], b['max'])])
    for flat in itertools.product(*endpoints):
        yield [list(flat[i:i + channels]) for i in range(0, len(flat), channels)]

def distance(rows, delta):
    a = np.array([[float(v) for v in row] for row in rows])
    d = np.array([float(v) for v in delta])
    n = a.shape[1]
    result = linprog(np.r_[np.zeros(n), 1.0],
        A_ub=np.vstack([np.column_stack([a, -np.ones(len(d))]), np.column_stack([-a, -np.ones(len(d))])]),
        b_ub=np.r_[d, -d], bounds=[(None, None)] * n + [(0, None)], method='highs',
        options={'dual_feasibility_tolerance': 1e-9, 'primal_feasibility_tolerance': 1e-9})
    if not result.success:
        raise AssertionError(('independent primal LP failed', result.message))
    return result.fun

def courses(request):
    result = []
    for controls in corners(request):
        laws = [dynamics(law, controls) for law in request['hypotheses']]
        rows = [a + [-x for x in b] for a, b in zip(laws[0][0], laws[1][0])]
        delta = [b - a for a, b in zip(laws[0][1], laws[1][1])]
        result.append((rows, delta))
    return result

def reference(request):
    compiled = courses(request)
    menu = sorted(request['offeredTicks'])
    lp_count = 0
    def maximum(ticks):
        nonlocal lp_count
        lp_count += len(compiled)
        return max(distance([rows[t] for t in ticks], [delta[t] for t in ticks]) for rows, delta in compiled)
    potential = maximum(menu)
    winner = None
    if potential > 2 * float(F(request['noiseBound'])) + TOL:
        for size in range(1, request['maxReadings'] + 1):
            qualified = []
            for ticks in itertools.combinations(menu, size):
                margin = maximum(ticks)
                if margin > 2 * float(F(request['noiseBound'])) + TOL:
                    cost = sum(request.get('costByTick', {}).get(str(t), 1) for t in ticks)
                    qualified.append((cost, ticks, margin))
            if qualified:
                winner = min(qualified)
                break
    return dict(potential=potential, winner=winner, corners=len(compiled), primalLPs=lp_count)

BRIDGE = r'''
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const api=await import(pathToFileURL(process.argv[1]));
const inputs=JSON.parse(readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(inputs.map(row=>{
  const plan=api.designActiveLinearControlBox(row.request);
  const readouts=row.readouts?.map(readout=>api.evaluateActiveLinearReadings(row.request,plan,readout))??[];
  return {plan,readouts};
})));
'''

def run_node(module, inputs):
    run = subprocess.run(['node', '--max-old-space-size=1536', '--input-type=module', '-e', BRIDGE, str(module.resolve())],
        input=json.dumps(inputs), text=True, capture_output=True, check=True, timeout=180)
    return json.loads(run.stdout)

def close(actual, expected, context):
    error = abs(float(F(actual)) - expected)
    assert error <= TOL, (context, actual, expected, error)
    return error

def receive(module, path):
    cases = json.loads(path.read_text())
    outputs = run_node(module, cases)
    max_error, total_corners, total_lps, checks = 0.0, 0, 0, []
    readout_inputs, readout_expected = [], []
    for row, out in zip(cases, outputs):
        request, plan = row['request'], out['plan']
        expected = reference(request)
        total_corners += expected['corners']; total_lps += expected['primalLPs']
        assert not plan['exhausted'], (row['name'], plan)
        max_error = max(max_error, close(plan['potential'][0]['marginLowerBound'], expected['potential'], row['name']))
        chosen = None if plan['selection'] is None else tuple(r['tick'] for r in plan['selection'])
        winner = expected['winner']
        assert chosen == (winner[1] if winner else None), (row['name'], chosen, winner)
        if winner:
            assert plan['status'] == 'optimal_certified_control_box', (row['name'], plan['status'])
            assert plan['numReadings'] == len(chosen) and plan['totalCost'] == winner[0]
            controls = plan['chosenControls']
            assert len(controls) == len(request['controlBounds'])
            for control, bound in zip(controls, request['controlBounds']):
                assert len(control) == len(bound['min'])
                assert all(F(lo) <= F(value) <= F(hi) for value, lo, hi in zip(control, bound['min'], bound['max']))
            max_error = max(max_error, close(plan['proof'][0]['marginLowerBound'], winner[2], row['name']))
            laws = [dynamics(law, controls) for law in request['hypotheses']]
            rows = [laws[0][0][t] + [-v for v in laws[1][0][t]] for t in chosen]
            delta = [laws[1][1][t] - laws[0][1][t] for t in chosen]
            max_error = max(max_error, close(plan['proof'][0]['marginLowerBound'], distance(rows, delta), row['name']))
            initial = [str(F(i + 2, 3)) for i in range(len(request['hypotheses'][0]['A']))]
            _, observed = dynamics(request['hypotheses'][0], controls, initial)
            readouts, expectations = [], []
            for kind in ['full', 'partial', 'perturbed']:
                ticks = chosen if kind != 'partial' else chosen[:1]
                values = [observed[t] + (F(11 * (-1)**i) if kind == 'perturbed' else 0) for i, t in enumerate(ticks)]
                readout = dict(schema='worldlaw.active-linear-readings/v1', source='Independent Fraction forward recurrence with separately chosen initial state; ' + kind,
                    acquisition='synthetic', readings=[dict(tick=t, value=str(v)) for t, v in zip(ticks, values)])
                readouts.append(readout)
                margins = [distance([law[0][t] for t in ticks], [v - law[1][t] for v, t in zip(values, ticks)]) for law in laws]
                expectations.append(margins)
            readout_inputs.append(dict(request=request, readouts=readouts)); readout_expected.append(expectations)
        else:
            assert plan['chosenControls'] is None
            expected_status = 'structurally_indistinguishable_on_control_box' if expected['potential'] <= TOL else 'noise_separation_not_certified' if expected['potential'] <= 2 * float(F(request['noiseBound'])) + TOL else 'insufficient_reading_budget'
            assert plan['status'] == expected_status, (row['name'], plan['status'], expected_status)
        checks.append(dict(name=row['name'], selected=chosen, potential=expected['potential'], corners=expected['corners'], primalLPs=expected['primalLPs']))
    readout_count = 0
    for item, actual, expected in zip(readout_inputs, run_node(module, readout_inputs), readout_expected):
        eps = float(F(item['request']['noiseBound']))
        for result, margins in zip(actual['readouts'], expected):
            readout_count += 1
            consistent = []
            for check, margin in zip(result['checks'], margins):
                max_error = max(max_error, close(check['minimumNoiseRequired'], margin, 'readout'))
                wanted = 'falsified' if margin > eps + TOL else 'consistent'
                assert check['status'] == wanted, (check, margin, eps)
                if wanted == 'consistent': consistent.append(check['hypothesis'])
            assert result['consistentHypothesisIds'] == consistent
            wanted_status = 'all_hypotheses_falsified' if not consistent else 'one_hypothesis_consistent' if len(consistent) == 1 else 'multiple_hypotheses_consistent'
            assert result['status'] == wanted_status
    return dict(cases=len(cases), totalBoxCorners=total_corners, primalLPs=total_lps, separateReadouts=readout_count,
        absoluteTolerance=TOL, maximumAbsoluteError=max_error, failures=[], caseSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),
        candidateSHA256=hashlib.sha256(module.read_bytes()).hexdigest(), numpyVersion=np.__version__, checks=checks)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--module', type=Path, required=True); parser.add_argument('--cases', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); result = receive(args.module, args.cases)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'checks'}, sort_keys=True))
