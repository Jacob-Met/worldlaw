#!/usr/bin/env python3
"""Frozen external primal-LP evaluator; no production algebra is imported.

Locked 2026-11-20 before solver changes. Seed 3511609; 48 courses; absolute
margin tolerance 1e-8; zero false positive schedules or readout decisions.
"""
import argparse
import itertools
import json
import os
from pathlib import Path
import random
import subprocess
from fractions import Fraction

import numpy as np
from scipy.optimize import linprog

SEED = 3511609
TOL = 1e-8


def courses():
    rng = random.Random(SEED)
    out = []
    for case in range(48):
        hypotheses = []
        count = 3 if case % 3 == 0 else 2
        for model in range(count):
            if case < 16:
                A = [[str(Fraction(rng.choice([-2, -1, 0, 1, 2]), rng.choice([2, 3])))]]
                B, C = [[rng.choice([-2, -1, 1, 2])]], [1]
            elif case < 32:
                A = [[1, rng.choice([-2, -1, 1, 2])], [0, str(Fraction(rng.choice([-1, 1, 2]), 2))]]
                B, C = [[rng.choice([0, 1])], [rng.choice([-1, 1])]], [1, 0]
            else:
                A = [[str(Fraction(rng.choice([-2, -1, 0, 1, 2]), 2)) for _ in range(2)] for _ in range(2)]
                B, C = [[rng.choice([-1, 0, 1])], [rng.choice([-1, 1])]], [1, rng.choice([-1, 0, 1])]
            hypotheses.append(dict(id=f'h{model}', A=A, B=B, C=C))
        controls = [[rng.choice([-2, -1, 0, 1, 2])] for _ in range(5)]
        if case >= 40:
            if case % 2:
                hypotheses[1] = {**hypotheses[0], 'id': 'h1'}
            else:
                controls = [[0] for _ in range(5)]
        out.append(dict(schema='worldlaw.active-linear-family/v1',
            source=f'Frozen independent primal-LP synthetic holdout {case}; no physical acquisition',
            hypotheses=hypotheses, controls=controls, offeredTicks=list(range(6)),
            maxReadings=4 if case % 5 == 0 else 6,
            costByTick={str(t): rng.randint(1, 5) for t in range(6)},
            noiseBound=rng.choice(['0', '1/100', '1/20', '1/5', '1/2']),
            workLimit=50000))
    return out


def number(x):
    return float(Fraction(x))


def trajectories(request):
    curves = []
    for h in request['hypotheses']:
        A, B, C = [np.array(v, dtype=object) for v in (h['A'], h['B'], h['C'])]
        A = np.vectorize(number)(A)
        B = np.vectorize(number)(B)
        C = np.vectorize(number)(C)
        power = np.eye(len(A))
        forced = np.zeros(len(A))
        O, f = [], []
        for tick in range(len(request['controls']) + 1):
            O.append(C @ power)
            f.append(C @ forced)
            if tick < len(request['controls']):
                power = power @ A
                forced = A @ forced + B @ np.array(request['controls'][tick])
        curves.append((np.array(O), np.array(f)))
    return curves


def primal_distance(matrix, delta):
    """Direct minimax residual LP, independent of nullspace/circuit construction."""
    n = matrix.shape[1]
    rows = np.column_stack([matrix, -np.ones(len(delta))])
    negatives = np.column_stack([-matrix, -np.ones(len(delta))])
    result = linprog(np.r_[np.zeros(n), 1.0],
        A_ub=np.vstack([rows, negatives]), b_ub=np.r_[delta, -delta],
        bounds=[(None, None)] * n + [(0, None)], method='highs')
    if not result.success:
        raise AssertionError(('independent LP failed', result.message))
    return result.fun


def reference(request):
    curves = trajectories(request)
    pairs = list(itertools.combinations(range(len(curves)), 2))
    epsilon = number(request['noiseBound'])
    def margins(ticks):
        indices = list(ticks)
        return [primal_distance(np.column_stack([curves[i][0][indices], -curves[j][0][indices]]),
            curves[j][1][indices] - curves[i][1][indices]) for i, j in pairs]
    best = None
    for size in range(1, request['maxReadings'] + 1):
        candidates = []
        for ticks in itertools.combinations(request['offeredTicks'], size):
            if all(m > 2 * epsilon + TOL for m in margins(ticks)):
                cost = sum(request['costByTick'][str(t)] for t in ticks)
                candidates.append((cost, ticks))
        if candidates:
            best = min(candidates)
            break
    return dict(best=best, potential=margins(request['offeredTicks'])), curves


NODE = r'''
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const api=await import(pathToFileURL(process.argv[1]));
const input=JSON.parse(readFileSync(0,'utf8'));
const output=input.map(x=>{
  const plan=api.designActiveLinearFamily(x.request);
  const readouts=x.readouts && api.evaluateActiveLinearReadings ?
    x.readouts.map(r=>api.evaluateActiveLinearReadings(x.request,plan,r)) : null;
  return {plan,readouts};
});
process.stdout.write(JSON.stringify(output));
'''


