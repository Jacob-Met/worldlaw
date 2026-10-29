#!/usr/bin/env python3
"""Independent exact replay of WORLDLAW reflection JSON; no production imports.
Read one {caseId,input:{observations,declaration},result} envelope on stdin.
Numeric JSON values are interpreted as binary64, matching admitted JS numbers.
"""
import json
import math
import re
import sys
from fractions import Fraction as F


def check(condition, path):
    if not condition:
        raise ValueError(path)


def number(x):
    check(type(x) in (int, float), 'input number type')
    v = float(x)
    check(math.isfinite(v) and abs(v) <= 1e6, 'input number domain')
    return v


def exact(x):
    return F.from_float(number(x))


def q(x):
    check(isinstance(x, dict) and set(x) == {'numerator', 'denominator'}, 'Q shape')
    n, d = x['numerator'], x['denominator']
    check(isinstance(n, str) and isinstance(d, str) and len(n) <= 1300 and len(d) <= 1300, 'Q size/type')
    check(re.fullmatch(r'0|-?[1-9][0-9]*', n) and re.fullmatch(r'[1-9][0-9]*', d), 'Q integer spelling')
    value = F(int(n), int(d))
    check(str(value.numerator) == n and str(value.denominator) == d, 'Q must be reduced')
    return value


def interval(actual, expected, path):
    check(q(actual['lower']) == expected[0] and q(actual['upper']) == expected[1], path)


