#!/usr/bin/env python3
"""Independent exact replay of a four-leaf minimum from its original input and certificate."""
import argparse
from fractions import Fraction as F
from itertools import combinations, product
import json
from math import lcm
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def grid_rows(vertices, denominator):
    # Weak compositions via bars. Only the represented rates matter here.
    n = len(vertices)
    result = set()
    for bars in combinations(range(denominator + n - 1), n - 1):
        markers = (-1, *bars, denominator + n - 1)
        mass = [F(b - a - 1, denominator) for a, b in zip(markers, markers[1:])]
        result.add(tuple(sum(w * x for w, x in zip(mass, col)) for col in zip(*vertices)))
    return result


def raw_positions(row, word):
    # Initial position 0; constant drift -row[first] gives the second zero.
    values = [0]
    for command in word:
        values.append(values[-1] + row[command] - row[word[0]])
    return tuple(values[2:])


def tree_coordinates(words, early=False):
    labels = {}
    paths = []
    for _, _, third, last in words:
        middle = ('w', third, last) if early else ('w', third)
        keys = [('s',), middle, ('v', third, last)]
        paths.append(tuple(labels.setdefault(key, len(labels)) for key in keys))
    return paths, len(labels)


def check_course(vertices, law_names, words, certificate, early=False):
    paths, width = tree_coordinates(words, early)
    eps = F(certificate['radius'])
    obs = list(map(F, certificate['observations']))
    require(eps >= 0 and len(obs) == width and len(certificate['worlds']) == len(words), 'course dimensions')
    for word, path, worlds in zip(words, paths, certificate['worlds']):
        observed = [0, 0, *(obs[i] for i in path)]
        require(len(worlds) == 2, 'missing law')
        for law, world in enumerate(worlds):
            mass = list(map(F, world['weights']))
            require(world['law'] == law_names[law] and len(mass) == len(vertices[law]) and
                    all(w >= 0 for w in mass) and sum(mass) == 1, 'invalid mixture')
            rates = [sum(w * x for w, x in zip(mass, col)) for col in zip(*vertices[law])]
            pos, drift = map(F, world['start'])
            actual = [pos]
            for cmd in word:
                actual.append(actual[-1] + drift + rates[cmd])
            require(actual == list(map(F, world['positions'])) and
                    all(abs(x-y) <= eps for x, y in zip(actual, observed)), 'closed physical history')
    balance = [F(0)] * width
    clean = noise = F(0)
    for term in certificate['lower']:
        leaf = term['leaf']
        require(type(leaf) is int and 0 <= leaf < len(words), 'support leaf')
        norm = tuple(map(F, term['normal']))
        weight = F(term['weight'])
        require(len(norm) == 3 and any(norm) and weight > 0, 'support normal')
        u, v, z = norm
        # Group the coefficients by the five original noise variables.
        noise += weight * sum(map(abs, (u+2*v+3*z, -2*u-3*v-4*z, u, v, z)))
        law = law_names.index(term['law'])
        clean += weight * max(sum(x*y for x, y in zip(norm, raw_positions(row, words[leaf]))) for row in vertices[law])
        for node, component in zip(paths[leaf], norm):
            balance[node] += weight * component
    if eps:
        require(not any(balance) and noise > 0 and clean + noise*eps == 0, 'support lower bound')
    return eps


def replay(source, cert):
    cat = source['experiment']['catalog']
    names = cat['commands']
    laws = [law['id'] for law in cat['laws']]
    vertices = [[tuple(map(F, row)) for row in law['vertices']] for law in cat['laws']]
    require(len(laws) == 2 and cert['status'] == 'four-leaves-required', 'expected binary four-leaf minimum')
    sup = cert['singleCut']['menuProof']
    prefix = tuple(map(names.index, source['prefix']))
    initial_menu = [(*prefix, names.index(b['third']), names.index(c)) for b in source['branches'] for c in b['last']]
    radius = check_course(vertices, laws, initial_menu, sup)
    require(radius > 0, 'positive four-leaf course required')
    upper = cert['upper']
    kept = upper['kept']
    require(1 <= len(kept) <= 4 and len(upper['lower']) <= 8 and
            all(type(i) is int and 0 <= i < len(initial_menu) for i in kept) and kept == sorted(set(kept)), 'compact support size')
    require(all(type(t['leaf']) is int and 0 <= t['leaf'] < len(kept) for t in upper['lower']), 'compact leaf reference')
    lifted = [{**term, 'leaf': kept[term['leaf']]} for term in upper['lower']]
    check_course(vertices, laws, initial_menu, {**sup, 'lower': lifted})
    # Full histories restrict to the selected leaves with the same ancestral labels.
    grid = [grid_rows(v, source['denominator']) for v in vertices]
    scale = lcm(*(x.denominator for rows in grid for row in rows for x in row))
    grid = [[tuple(int(v * scale) for v in row) for row in family] for family in grid]
    cuts = {(t['mode'], tuple(map(names.index, t['prefix']))): t['proof'] for t in cert['cutExceptions']}
    sparse = {tuple(map(names.index, t['shape'])): t['proof'] for t in cert['exceptions']}
    require(len(sparse) == len(cert['exceptions']) and len(cuts) == len(cert['cutExceptions']), 'repeated exception')
    m = len(names)
    ids = range(m)
    count = grid_count = early_count = late_count = 0
    for p, a in product(ids, repeat=2):
        cells = {}
        for b, c in product(ids, repeat=2):
            word = (p, a, b, c)
            A, B = ({raw_positions(row, word) for row in family} for family in grid)
            common = A & B
            cells[b, c] = ({z[0] for z in common}, {(z[0], z[1]) for z in common})
        if not set.intersection(*(x[0] for x in cells.values())):
            proof = cuts.pop(('early', (p, a)))
            require(check_course(vertices,laws,[(p,a,b,c) for b,c in product(ids,repeat=2)],proof,True) == 0, 'early collision')
        early_count += 1
        for b in ids:
            if not set.intersection(*(cells[b,c][1] for c in ids)):
                proof = cuts.pop(('late', (p,a,b)))
                require(check_course(vertices,laws,[(p,a,b,c) for c in ids],proof) == 0, 'late collision')
            late_count += 1
            for c, f in combinations(ids, 2):
                roots = {s for s, _ in cells[b,c][1] & cells[b,f][1]}
                for d, e in product(ids, repeat=2):
                    if d == b:
                        continue
                    count += 1
                    if not roots.isdisjoint(cells[d,e][0]):
                        grid_count += 1
                        continue
                    proof = sparse.pop((p,a,b,c,f,d,e))
                    words = [(p,a,b,c),(p,a,b,f),(p,a,d,e)]
                    require(check_course(vertices, laws, words, proof) == 0, 'asymmetric collision')
    require(not sparse and not cuts and cert['counts'] == {'total':count,'gridRefuted':grid_count,'complete':True}, 'coverage mismatch')
    return {'minimumLeaves':4, 'positiveMenuRadius':str(radius), 'earlyPrefixes':early_count,
            'latePrefixes':late_count, 'asymmetricMenus':count,'gridRefuted':grid_count,'physicalExceptions':count-grid_count}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('certificate', type=Path)
    args = parser.parse_args()
    print(json.dumps(replay(json.loads(args.source.read_text()), json.loads(args.certificate.read_text()))))
