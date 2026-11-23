"""Stream a factored feedback proof using fractions and the original position equations."""
import argparse
from collections import defaultdict
from fractions import Fraction as F
from itertools import product
import json
from pathlib import Path

def require(check, message):
    if not check:
        raise ValueError(message)

def rational(v):
    require(type(v) in (str, int), 'expected an exact rational')
    return F(v)

def source_tree(source, complete, prefix, horizon):
    commands = source['catalog']['commands']
    if complete:
        require(isinstance(prefix, list) and len(prefix) >= 2 and all((c in commands for c in prefix)), 'provide a valid complete-menu prefix')
        p = tuple((commands.index(c) for c in prefix))
        require(type(horizon) is int and len(p) <= horizon <= 16, 'unsupported horizon')
        return (p, horizon, None)
    require(prefix is None and horizon is None, 'use --complete with an explicit horizon or prefix')
    node = source['program']
    p = tuple((commands.index(c) for c in node['commands']))
    h = source['horizon']
    words = []
    require(len(p) >= 2 and type(h) is int and (2 <= h <= 16), 'invalid submitted prefix or horizon')

    def descend(n, old):
        seg = tuple((commands.index(c) for c in n['commands']))
        require(seg and len(old) + len(seg) <= h, 'invalid segment')
        w = old + seg
        if 'alternatives' not in n:
            require(len(w) == h, 'terminal length differs')
            words.append(w)
            return
        children = n['alternatives']
        choices = [child['commands'][0] for child in children]
        require(children and len(set(choices)) == len(choices), 'invalid sibling choices')
        for child in children:
            descend(child, w)
    descend(node, ())
    return (p, h, sorted(words))

def retained_program(words, commands):

    def visit(paths):
        common = 0
        while common < len(paths[0]) and len({p[common] for p in paths}) == 1:
            common += 1
        require(common > 0, 'invalid retained command tree')
        node = {'commands': [commands[c] for c in paths[0][:common]]}
        if common < len(paths[0]):
            groups = defaultdict(list)
            for p in paths:
                groups[p[common]].append(p[common:])
            node['alternatives'] = [visit(groups[c]) for c in sorted(groups)]
        return node
    return visit(words)