def verify(envelope):
    rows = envelope['input']['observations']
    declaration = envelope['input']['declaration']
    result = envelope['result']
    check(isinstance(rows, list) and len(rows) <= 4096, 'row count')
    for row in rows:
        for key in ('command', 'rate', 'position', 'jointTorque'):
            number(row[key])
    if any('torqueNoiseRatio' in row for row in rows):
        for row in rows:
            check(1e-6 <= number(row['torqueNoiseRatio']) <= 1e6, 'noise ratio admission')
    missing = [key for key in ('command', 'rate', 'absoluteTorqueError') if key not in declaration]
    if declaration.get('exactCoordinates') is not True:
        missing.append('exactCoordinates')
    for key in ('command', 'rate', 'absoluteTorqueError'):
        if key in declaration:
            number(declaration[key])
    if 'absoluteTorqueError' in declaration:
        check(declaration['absoluteTorqueError'] >= 0, 'negative radius')
    check(result['schema'] == 'worldlaw.reflection-compatibility/v1', 'schema')
    check(result['sourceRowCount'] == len(rows), 'sourceRowCount')
    if missing:
        check(result['status'] == 'declaration-required' and sorted(result['missing']) == sorted(missing), 'missing declaration')
        check(result.get('certificate') is None, 'undeclared certificate')
        return {'caseId': envelope.get('caseId'), 'verified': True, 'expectedClassification': 'declaration-required'}
    radius = exact(declaration['absoluteTorqueError'])
    for key in ('command', 'rate', 'absoluteTorqueError', 'exactCoordinates'):
        check(result['declaration'][key] == declaration[key], 'returned declaration.' + key)
    check(result['declaration']['angleOrigin'] == 0, 'origin')
    selected = [i for i, row in enumerate(rows) if number(row['command']) == number(declaration['command']) and number(row['rate']) == number(declaration['rate'])]
    check(result['selectedRowIndices'] == selected, 'selected row custody')
    groups = {}
    for i in selected:
        groups.setdefault(number(rows[i]['position']), []).append(i)
    positions = sorted(groups)
    states = []
    check(len(result['states']) == len(positions), 'state count')
    for si, pos in enumerate(positions):
        indices = groups[pos]
        bounds = [(exact(rows[i]['jointTorque']) - radius, exact(rows[i]['jointTorque']) + radius) for i in indices]
        lo, hi = max(v[0] for v in bounds), min(v[1] for v in bounds)
        li = next(i for i, b in zip(indices, bounds) if b[0] == lo)
        ui = next(i for i, b in zip(indices, bounds) if b[1] == hi)
        states.append((lo, hi, li, ui))
        actual = result['states'][si]
        check(actual['position'] == pos and actual['rowIndices'] == indices, 'state source identity')
        check(actual['lowerRowIndex'] == li and actual['upperRowIndex'] == ui, 'state extremum row')
        interval(actual['interval'], (lo, hi), 'state interval')
        check(len(actual['readingBounds']) == len(indices), 'reading bound count')
        for bound, i, expected in zip(actual['readingBounds'], indices, bounds):
            check(bound['rowIndex'] == i and exact(bound['observedTorque']) == exact(rows[i]['jointTorque']), 'original reading custody')
            interval(bound, expected, 'original reading bound')
    pairs = [(positions.index(-p), positions.index(p)) for p in positions if p > 0 and -p in groups]
    unmatched = [i for i, p in enumerate(positions) if p != 0 and -p not in groups]
    coverage = dict(selectedRows=len(selected), states=len(states), mirroredPairs=len(pairs), pairedRows=sum(len(groups[positions[i]]) + len(groups[positions[j]]) for i,j in pairs), zeroRows=len(groups.get(0, [])), unmatchedRows=sum(len(groups[positions[i]]) for i in unmatched))
    check(result['coverage'] == coverage, 'coverage')
    check(result['unmatchedStateIndices'] == unmatched, 'unmatched states')
    conflicts = [i for i, s in enumerate(states) if s[0] > s[1]]
    cert = result['certificate']
    constraints = []
    if conflicts:
        expected_status = 'repeat-conflict'
        si = conflicts[0]; lo, hi, li, ui = states[si]
        check(cert['kind'] == 'repeat-conflict' and cert['stateIndex'] == si and cert['lowerRowIndex'] == li and cert['upperRowIndex'] == ui and q(cert['gap']) == lo-hi, 'repeat certificate')
        check(result['constraints'] == [] and result['commonOffset'] is None, 'repeat conflict constraints')
    else:
        for ordinal, (negative, positive) in enumerate(pairs):
            constraints.append((f'pair-{ordinal}', 'pair', [negative, positive], ((states[negative][0]+states[positive][0])/2, (states[negative][1]+states[positive][1])/2)))
        if 0 in groups:
            si = positions.index(0)
            constraints.append(('zero', 'zero', [si], states[si][:2]))
        check(len(result['constraints']) == len(constraints), 'constraint count')
        for actual, (cid, kind, indices, bounds) in zip(result['constraints'], constraints):
            check(actual['id'] == cid and actual['kind'] == kind and actual['stateIndices'] == indices, 'constraint identity')
            check(actual['rowIndices'] == sorted(i for si in indices for i in groups[positions[si]]), 'constraint row custody')
            if kind == 'pair':
                check(actual['magnitude'] == positions[indices[1]], 'pair magnitude')
            interval(actual['interval'], bounds, 'constraint interval')
        common = (max(c[3][0] for c in constraints), min(c[3][1] for c in constraints)) if constraints else None
        if common is None:
            check(result['commonOffset'] is None, 'absent common offset')
        else:
            interval(result['commonOffset'], common, 'common offset')
        if not pairs:
            expected_status = 'insufficient'
            check(cert is None and result['reason'] == ('no-selected-rows' if not selected else 'no-mirrored-pairs'), 'insufficient evidence')
        elif common[0] > common[1]:
            expected_status = 'excluded'
            lower = next(c[0] for c in constraints if c[3][0] == common[0])
            upper = next(c[0] for c in constraints if c[3][1] == common[1])
            check(cert['kind'] == 'offset-exclusion' and cert['lowerConstraintId'] == lower and cert['upperConstraintId'] == upper and q(cert['gap']) == common[0]-common[1], 'exclusion certificate')
        else:
            expected_status = 'compatible'
            check(cert['kind'] == 'finite-witness', 'witness kind')
            offset = q(cert['offset'])
            check(common[0] <= offset <= common[1], 'witness offset')
            torques = cert['stateTorques']
            check(len(torques) == len(states) and sorted(t['stateIndex'] for t in torques) == list(range(len(states))), 'witness state coverage')
            values = {t['stateIndex']: q(t['torque']) for t in torques}
            for si, pos in enumerate(positions):
                for i in groups[pos]:
                    check(abs(values[si]-exact(rows[i]['jointTorque'])) <= radius, 'witness original bound')
            for ni, pi in pairs:
                check(values[ni] + values[pi] == 2*offset, 'witness reflection')
            if 0 in groups:
                check(values[positions.index(0)] == offset, 'witness zero anchor')
    check(result['status'] == expected_status, 'classification')
    return {'caseId': envelope.get('caseId'), 'verified': True, 'expectedClassification': expected_status, 'selectedRows': len(selected), 'reflectedPairs': len(pairs), 'checkedWitnessRows': len(selected) if expected_status == 'compatible' else 0, 'checkedCertificateConstraints': len(constraints)}


if __name__ == '__main__':
    try:
        print(json.dumps(verify(json.load(sys.stdin)), allow_nan=False))
    except (ValueError, KeyError, TypeError, OverflowError, IndexError) as error:
        print(json.dumps({'verified': False, 'error': str(error)}), file=sys.stderr)
        sys.exit(1)
