#!/usr/bin/env python3
"""Frozen signed-cycle receiver for rank-complete affine circuit enumeration.

Locked before production changes. Seed 3540113; 64 untouched synthetic courses,
1-5 latent dimensions, up to three laws, 11 offered readings, primal HiGHS LP.
The original low-dimensional receiving evaluator is imported unchanged.
"""
import argparse
import copy
from fractions import Fraction
import hashlib
import importlib.util
import json
from pathlib import Path
import random
import statistics
import subprocess

SEED = 3540113
TOL = 1e-8
ORACLE_SHA = '2466079976b175ad27c52a0a0070c5bbcbd64e9cc66311de10afe41daf51e595'


def load_oracle(path):
    assert hashlib.sha256(path.read_bytes()).hexdigest() == ORACLE_SHA
    spec = importlib.util.spec_from_file_location('frozen_primal', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def cycle_law(rng, index, n, reverse):
    # Random signed coordinate permutations hide the authored latent basis.
    A = [[int(j == (i + 1) % n) for j in range(n)] for i in range(n)]
    A[-1][0] = -1 if reverse else 1
    B = [rng.choice([-2, -1, 0, 1, 2]) for _ in range(n)]
    B[0] = rng.choice([-2, -1, 1, 2])
    C = [0] * n
    C[rng.randrange(n)] = rng.choice([-1, 1])
    permutation = list(range(n))
    rng.shuffle(permutation)
    signs = [rng.choice([-1, 1]) for _ in range(n)]
    return dict(id=f'h{index}',
        A=[[signs[i] * A[permutation[i]][permutation[j]] * signs[j]
            for j in range(n)] for i in range(n)],
        B=[[signs[i] * B[permutation[i]]] for i in range(n)],
        C=[C[permutation[i]] * signs[i] for i in range(n)])


def courses():
    rng = random.Random(SEED)
    out = []
    for case in range(64):
        laws = []
        for model in range(3 if case % 4 == 0 else 2):
            n = 5 if case >= 32 else 1 + (case + 2 * model) % 5
            laws.append(cycle_law(rng, model, n, bool((case + model) % 2)))
        controls = [[rng.choice([-2, -1, 0, 1, 2])] for _ in range(10)]
        if case % 16 == 13:
            controls = [[0] for _ in range(10)]
        if case % 16 == 14:
            for law in laws:
                law['C'] = [0] * len(law['A'])
        if case % 16 == 15:
            laws[1] = {**copy.deepcopy(laws[0]), 'id': 'h1'}
        out.append(dict(schema='worldlaw.active-linear-family/v1',
            source=f'Frozen signed-cycle synthetic hidden-state holdout {case}; no physical acquisition',
            hypotheses=laws, controls=controls, offeredTicks=list(range(11)),
            maxReadings=2 if case % 7 == 0 else 8,
            costByTick={str(t): rng.randint(1, 5) for t in range(11)},
            noiseBound=rng.choice(['0', '1/100', '1/4', '1/2', '1']),
            workLimit=50000))
    return out


def anchor():
    n = 5
    A = [[int(j == (i + 1) % n) for j in range(n)] for i in range(n)]
    negative = copy.deepcopy(A)
    negative[-1][0] = -1
    B, C = [[int(i == 0)] for i in range(n)], [int(i == 0) for i in range(n)]
    return dict(schema='worldlaw.active-linear-family/v1',
        source='Analytic five-state signed-cycle anchor; hypothetical, no physical measurement',
        hypotheses=[dict(id='positive', A=A, B=B, C=C),
                    dict(id='negative', A=negative, B=B, C=C)],
        controls=[[int(i == 4)] for i in range(10)], offeredTicks=list(range(11)),
        maxReadings=8, noiseBound='1/4', workLimit=50000)


NODE = r'''
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const api=await import(pathToFileURL(process.argv[1]));
const input=JSON.parse(readFileSync(0,'utf8'));
api.designActiveLinearFamily(input.anchor);
const start=performance.now();
const actual=input.rows.map(row=>{
  const plan=api.designActiveLinearFamily(row.request);
  const readouts=plan.status==='optimal_certified_schedule'?
    row.readouts.map(r=>api.evaluateActiveLinearReadings(row.request,plan,r)):[];
  const bounded=api.designActiveLinearFamily({...row.request,workLimit:100});
  return {plan,readouts,bounded};
});
const cohortMs=performance.now()-start;
const t=performance.now();
const anchors=Array.from({length:8},()=>api.designActiveLinearFamily(input.anchor));
const anchorMs=(performance.now()-t)/anchors.length;
const boundedAnchor=api.designActiveLinearFamily({...input.anchor,workLimit:100});
process.stdout.write(JSON.stringify({actual,anchor:anchors[0],boundedAnchor,
  cohortMs,anchorMs,maxRssKiB:process.resourceUsage().maxRSS,cpu:process.cpuUsage()}));
'''


def run(module, inputs):
    proc = subprocess.run(['node', '--input-type=module', '-e', NODE, str(module.resolve())],
        input=json.dumps(inputs), text=True, capture_output=True, timeout=180)
    if proc.returncode:
        raise AssertionError(proc.stderr)
    return json.loads(proc.stdout)


def semantic(result):
    # Actual work counts and their description may change; scientific fields may not.
    if isinstance(result, dict):
        return {k: semantic(v) for k, v in result.items() if k not in ('nodes', 'workAccounting')}
    if isinstance(result, list):
        return [semantic(v) for v in result]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--oracle', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    oracle = load_oracle(args.oracle)
    rows, answers = [], []
    for case, request in enumerate(courses()):
        expected, curves = oracle.reference(request)
        observations, survivors = [], []
        if expected['best']:
            ticks = expected['best'][1]
            truth = oracle.rational_trajectory(request, 0, ticks)
            epsilon = Fraction(request['noiseBound'])
            for mode in ('bounded', 'outside', 'partial'):
                chosen = ticks[:1] if mode == 'partial' else ticks
                values = {t: truth[t] + epsilon * (1 if i % 2 else -1) / 2 +
                    (Fraction((i % 3) * 7 - 7) if mode == 'outside' else 0)
                    for i, t in enumerate(chosen)}
                observations.append(dict(schema='worldlaw.active-linear-readings/v1',
                    source=f'Frozen exact signed-cycle source case {case}, mode {mode}',
                    acquisition='synthetic', readings=[dict(tick=t, value=str(values[t])) for t in chosen]))
                keep = []
                for hi, (O, f) in enumerate(curves):
                    distance = oracle.primal_distance(O[list(chosen)],
                        oracle.np.array([float(values[t]) for t in chosen]) - f[list(chosen)])
                    if distance <= float(epsilon) + TOL:
                        keep.append(request['hypotheses'][hi]['id'])
                survivors.append(keep)
        rows.append(dict(request=request, readouts=observations))
        answers.append(dict(expected=expected, survivors=survivors))
    inputs = dict(rows=rows, anchor=anchor())
    samples = []
    for label, module in [('A', args.baseline), ('B', args.candidate),
                          ('B', args.candidate), ('A', args.baseline)]:
        result = run(module, inputs)
        samples.append(dict(label=label, result=result))
    a, b = samples[0]['result'], samples[1]['result']
    issues, errors = [], []
    readouts = bounded_certifications = baseline_bounded = 0
    for case, (old, new, reference) in enumerate(zip(a['actual'], b['actual'], answers)):
        if semantic(old['plan']) != semantic(new['plan']):
            issues.append(dict(case=case, failure='changed_scientific_plan'))
        if semantic(old['readouts']) != semantic(new['readouts']):
            issues.append(dict(case=case, failure='changed_readout_result'))
        best = reference['expected']['best']
        plan = new['plan']
        if best:
            if plan['status'] != 'optimal_certified_schedule' or (plan['numReadings'], plan['totalCost']) != (len(best[1]), best[0]):
                issues.append(dict(case=case, failure='wrong_optimal_schedule'))
        elif plan['selection'] is not None:
            issues.append(dict(case=case, failure='false_certified_schedule'))
        for pair, distance in zip(plan['potential'], reference['expected']['potential']):
            error = abs(oracle.number(pair['marginLowerBound']) - distance)
            errors.append(error)
            if error > TOL or pair['noiseMarginExact'] is not True:
                issues.append(dict(case=case, failure='wrong_exact_margin', error=error))
        for received, survivors in zip(new['readouts'], reference['survivors']):
            readouts += 1
            if received['consistentHypothesisIds'] != survivors:
                issues.append(dict(case=case, failure='wrong_readout_decision'))
        if len(new['readouts']) != len(reference['survivors']):
            issues.append(dict(case=case, failure='missing_readout_decision'))
        if new['bounded']['nodes'] > 100:
            issues.append(dict(case=case, failure='work_budget_exceeded'))
        for label, bounded in [('A', old['bounded']), ('B', new['bounded'])]:
            if bounded['status'] == 'optimal_certified_schedule':
                baseline_bounded += label == 'A'
                bounded_certifications += label == 'B'
                if not best or (bounded['numReadings'], bounded['totalCost']) != (len(best[1]), best[0]):
                    issues.append(dict(case=case, variant=label, failure='false_bounded_optimality'))
    expected_anchor = dict(status='optimal_certified_schedule', ticks=[0, 10], margin='1')
    for label, result in [('A', a), ('B', b)]:
        actual = result['anchor']
        got = dict(status=actual['status'], ticks=[r['tick'] for r in actual['selection']],
                   margin=actual['potential'][0]['marginLowerBound'])
        if got != expected_anchor:
            issues.append(dict(variant=label, failure='analytic_anchor', actual=got))
    if a['boundedAnchor']['status'] != 'search_inconclusive' or b['boundedAnchor']['status'] != 'optimal_certified_schedule':
        issues.append(dict(failure='analytic_bounded_anchor'))
    for sample in samples[2:]:
        first = a if sample['label'] == 'A' else b
        if semantic(sample['result']['actual']) != semantic(first['actual']):
            issues.append(dict(failure='restart_nondeterminism', variant=sample['label']))
    timings = {label: {key: statistics.median(s['result'][key] for s in samples if s['label'] == label)
                       for key in ('cohortMs', 'anchorMs', 'maxRssKiB')}
               for label in ('A', 'B')}
    summary = dict(seed=SEED, cases=len(rows), tolerance=TOL,
        pairMargins=len(errors), readoutCases=readouts, maxMarginError=max(errors),
        workLimit100Certified=dict(baseline=baseline_bounded, candidate=bounded_certifications),
        anchorWork=dict(baseline=a['anchor']['nodes'], candidate=b['anchor']['nodes']),
        abba=timings, anchorSpeedup=timings['A']['anchorMs']/timings['B']['anchorMs'],
        cohortSpeedup=timings['A']['cohortMs']/timings['B']['cohortMs'], issues=issues)
    report = dict(summary=summary, inputs=inputs, oracle=answers, samples=samples)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(summary, indent=2))
    if issues:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
