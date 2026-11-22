#!/usr/bin/env python3
"""Independent exact point-response oracle for required experiment coverage.

This receiver enumerates observation cells using Python Fraction arithmetic.
It does not import the production geometry, state traversal or certificates.
These are synthetic finite-family qualification cases, not physical discovery.
"""
import argparse
from fractions import Fraction as Q
from functools import lru_cache
from hashlib import sha256
from itertools import product
import json
from pathlib import Path
import random
import subprocess
import time


def outcomes(points, epsilon):
    """All nonempty exact survivor sets attained by a real observation."""
    axes = []
    for j in range(len(points[0])):
        boundaries = sorted({p[j] + sign * epsilon for p in points for sign in (-1, 1)})
        axes.append(boundaries + [(a + b) / 2 for a, b in zip(boundaries, boundaries[1:])]
                    + [boundaries[0] - 1, boundaries[-1] + 1])
    masks = set()
    for observation in product(*axes):
        mask = sum(1 << h for h, point in enumerate(points)
                   if all(abs(a - b) <= epsilon for a, b in zip(point, observation)))
        if mask:
            masks.add(mask)
    return tuple(sorted(masks))


def reference(source):
    epsilon = Q(source['noiseBound'])
    full = (1 << len(source['hypotheses'])) - 1
    actions = []
    required = sum(1 << a for a, e in enumerate(source['experiments'])
                   if e['id'] in source['requiredExperiments'])
    if 'requiredInputDiversity' in source:
        chosen = [e for i, e in enumerate(source['experiments']) if required >> i & 1]
        width = max(e['readings'][-1]['tick'] for e in chosen) * len(chosen[0]['controls'][0])
        matrix = [tuple([Q(v) for row in e['controls'][:e['readings'][-1]['tick']] for v in row] +
                        [Q(0)] * (width - e['readings'][-1]['tick'] * len(e['controls'][0]))) for e in chosen]
        distinct, basis = len(set(matrix)), {}
        for original in matrix:
            row = list(original)
            for pivot, vector in sorted(basis.items()):
                factor = row[pivot]
                row = [a - factor * b for a, b in zip(row, vector)]
            pivot = next((i for i, v in enumerate(row) if v), None)
            if pivot is not None:
                basis[pivot] = [v / row[pivot] for v in row]
        requirement = source['requiredInputDiversity']
        if distinct < requirement['minimumDistinct'] or len(basis) < requirement['minimumRank']:
            return {'status': 'insufficient_required_input_diversity', 'worstReadings': None,
                    'worstCost': None, 'static': None}
    for e in source['experiments']:
        points = [[sum(Q(b) * Q(u) for b, u in zip(h['B'][0], e['controls'][r['tick'] - 1]))
                   for r in e['readings']] for h in source['hypotheses']]
        actions.append((len(e['readings']), e['actuationCost'] + sum(r['cost'] for r in e['readings']),
                        outcomes(points, epsilon)))
    static = None
    for selected in range(1, 1 << len(actions)):
        if selected & required != required:
            continue
        pairs = [(1 << a) | (1 << b) for a in range(len(source['hypotheses']))
                 for b in range(a + 1, len(source['hypotheses']))]
        if any(all(any(mask & pair == pair for mask in action[2])
                   for i, action in enumerate(actions) if selected >> i & 1) for pair in pairs):
            continue
        value = (sum(a[0] for i, a in enumerate(actions) if selected >> i & 1),
                 sum(a[1] for i, a in enumerate(actions) if selected >> i & 1))
        if static is None or value < static:
            static = value
    if static is None:
        return {'status': 'no_guaranteed_policy', 'worstReadings': None, 'worstCost': None, 'static': None}

    @lru_cache(None)
    def solve(survivors, remaining, covered):
        if survivors.bit_count() == 1 and covered & required == required:
            return 0
        best = None
        for index, (readings, cost, observed) in enumerate(actions):
            if readings > remaining:
                continue
            next_covered = covered | ((1 << index) & required)
            children = {survivors & mask for mask in observed} - {0}
            if survivors in children and next_covered == covered:
                continue
            costs = [solve(mask, remaining - readings, next_covered) for mask in children]
            if any(value is None for value in costs):
                continue
            value = cost + max(costs)
            best = value if best is None else min(best, value)
        return best

    for readings in range(1, source['maxTotalReadings'] + 1):
        cost = solve(full, readings, 0)
        if cost is not None:
            return {'status': 'optimal_certified_adaptive_policy', 'worstReadings': readings,
                    'worstCost': cost, 'static': list(static)}
    return {'status': 'insufficient_total_reading_budget', 'worstReadings': None,
            'worstCost': None, 'static': list(static)}


