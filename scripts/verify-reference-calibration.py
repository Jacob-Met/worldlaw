"""Check a repeated-reference boundary in the original rate equations, without expanding its pulse count."""
import argparse
from fractions import Fraction as F
import json
from pathlib import Path


def require(ok, why):
    if not ok:
        raise ValueError(why)


def rational(value):
    require(type(value) in (int, str), 'expected an exact rational')
    return F(value)


def positive(raw):
    value = rational(raw)
    require(value.denominator == 1 and value > 0, 'expected a positive integer')
    return int(value)


def optimal_dwells(h):
    # Independent discrete proof: f(k+1) - f(k) has the sign of this polynomial.
    def change(k):
        return h*h - (8*k+4)*h + 8*k*(k+1)
    require(h >= 6, 'pulse budget too small')
    lo, hi = 1, h//6
    while lo < hi:
        middle = (lo+hi)//2
        if change(middle) > 0:
            lo = middle+1
        else:
            hi = middle
    return [lo,lo+1] if lo < h//6 and change(lo) == 0 else [lo]


def check(source, proof, tick=None, pulse_tick=None):
    from math import isqrt
    standard = source['schema'] == 'worldlaw.position-drift-reference-calibration/v1'
    require(standard or source['schema'] == 'worldlaw.position-drift-dwell-calibration/v1', 'unknown source')
    expected_schema = ('worldlaw.position-drift-reference-calibration-proof/v1' if standard
                       else 'worldlaw.position-drift-dwell-calibration-proof/v1')
    require(proof['schema'] == expected_schema and proof['status'] == 'calibration-certified', 'unknown proof')
    cat, saved = source['catalog'], proof['source']
    require(saved['schema'] == source['schema'] and set(source) == set(saved), 'saved source differs')
    budgeted = not standard and 'pulseBudget' in source
    fields = {'schema','catalog'} | ({'pulseBudget'} if budgeted else {'references'} if standard else {'references','dwell'})
    require(set(source) == fields, 'invalid source fields')
    if budgeted:
        h = positive(source['pulseBudget'])
        require(positive(saved['pulseBudget']) == h, 'source budget differs')
        optimal = optimal_dwells(h)
        k = optimal[0]
        m = h-4*k
        below = (2*h-isqrt(2*h*h)-1)//4
        candidates = sorted({min(h//6,max(1,i)) for i in (below,below+1)})
        require(proof['selector'] == {'budget':str(h),'checkedDwells':list(map(str,candidates)),
                                     'optimalDwells':list(map(str,optimal))}, 'budget optimum differs')
    else:
        m = positive(source['references'])
        k = 1 if standard else positive(source['dwell'])
        require(positive(saved['references']) == m and
                (standard or (positive(saved['dwell']) == k and proof['selector'] is None)), 'source counts differ')
    require(m >= 2*k, 'at least twice the dwell is required')
    if not standard:
        require(proof['references'] == str(m) and proof['dwell'] == str(k) and
                proof['interpolation'] == 'affine-on-each-command-run', 'selected counts or interpolation differ')
    commands = cat['commands']
    require(len(commands) == len(set(commands)) and len(cat['laws']) == 2, 'invalid catalog')
    def canonical(c):
        return (c['schema'], c['commands'], rational(c['noiseBound']), c['limits'],
                [(law['id'], [[rational(x) for x in row] for row in law['vertices']]) for law in c['laws']])
    require(canonical(cat) == canonical(saved['catalog']), 'saved catalog differs')
    laws = {law['id']: [[rational(x) for x in row] for row in law['vertices']] for law in cat['laws']}
    require(len(laws) == 2, 'family names must differ')
    radius = F(k*m, 10*(m+2*k))
    noise = rational(cat['noiseBound'])
    least = max(2*k, (20*k*noise) // (k-10*noise) + 1) if noise < F(k, 10) else None
    require(noise >= 0 and rational(proof['radius']) == radius and rational(proof['familyCeiling' if standard else 'fixedDwellCeiling']) == F(k, 10)
            and proof['leastReferencesAtNoise'] == (None if least is None else str(least))
            and proof['atRequestedNoise'] == ('policy-separates' if noise < radius else 'closed-collision'),
            'threshold or inverse differs')
    ticks = [0, m, m+k, m+2*k, m+3*k, m+4*k]
    require(proof['readAt'] == list(map(str, ticks)) and proof['horizon'] == str(m+4*k), 'incorrect checkpoints')
    boundary = proof['boundary']
    shared = list(map(rational, boundary['shared']))
    line = boundary['reference']
    y0, step = rational(line['origin']), rational(line['perTick'])
    require(len(shared) == 3 and line['through'] == str(m) and y0 == shared[0] and y0+m*step == shared[1],
            'reference witness is not the common affine line')
    tails = [['y0','x0','z0'], ['z1','x1','y1']]
    require(len(boundary['branches']) == 2, 'both terminal choices are required')
    roles = [w['law'] for w in boundary['branches'][0]['worlds']]
    require(len(roles) == 2 and set(roles) == set(laws), 'missing physical family')
    # Lower proof holds under any constant mixture exactly when these linear identities hold at all vertices.
    for role, name in enumerate(roles):
        for row in laws[name]:
            require(len(row) == len(commands), 'rate row width differs')
            rates = dict(zip(commands, row))
            left, right = [sum(rates[c] for c in tail) for tail in tails]
            require(rates['ref'] == 0 and
                    ((rates['group']+left == 1 and right == rates['group']) if role == 0 else left == right == 0),
                    'a source vertex violates a terminal identity')
    require(tick is None or pulse_tick is None, 'select a single reference or pulse tick')
    sample_at = pulse_tick if pulse_tick is not None else tick
    require(sample_at is None or type(sample_at) is int and 0 <= sample_at <= ticks[-1], 'pulse tick outside program')
    sample = [] if sample_at is not None else None
    if tick is not None:
        require(type(tick) is int and 0 <= tick <= m, 'reference tick outside run')
    for tail, branch in zip(tails, boundary['branches']):
        require(branch['commands'] == tail and len(branch['after']) == 3 and
                [w['law'] for w in branch['worlds']] == roles, 'incomplete causal branch')
        ys = shared + list(map(rational, branch['after']))
        for world in branch['worlds']:
            weights = list(map(rational, world['weights']))
            vertices = laws[world['law']]
            require(len(weights) == len(vertices) and min(weights) >= 0 and sum(weights) == 1,
                    'invalid persistent source mixture')
            rates = {c:sum(w*row[j] for w,row in zip(weights,vertices)) for j,c in enumerate(commands)}
            p,v = rational(world['origin']),rational(world['drift'])
            positions = [p, p+m*(v+rates['ref'])]
            for c in ['group']+tail:
                positions.append(positions[-1]+k*(v+rates[c]))
            require(all(abs(x-y) <= radius for x,y in zip(positions,ys)), 'closed physical tube failed')
            # On each constant-command run, both the clean trajectory and the common
            # observation interpolate affinely. All intermediate errors lie in the endpoint interval.
            if sample_at is not None:
                i = next(j for j in range(5) if sample_at <= ticks[j+1])
                u = F(sample_at-ticks[i], ticks[i+1]-ticks[i])
                clean = (1-u)*positions[i]+u*positions[i+1]
                observed = (1-u)*ys[i]+u*ys[i+1]
                require(abs(clean-observed) <= radius, 'intermediate pulse tube failed')
                sample.append(dict(law=world['law'], tail=tail[0], clean=str(clean), observed=str(observed)))
    result = dict(radius=str(radius), references=str(m), coveredReferenceTicks=str(m+1),
                  checkpointCount=len(ticks), physicalWorlds=4, sample=sample)
    if not standard:
        result['coveredPulseTicks'] = str(ticks[-1]+1)
    return result


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('source', type=Path)
    ap.add_argument('proof', type=Path)
    ap.add_argument('--reference-tick', type=int)
    ap.add_argument('--pulse-tick', type=int)
    args = ap.parse_args()
    print(json.dumps(check(json.loads(args.source.read_text()), json.loads(args.proof.read_text()), args.reference_tick, args.pulse_tick)))
