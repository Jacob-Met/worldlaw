#!/usr/bin/env python3
"""Recount the frozen noisy-state course without importing its learner or scorer.

Reads the original GitHub artifact ZIPs directly. Reconstructs shuffled test
references, independently checks prefix initialization, and scores every saved
forecast. This validates the retained observations and arithmetic, not the
scientific adequacy of the predictive screen.
"""
import argparse
from copy import deepcopy
from collections import defaultdict
from fractions import Fraction
import json
import math
from pathlib import Path
import zipfile

WORLDS = [
    'duffing_double_well', 'van_der_pol', 'rayleigh', 'cubic_drag',
    'quadratic_drag_pendulum', 'saturating_restoring', 'saturating_drag',
    'rational_restoring', 'parametric_stiffness', 'phase_modulated_forcing',
    'position_dependent_drag', 'asymmetric_trigonometric',
    'linear_reaction_diffusion', 'fisher_kpp', 'allen_cahn',
    'cubic_conservation', 'forced_viscous_burgers', 'porous_diffusion',
    'sine_reaction_diffusion', 'saturating_flux',
]
OUTSIDE = ['outside_delay', 'outside_projected_lorenz', 'outside_nonlocal', 'outside_dispersion']
METHODS = ['weak_beam', 'weak_stlsq', 'derivative_stlsq']
SNRS = [40, 25, 15]
PRODUCER = '4af7717a866e0246e7c0bcd81977cea53cddbd8c'
KEYS = ['world', 'snrDb', 'control', 'method', 'acquisition']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def close(a, b, label, tolerance=2e-11):
    require(isinstance(a, (int, float)) and isinstance(b, (int, float))
            and math.isfinite(a) and math.isfinite(b)
            and abs(a-b) <= tolerance * max(1, abs(a), abs(b)), label)


def key(row):
    return tuple(row[k] for k in KEYS)


def registered_keys(shard, shards):
    expected = set()
    for wi, world in enumerate(WORLDS):
        if wi % shards != shard:
            continue
        for snr in SNRS:
            for method in METHODS:
                expected.add((world, snr, 'law', method, 'active'))
                expected.add((world, snr, 'law', method, 'random'))
                expected.add((world, snr, 'time_permutation', method, 'random'))
    for wi, world in enumerate(OUTSIDE):
        if wi % shards == shard:
            for snr in SNRS:
                for method in METHODS:
                    expected.add((world, snr, 'omitted_mechanism', method, 'random'))
    return expected


def check_denominator(summary):
    p = summary['provenance']
    require(p['nullgarden'] == PRODUCER, 'Producer source changed')
    require(isinstance(p['shard'], int) and 0 <= p['shard'] < p['shards'] <= 6,
            'Invalid shard identity')
    observed = [key(row) for row in summary['rows']]
    require(len(observed) == len(set(observed)), 'Repeated result row')
    require(set(observed) == registered_keys(p['shard'], p['shards']),
            'Missing or unregistered attempted row')
    require(summary['totalRows'] == len(observed), 'Incorrect total denominator')


def permutation(n, seed):
    # Independently express the registered xorshift32/Fisher-Yates permutation.
    result = list(range(n))
    state = seed & 0xffffffff
    for i in range(n-1, 0, -1):
        state = (state ^ (state << 13)) & 0xffffffff
        state = state ^ (state >> 17)
        state = (state ^ (state << 5)) & 0xffffffff
        j = (state * (i+1)) // 4294967296
        result[i], result[j] = result[j], result[i]
    return result