def make_case(rng, index, input_diversity=False):
    laws, channels, experiments = rng.randint(2, 5), rng.randint(1, 4), rng.randint(1, 6)
    vectors = [[rng.randint(-3, 3) for _ in range(channels)] for _ in range(laws)]
    actions = []
    for i in range(experiments):
        count = rng.randint(1, 2)
        controls = [[rng.randint(-2, 2) for _ in range(channels)] for _ in range(count)] + [[0] * channels]
        actions.append({'id': f'probe_{i}', 'controls': controls,
                        'readings': [{'tick': j + 1, 'cost': rng.randint(1, 5)} for j in range(count)],
                        'actuationCost': rng.randint(0, 8)})
    required = rng.sample([a['id'] for a in actions], rng.randint(1, experiments))
    source = {'schema': 'worldlaw.active-linear-adaptive/v1',
            'source': f'Independent seeded exact point-response qualification case {index}; synthetic only.',
            'resetSemantics': 'independent-unknown-state-per-experiment',
            'hypotheses': [{'id': f'law_{i}', 'A': [[0]], 'B': [b], 'C': [1]} for i, b in enumerate(vectors)],
            'experiments': actions, 'requiredExperiments': required,
            'noiseBound': rng.choice(['0', '1/2', '1', '3/2']),
            'maxTotalReadings': rng.randint(1, min(16, sum(len(a['readings']) for a in actions) + 2)),
            'workLimit': 50000}
    if input_diversity and len(actions) >= 2:
        if len(required) < 2:
            source['requiredExperiments'] = rng.sample([a['id'] for a in actions], 2)
        distinct = rng.randint(2, len(source['requiredExperiments']))
        source['requiredInputDiversity'] = {'minimumDistinct': distinct, 'minimumRank': rng.randint(1, distinct)}
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=int, default=512)
    parser.add_argument('--seed', type=int, default=580722)
    parser.add_argument('--require-input-diversity', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.cases <= 10000:
        parser.error('--cases must be 1..10000')
    if args.output.exists():
        parser.error('output already exists; retain the earlier receipt')
    root = Path(__file__).resolve().parents[1]
    rng = random.Random(args.seed)
    cases = [make_case(rng, i, args.require_input_diversity) for i in range(args.cases)]
    started = time.monotonic()
    expected = [reference(case) for case in cases]
    payload = json.dumps(cases, sort_keys=True, separators=(',', ':'))
    runner = '''import fs from 'node:fs';
import {designActiveLinearAdaptive} from './src/science/active-linear-adaptive.mjs';
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(cases.map(source=>{const plan=designActiveLinearAdaptive(source);
return {status:plan.status,worstReadings:plan.worstReadings,worstCost:plan.worstCost,
static:plan.staticPlan?[plan.staticPlan.readings,plan.staticPlan.cost]:null,nodes:plan.nodes};})));'''
    native = subprocess.run(['node', '--input-type=module', '-e', runner], cwd=root,
                            input=payload, text=True, capture_output=True, check=True, timeout=3600)
    actual = json.loads(native.stdout)
    mismatches, status_counts, inconclusive = [], {}, []
    for index, (wanted, received) in enumerate(zip(expected, actual, strict=True)):
        status = received['status']
        status_counts[status] = status_counts.get(status, 0) + 1
        if status == 'search_inconclusive':
            inconclusive.append(index)
        elif {k: received[k] for k in wanted} != wanted:
            mismatches.append({'index': index, 'expected': wanted, 'received': received, 'source': cases[index]})
    receipt = {'schema': 'worldlaw.required-experiment-receiving/v1', 'seed': args.seed,
               'cases': args.cases, 'sourceSHA256': sha256(payload.encode()).hexdigest(),
               'inputDiversityCases': sum('requiredInputDiversity' in case for case in cases),
               'oracle': 'independent Fraction observation-cell enumeration and finite-budget minimax',
               'scope': 'Synthetic exact point-response families; no physical provenance or unrestricted discovery claim.',
               'statusCounts': status_counts, 'inconclusive': inconclusive, 'mismatches': mismatches,
               'elapsedSeconds': time.monotonic() - started,
               'casesAndExpected': [{'source': c, 'expected': e, 'actual': a} for c, e, a in zip(cases, expected, actual)]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: v for k, v in receipt.items() if k != 'casesAndExpected'}), flush=True)
    if mismatches or inconclusive:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