def run_node(module, inputs):
    p = subprocess.run(['node', '--input-type=module', '-e', NODE, str(module)],
        input=json.dumps(inputs), capture_output=True, text=True, timeout=180)
    if p.returncode:
        raise AssertionError(p.stderr)
    return json.loads(p.stdout)


def rational_trajectory(request, hindex, ticks):
    h = request['hypotheses'][hindex]
    A = [[Fraction(v) for v in r] for r in h['A']]
    B = [[Fraction(v) for v in r] for r in h['B']]
    C = [Fraction(v) for v in h['C']]
    state = [Fraction(3 - 2 * j) for j in range(len(A))]
    out = {}
    for t in range(len(request['controls']) + 1):
        if t in ticks:
            out[t] = sum(c * x for c, x in zip(C, state))
        if t < len(request['controls']):
            state = [sum(a * x for a, x in zip(row, state)) +
                sum(b * Fraction(u) for b, u in zip(B[i], request['controls'][t]))
                for i, row in enumerate(A)]
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--module', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--baseline', action='store_true')
    args = parser.parse_args()
    requests = courses()
    answers = []
    input_rows = []
    for index, request in enumerate(requests):
        expected, curves = reference(request)
        observations, survivor_sets = [], []
        if expected['best']:
            ticks = expected['best'][1]
            truth = rational_trajectory(request, 0, ticks)
            epsilon = Fraction(request['noiseBound'])
            noise = {t: epsilon * (1 if i % 2 else -1) / 2 for i, t in enumerate(ticks)}
            for mode in ('bounded', 'outside', 'partial'):
                chosen = ticks[:1] if mode == 'partial' else ticks
                values = {t: truth[t] + noise[t] + (Fraction((i % 3) * 7 - 7) if mode == 'outside' else 0)
                          for i, t in enumerate(chosen)}
                observations.append(dict(schema='worldlaw.active-linear-readings/v1',
                    source=f'Independent exact synthetic trajectory; case {index}; mode {mode}',
                    acquisition='synthetic', readings=[dict(tick=t, value=str(values[t])) for t in chosen]))
                survivors = []
                for hindex, (O, f) in enumerate(curves):
                    dist = primal_distance(O[list(chosen)], np.array([float(values[t]) for t in chosen]) - f[list(chosen)])
                    if dist <= float(epsilon) + TOL:
                        survivors.append(request['hypotheses'][hindex]['id'])
                survivor_sets.append(survivors)
        input_rows.append(dict(request=request, readouts=observations))
        answers.append(dict(expected=expected, survivors=survivor_sets))
    reports = run_node(args.module.resolve(), input_rows)
    issues, margin_errors, readout_count = [], [], 0
    for index, (got, answer) in enumerate(zip(reports, answers)):
        plan, expected = got['plan'], answer['expected']
        best = expected['best']
        if best:
            target = (len(best[1]), best[0])
            observed = (plan.get('numReadings'), plan.get('totalCost'))
            if plan['status'] != 'optimal_certified_schedule' or target != observed:
                issues.append(dict(case=index, failure='optimal_schedule', expected=target, actual=observed, status=plan['status']))
        elif plan['selection'] is not None:
            issues.append(dict(case=index, failure='false_certified_schedule', actual=plan['selection']))
        for pair, expected_margin in zip(plan['potential'], expected['potential']):
            actual_margin = number(pair['marginLowerBound'])
            error = abs(actual_margin - expected_margin)
            margin_errors.append(error)
            if error > TOL:
                issues.append(dict(case=index, pair=pair['pair'], failure='inexact_margin', expected=expected_margin, actual=actual_margin))
            if not args.baseline and pair.get('noiseMarginExact') is not True:
                issues.append(dict(case=index, failure='margin_not_certified_exact'))
        if not args.baseline:
            if got['readouts'] is None:
                issues.append(dict(case=index, failure='missing_readout_entrypoint'))
            else:
                for mode, result, survivors in zip(('bounded','outside','partial'), got['readouts'], answer['survivors']):
                    readout_count += 1
                    if result['consistentHypothesisIds'] != survivors:
                        issues.append(dict(case=index, mode=mode, failure='readout_decision', expected=survivors, actual=result))
    report = dict(seed=SEED, cases=len(requests), tolerance=TOL, baseline=args.baseline,
        readoutCases=readout_count, maxMarginError=max(margin_errors), issues=issues,
        requests=requests, oracle=answers, actual=reports)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k:report[k] for k in ('seed','cases','tolerance','baseline','readoutCases','maxMarginError','issues')}, indent=2))
    if issues and not args.baseline:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