def prefix_weights():
    # Exact rational normal equations for an endpoint cubic on eleven samples.
    # No production QR or smoothing weights are called or copied.
    design = [[Fraction(j-10, 5)**degree for degree in range(4)] for j in range(11)]
    matrix = [[sum(row[i]*row[j] for row in design) for j in range(4)]
              + [Fraction(i == 0)] for i in range(4)]
    for j in range(4):
        pivot = next(i for i in range(j, 4) if matrix[i][j])
        matrix[j], matrix[pivot] = matrix[pivot], matrix[j]
        scale = matrix[j][j]
        matrix[j] = [x/scale for x in matrix[j]]
        for i in range(4):
            if i != j:
                scale = matrix[i][j]
                matrix[i] = [a-scale*b for a, b in zip(matrix[i], matrix[j])]
    return [float(sum(row[j]*matrix[j][-1] for j in range(4))) for row in design]


PREFIX = prefix_weights()


def score(predictions, reference, start):
    require(len(predictions) == len(reference)-start, 'Incomplete saved forecast')
    n = len(reference[0])
    require(all(len(row) == n and all(math.isfinite(x) for x in row)
                for row in predictions), 'Malformed forecast state')
    squared = signal = 0.0
    count = 0
    for predicted, truth in zip(predictions[1:], reference[start+1:]):
        for x, y in zip(predicted, truth):
            squared += (x-y)**2
            signal += y*y
            count += 1
    require(count > 0, 'Empty forecast score')
    raw = math.sqrt(squared/max(signal, count*1e-8))
    return min(10, raw), raw


def verify_forecast(row, records):
    require(row['chargedRecordings'] == 4, 'Acquisition budget changed')
    require(row['structuralIdentification'] is False, 'Unexpected structural claim')
    require(row['status'] in ['abstained', 'predictive_candidate'], 'Unknown screen status')
    outside = row['control'] == 'omitted_mechanism'
    world_index = (OUTSIDE if outside else WORLDS).index(row['world'])
    snr_index = SNRS.index(row['snrDb'])
    expected_random = ((world_index+snr_index) if outside else
                       (world_index*131+snr_index*17+11)) % 3
    require(row['query'] in [0, 1, 2], 'Unregistered query')
    if row['acquisition'] == 'random':
        require(row['query'] == expected_random, 'Random query changed')
    if row.get('fitFailure'):
        require(row['loss'] == 10 and row['diverged'] and row['status'] == 'abstained',
                'Fit failure escaped the penalty denominator')
        return 0.0
    if row['acquisition'] == 'active':
        selected = row['planning'].get('selected')
        if row['planningFallback']:
            require(selected not in ['query0', 'query1', 'query2'] and row['query'] == 0,
                    'Planning fallback changed')
        else:
            require(selected == 'query'+str(row['query']), 'Active query differs from selection')
    if outside:
        require(len(records) == 5, 'Incomplete omitted-mechanism observations')
        held = records[4]
    else:
        require('query'+str(row['query']) in records, 'Chosen query observation absent')
        held = records['test']
    reference = held['reference']['states']
    samples = held['observation']['samples']
    require(len(samples) == len(reference) == 401, 'Observation count changed')
    n = 2 if row['kind'] == 'oscillator' else 32
    require(all(len(x) == n for x in reference), 'Reference geometry changed')
    require(held['reference']['world'] == row['world'] and
            held['reference']['snrDb'] == row['snrDb'] and
            held['reference']['integratorSubsteps'] == 24, 'Reference protocol changed')
    require(row['chargedStateValues'] == 4*401*n, 'State-value budget changed')
    if row['control'] == 'time_permutation':
        seed = 57193+1000*world_index+100*snr_index+905
        order = permutation(401, seed)
        reference = [reference[i] for i in order]
        samples = [samples[i] for i in order]
    if row['diverged']:
        require(row['predictions'] is None and row['loss'] == 10
                and row['rawRelativeError'] is None, 'Divergence penalty changed')
        return 0.0
    require(row['startIndex'] == 10, 'Forecast initialization window changed')
    forecast = row['predictions']
    for d in range(n):
        initial = sum(w*samples[j]['state'][d] for j, w in enumerate(PREFIX))
        close(forecast[0][d], initial, 'Forecast prefix initialization mismatch', 2e-9)
    loss, raw = score(forecast, reference, 10)
    close(row['loss'], loss, 'Saved loss differs from independent score')
    close(row['rawRelativeError'], raw, 'Saved raw error differs from independent score')
    return abs(row['loss']-loss)