def verify(source, stream, complete=False, prefix=None, horizon=None, emit_policy=False):
    header = json.loads(next(stream))
    require(header['type'] == 'header' and header['schema'] == 'worldlaw.factored-feedback-certificate/v1', 'unknown header')
    commands = source['catalog']['commands']
    laws = source['catalog']['laws']
    vertices = [[[rational(value) for value in row] for row in law['vertices']] for law in laws]
    require(len(laws) == 2 and laws[0]['id'] != laws[1]['id'] and (len(set(commands)) == len(commands)) and all((vs and all((len(row) == len(commands) for row in vs)) for vs in vertices)), 'invalid catalog')
    require(header['commands'] == commands and header.get('lawIds') == [law['id'] for law in laws] and (header['vertices'] == [[[str(v) for v in row] for row in vs] for vs in vertices]), 'catalog does not match')
    p, h, words = source_tree(source, complete, prefix, horizon)
    plan = header['plan']
    depth = plan['split']
    require(plan['prefix'] == list(p) and plan['horizon'] == h and (plan.get('words') == (None if words is None else [list(w) for w in words])), 'menu does not match')
    require(type(depth) is int and len(p) <= depth <= h, 'invalid separator')
    m = len(commands)
    lower = rational(header['lower'])
    upper = rational(header['upper'])
    require(0 <= lower <= upper and header['status'] == ('exact' if lower == upper else 'bounded'), 'invalid interval')

    def entries(items):
        d = {tuple(w): rational(v) for w, v in items}
        require(len(d) == len(items), 'duplicate history')
        return d
    shared = entries(header['shared'])
    seen = set()
    global_dual = defaultdict(F)
    noise = -rational(header['domain'])
    require(noise <= 0, 'negative domain multiplier')
    total = F(0)
    leaves = 0
    count = 0
    kept = []
    first_word = None
    blocks = (p + suffix for suffix in product(range(m), repeat=depth - len(p))) if words is None else iter(sorted({w[:depth] for w in words}))
    for b in blocks:
        raw = json.loads(next(stream))
        count += 1
        require(raw['type'] == 'block' and raw['prefix'] == list(b), 'block ordering or coverage differs')
        ws = (b + s for s in product(range(m), repeat=h - depth)) if words is None else (w for w in words if w[:depth] == b)
        ys = entries(raw['readings'])
        used = set()
        local = defaultdict(F)
        pos = 0
        atoms = {}
        supported = False
        for i, v in raw['lower']:
            require(type(i) is int and i >= 0 and (i not in atoms) and (rational(v) > 0), 'invalid multiplier')
            atoms[i] = rational(v)

        def add(terms, rhs, tube):
            nonlocal pos, total, noise, supported
            lam = atoms.pop(pos, None)
            pos += 1
            if lam is None:
                return
            supported = True
            total += lam * rhs
            noise -= lam if tube else 0
            for key, c in terms:
                if key[0] == 'y' and len(key[1]) < depth:
                    global_dual[key] += lam * c
                else:
                    local[key] += lam * c
        nw = 0
        for w in ws:
            supported = False
            if first_word is None:
                first_word = w
            require(nw < len(raw['worlds']), 'missing physical worlds')
            pair = raw['worlds'][nw]
            nw += 1
            leaves += 1
            require(len(pair) == 2, 'missing physical pair')
            end = []
            for l, vs in enumerate(vertices):
                z = list(map(rational, pair[l]))
                require(len(z) == len(vs) + 1, 'incorrect state size')
                position, drift = z[:2]
                weights = z[2:]
                weights.append(1 - sum(weights))
                require(min(weights) >= 0, 'weights outside the simplex')
                mus = [('state', w, l, i) for i in range(len(weights) - 1)]
                origin = ('origin', w, l)
                speed = ('drift', w, l)
                for key in mus:
                    add([(key, -1)], 0, False)
                add([(key, 1) for key in mus], 1, False)
                ds = [0] * len(vs)
                for t in range(h + 1):
                    if t:
                        ds = [z + v[w[t - 1]] for z, v in zip(ds, vs)]
                    clean = position + t * drift + sum((a * x for a, x in zip(weights, ds)))
                    if t == h:
                        end.append(clean)
                    else:
                        history = w[:t]
                        if t < 2:
                            y = 0
                        elif t < depth:
                            y = shared[history]
                            seen.add(history)
                        else:
                            y = ys[history]
                            used.add(history)
                        require(abs(y - clean) <= upper, 'original position leaves the upper physical tube')
                    if pos in atoms or pos + 1 in atoms:
                        terms = [(origin, 1), (speed, t)] + [(j, d - ds[-1]) for j, d in zip(mus, ds)]
                        if t >= 2:
                            terms.append((('y', w[:t]), -1))
                        add(terms, -ds[-1], True)
                        add([(j, -v) for j, v in terms], ds[-1], True)
                    else:
                        pos += 2
            require(abs(end[0] - end[1]) <= 2 * upper, 'no common terminal reading')
            if supported:
                kept.append(w)
        require(nw == len(raw['worlds']) and used == set(ys) and (not atoms) and (not any(local.values())), 'extra data or an uncancelled private coordinate')
    require(seen == set(shared) and (not any(global_dual.values())) and (noise == -1) and (total == -lower), 'global lower proof or shared readings do not close')
    require(next(stream, None) is None, 'extra block')
    if not kept:
        require(lower == 0, 'positive lower bound has no source support')
        kept = [first_word]
    result = dict(status=header['status'], lower=str(lower), upper=str(upper), blocks=count, terminalPairs=leaves, physicalWorlds=2 * leaves, retainedWords=len(kept))
    if emit_policy:
        result['policy'] = {'schema': 'worldlaw.position-drift-physical-feedback-tree/v1', 'catalog': source['catalog'], 'horizon': h, 'program': retained_program(kept, commands)}
    return result
if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('source', type=Path)
    ap.add_argument('proof', type=Path)
    ap.add_argument('--complete', action='store_true')
    ap.add_argument('--prefix', type=json.loads)
    ap.add_argument('--horizon', type=int)
    ap.add_argument('--export-policy', type=Path, help='write the retained executable lower-bound menu')
    args = ap.parse_args()
    with args.proof.open() as stream:
        result = verify(json.loads(args.source.read_text()), stream, args.complete, args.prefix, args.horizon, bool(args.export_policy))
    if args.export_policy:
        with args.export_policy.open('x') as out:
            json.dump(result.pop('policy'), out)
    print(json.dumps(result))
