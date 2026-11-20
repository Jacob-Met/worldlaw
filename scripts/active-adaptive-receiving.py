#!/usr/bin/env python3
"""Receive the candidate against the unchanged preimplementation exact oracle."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import subprocess
from fractions import Fraction as F
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--module', type=Path, default=Path('src/science/active-linear-adaptive.mjs'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    fixture = Path('tests/fixtures/active-adaptive-baseline')
    manifest = json.loads((fixture / 'lock-manifest.json').read_text())
    assert hashlib.sha256((fixture / 'lock-manifest.json').read_bytes()).hexdigest() == '5402f3c2259977ca0dc947c7925a48e7cba9085aefe381499dbfa9ac1000bc8b'
    for row in manifest['files']:
        data = (fixture / row['path']).read_bytes()
        assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']
    spec = importlib.util.spec_from_file_location('frozen_adaptive_oracle', fixture / 'reference.py')
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    courses = json.loads((fixture / 'cases.json').read_text())['cases']
    script = '''
      import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
      const api=await import(pathToFileURL(process.argv[1]));
      const rows=JSON.parse(readFileSync(0,'utf8'));
      process.stdout.write(JSON.stringify(rows.map(row=>({id:row.id,plan:api.designActiveLinearAdaptive(row.request)}))));
    '''
    process = subprocess.run(['node', '--max-old-space-size=1536', '--input-type=module', '-e', script,
                              str(args.module.resolve())], input=json.dumps(courses), text=True,
                             capture_output=True, check=True, timeout=300)
    candidates = json.loads(process.stdout)
    receipts = []
    certificates = states = improvements = 0
    max_nodes = 0
    for course, candidate in zip(courses, candidates, strict=True):
        assert candidate['id'] == course['id']
        reference = oracle.solve(course['request'])
        plan = candidate['plan']
        assert not plan['exhausted'], (course['id'], 'candidate exhausted', plan['nodes'])
        max_nodes = max(max_nodes, plan['nodes'])
        assert len(plan['geometry']) == len(reference['geometry'])
        eps = F(course['request']['noiseBound'])
        for action, received, expected in zip(course['request']['experiments'], plan['geometry'], reference['geometry'], strict=True):
            assert received['complete'] and received['experimentId'] == action['id'] == expected['experimentId']
            images = oracle.compile_images(course['request'], action)
            assert received['maximalMasks'] == expected['maximalMasks']
            assert len(received['intersections']) == len(expected['intersections'])
            for actual, wanted in zip(received['intersections'], expected['intersections'], strict=True):
                assert actual['mask'] == wanted['mask']
                assert F(actual['radius']) == F(wanted['radius']), (course['id'], action['id'], actual['mask'])
                assert actual['feasible'] == wanted['feasible'] == (F(actual['radius']) <= eps)
                selected = [image for i, image in enumerate(images) if actual['mask'] & (1 << i)]
                assert actual['hypothesisIds'] == [image['id'] for image in selected]
                cert = actual['certificate']
                assert [row['hypothesis'] for row in cert['initialStates']] == actual['hypothesisIds']
                assert [row['hypothesis'] for row in cert['weights']] == actual['hypothesisIds']
                oracle.verify_radius(selected, F(actual['radius']), [F(v) for v in cert['centre']],
                                     [[F(v) for v in row['values']] for row in cert['initialStates']],
                                     [[F(v) for v in row['values']] for row in cert['weights']])
                certificates += 1
        if reference['static'] is None:
            assert plan['status'] == 'no_guaranteed_policy'
            assert plan['policy'] is None and plan['staticPlan'] is None
        else:
            static = plan['staticPlan']
            assert (static['readings'], static['cost'], static['mask']) == reference['static']['score']
            assert static['experiments'] == reference['static']['actions']
            if reference['root'] is None:
                assert plan['status'] == 'insufficient_total_reading_budget' and plan['policy'] is None
            else:
                assert plan['status'] == 'optimal_certified_adaptive_policy'
                assert plan['worstReadings'] == reference['root']['budget']
                assert plan['worstCost'] == reference['root']['cost']
                simplified = [{key: node[key] for key in ['mask', 'budget', 'cost', 'action', 'actualReadings']}
                              for node in plan['policy']['states']]
                assert simplified == reference['states'], (course['id'], 'frozen policy state mismatch')
                for node in plan['policy']['states']:
                    action_index = next(i for i, a in enumerate(course['request']['experiments']) if a['id'] == node['action'])
                    possible = [row['mask'] for row in reference['geometry'][action_index]['intersections'] if row['feasible']]
                    assert node['branchMasks'] == oracle.maximal_masks(possible, node['mask'])
                    assert node['remainingAfterAction'] == node['budget'] - len(course['request']['experiments'][action_index]['readings'])
                states += len(simplified)
                improvements += plan['worstReadings'] < static['readings']
        receipt = {'id': course['id'], 'status': plan['status'], 'adaptiveReadings': plan['worstReadings'],
                   'adaptiveWorstCost': plan['worstCost'], 'static': plan['staticPlan'], 'nodes': plan['nodes']}
        receipts.append(receipt)
        print(json.dumps(receipt), flush=True)
    result = {'schema': 'worldlaw.adaptive-independent-receiving/v1', 'sourceCases': len(courses),
              'exactCommonTubeCertificates': certificates, 'exactPolicyStates': states,
              'coursesWithStrictWorstReadingImprovement': improvements, 'maximumBudgetNodes': max_nodes,
              'failures': 0, 'moduleSHA256': hashlib.sha256(args.module.read_bytes()).hexdigest(),
              'frozenProtocolSHA256': 'b309ed96dc319df87fc4f33c4ad4148e6eb51ff02f4646b4db76c12fb6e3b981',
              'scope': 'Exact finite-family source design. Separate synthetic acquisition and physical provenance are distinct.',
              'receipts': receipts}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    (args.output.parent / 'candidate-plans.json').write_text(json.dumps(candidates, indent=2) + '\n')
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'receipts'}))


if __name__ == '__main__':
    main()