def grouped(rows):
    groups = defaultdict(list)
    for row in rows:
        groups['/'.join(str(row[k]) for k in ['control','method','acquisition','snrDb'])].append(row)
    return {k: {'count': len(rs), 'meanLoss': sum(r['loss'] for r in rs)/len(rs),
                'worstLoss': max(r['loss'] for r in rs),
                'predictiveCandidates': sum(r['status'] == 'predictive_candidate' for r in rs),
                'diverged': sum(r['diverged'] for r in rs),
                'fitFailures': sum(bool(r.get('fitFailure')) for r in rs)}
            for k, rs in groups.items()}


def check_groups(rows, saved):
    actual = grouped(rows)
    require(actual.keys() == saved.keys(), 'Summary groups changed')
    for key, group in actual.items():
        for metric, value in group.items():
            close(saved[key][metric], value, 'Incorrect summary '+key+'/'+metric)


def replay(paths):
    rows = []
    provenances = []
    max_difference = 0.0
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            summary = json.loads(archive.read('summary.json'))
            check_denominator(summary)
            check_groups(summary['rows'], summary['groups'])
            provenances.append(summary['provenance'])
            cache_key, records = None, None
            for row in sorted(summary['rows'], key=lambda r:(r['world'], r['snrDb'])):
                record_key = (row['world'], row['snrDb'])
                if record_key != cache_key:
                    records = json.loads(archive.read('cases/%s-%s-observations.json' % record_key))
                    cache_key = record_key
                if row.get('fitFailure'):
                    full = row
                else:
                    name = 'cases/%s-%s-%s-%s-%s.json' % key(row)
                    full = json.loads(archive.read(name))
                    require({k:v for k,v in full.items() if k != 'predictions'} == row,
                            'Summary differs from saved case '+name)
                max_difference = max(max_difference, verify_forecast(full, records))
                rows.append(row)
    require(len(set(p['shard'] for p in provenances)) == len(provenances), 'Repeated artifact shard')
    require(len(set((p['worldlaw'], p['nullgarden'], p['node'], p['shards']) for p in provenances)) == 1,
            'Artifacts come from different courses')
    require({p['shard'] for p in provenances} == set(range(provenances[0]['shards'])),
            'Complete course requires every shard')
    require(len(rows) == 576 and len(set(key(r) for r in rows)) == 576, 'Incomplete complete-course denominator')
    aggregate = []
    for method in METHODS:
        for acquisition in ['active', 'random']:
            for snr in [None, *SNRS]:
                cell = [r for r in rows if r['control']=='law' and r['method']==method
                        and r['acquisition']==acquisition and (snr is None or r['snrDb']==snr)]
                aggregate.append({'method':method,'acquisition':acquisition,'snrDb':snr,
                    'count':len(cell),'meanLoss':sum(r['loss'] for r in cell)/len(cell),
                    'worst':max(cell,key=lambda r:r['loss']),
                    'accepted':sum(r['status']=='predictive_candidate' for r in cell)})
    pairs = []
    lookup = {key(r):r for r in rows}
    for method in METHODS:
        deltas = [(w,s,lookup[(w,s,'law',method,'active')]['loss']-
                   lookup[(w,s,'law',method,'random')]['loss']) for w in WORLDS for s in SNRS]
        pairs.append({'method':method,'wins':sum(d < -1e-10 for _,_,d in deltas),
                      'ties':sum(abs(d) <= 1e-10 for _,_,d in deltas),
                      'losses':sum(d > 1e-10 for _,_,d in deltas),
                      'meanActiveMinusRandom':sum(d for _,_,d in deltas)/60,
                      'worstRegret':max(deltas,key=lambda r:r[2]),
                      'bestGain':min(deltas,key=lambda r:r[2])})
    controls = []
    for method in METHODS:
        for control in ['time_permutation','omitted_mechanism']:
            cell=[r for r in rows if r['method']==method and r['control']==control]
            controls.append({'method':method,'control':control,'count':len(cell),
                             'accepted':sum(r['status']=='predictive_candidate' for r in cell)})
    return {'provenance':provenances,'totalRows':len(rows),'maxScoreDifference':max_difference,
            'groups':grouped(rows),'aggregate':aggregate,'pairedAcquisition':pairs,'controls':controls,
            'rows':rows}


def negative_controls(path):
    rejected = []
    def refuses(name, action):
        try:
            action()
        except (ValueError, KeyError):
            rejected.append(name)
        else:
            raise ValueError('Mutated result was accepted: '+name)
    with zipfile.ZipFile(path) as archive:
        summary = json.loads(archive.read('summary.json'))
        missing = deepcopy(summary); missing['rows'].pop()
        refuses('missing_attempt', lambda:check_denominator(missing))
        duplicate = deepcopy(summary); duplicate['rows'].append(duplicate['rows'][0])
        refuses('repeated_attempt', lambda:check_denominator(duplicate))
        denominator = deepcopy(summary); denominator['totalRows'] += 1
        refuses('changed_denominator', lambda:check_denominator(denominator))
        aggregate = deepcopy(summary['groups'])
        aggregate[next(iter(aggregate))]['meanLoss'] += .1
        refuses('changed_group_mean', lambda:check_groups(summary['rows'],aggregate))
        row = next(r for r in summary['rows'] if r['control']=='law' and
                   r['acquisition']=='active' and not r['diverged'] and not r.get('fitFailure'))
        full = json.loads(archive.read('cases/%s-%s-%s-%s-%s.json' % key(row)))
        records = json.loads(archive.read('cases/%s-%s-observations.json' % (row['world'],row['snrDb'])))
        changed = deepcopy(full); changed['predictions'][0][0] += 1
        refuses('changed_prefix', lambda:verify_forecast(changed,records))
        changed_loss = deepcopy(full); changed_loss['loss'] += .1
        refuses('changed_loss', lambda:verify_forecast(changed_loss,records))
        changed_query = deepcopy(full); changed_query['query'] = (changed_query['query']+1)%3
        refuses('changed_acquisition', lambda:verify_forecast(changed_query,records))
        structural = deepcopy(full); structural['structuralIdentification'] = True
        refuses('false_structural_claim', lambda:verify_forecast(structural,records))
        shuffled = next(r for r in summary['rows'] if r['control']=='time_permutation'
                        and not r['diverged'] and not r.get('fitFailure'))
        changed_control = json.loads(archive.read('cases/%s-%s-%s-%s-%s.json' % key(shuffled)))
        shuffled_records = json.loads(archive.read('cases/%s-%s-observations.json' % (shuffled['world'],shuffled['snrDb'])))
        changed_control['control'] = 'law'
        refuses('omitted_test_permutation', lambda:verify_forecast(changed_control,shuffled_records))
    return rejected


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('artifacts',nargs='+',type=Path)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    result=replay(args.artifacts)
    result['rejectedMutations']=negative_controls(args.artifacts[0])
    if args.output:
        args.output.write_text(json.dumps(result,indent=2)+'\n')
    concise={k:v for k,v in result.items() if k not in ['groups','aggregate','rows']}
    concise['overall']=[{k:v for k,v in r.items() if k!='worst'} | {
        'worstWorld':r['worst']['world'],'worstSnr':r['worst']['snrDb'],'worstLoss':r['worst']['loss']}
        for r in result['aggregate'] if r['snrDb'] is None]
    print(json.dumps(concise,indent=2))


if __name__ == '__main__':
    main()
