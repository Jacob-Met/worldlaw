#!/usr/bin/env python3
"""Replay every four-pulse prefix and a five-pulse tree from original rate vertices."""
import argparse
from collections import defaultdict
from fractions import Fraction as F
from itertools import product
import json
from pathlib import Path
import runpy

prior = runpy.run_path(str(Path(__file__).with_name('verify-four-pulse-leaf-minimum.py')))
check_four = prior['check_course']
require = prior['require']


def five_words(node, names, prefix=()):
    word = prefix + tuple(names.index(c) for c in node['commands'])
    require(len(word) <= 5 and (bool(prefix) or len(word) >= 2), 'invalid five-pulse prefix')
    if 'alternatives' not in node:
        require(len(word) == 5, 'a terminal course must use five pulses')
        return [word]
    children = node['alternatives']
    choices = [child['commands'][0] for child in children]
    require(len(choices) > 0 and len(choices) == len(set(choices)), 'invalid siblings')
    return [w for child in children for w in five_words(child, names, word)]


def check_five(vertices, labels, words, proof):
    eps = F(proof['radius'])
    nodes = {}
    for word in words:
        for tick in range(2, 6):
            path = word[:tick]
            if path not in nodes:
                nodes[path] = len(nodes)
    readings = list(map(F, proof['observations']))
    require(eps >= 0 and len(readings) == len(nodes) and len(proof['worlds']) == len(words), 'tree dimensions')
    rows = []
    for li, word in enumerate(words):
        record = [0, 0, *(readings[nodes[word[:i]]] for i in range(2, 6))]
        require(len(proof['worlds'][li]) == len(vertices), 'missing counterfactual world')
        for ki, vs in enumerate(vertices):
            world = proof['worlds'][li][ki]
            mass = list(map(F, world['weights']))
            require(world['law'] == labels[ki] and len(mass) == len(vs) and min(mass) >= 0 and sum(mass) == 1, 'invalid barycentric mass')
            rates = [sum(w * val for w, val in zip(mass, col)) for col in zip(*vs)]
            origin, drift = map(F, world['start'])
            actual = [origin]
            for cmd in word:
                actual.append(actual[-1] + drift + rates[cmd])
            require(actual == list(map(F, world['positions'])) and
                    all(abs(x-y) <= eps for x, y in zip(actual, record)), 'raw five-pulse physical boundary')
            local = [('mass', li, ki, j) for j in range(len(vs)-1)]
            rows.extend(({x:-1},0,0) for x in local)
            if local:
                rows.append(({x:1 for x in local},1,0))
            for tick in range(6):
                force = [sum(row[c] for c in word[:tick]) for row in vs]
                coeff = {x: value-force[-1] for x,value in zip(local,force)}
                coeff[('origin',li,ki)] = 1
                coeff[('drift',li,ki)] = tick
                if tick >= 2:
                    coeff[('reading', word[:tick])] = -1
                rows.append((coeff,-force[-1],1))
                rows.append(({x:-v for x,v in coeff.items()},force[-1],1))
    balance = defaultdict(F)
    clean = noise = F(0)
    prev = -1
    for i,raw in proof['lower']:
        w = F(raw)
        require(type(i) is int and prev < i < len(rows) and w > 0, 'invalid weighted raw row')
        prev = i
        terms,h,r = rows[i]
        for x,v in terms.items():
            balance[x] += w * v
        clean += w*h
        noise += w*r
    require((not eps and not proof['lower']) or (eps and not any(balance.values()) and noise > 0 and clean+noise*eps == 0), 'invalid five-pulse dual')
    return eps


def replay(source, cert):
    require(source['schema'] == 'worldlaw.position-drift-five-pulse-experiment/v1' and cert['status'] == 'horizons-certified', 'source and proof kind')
    cat = source['catalog']
    names = cat['commands']
    labels = [law['id'] for law in cat['laws']]
    vertices = [[tuple(map(F, v)) for v in law['vertices']] for law in cat['laws']]
    require(len(set(labels)) == len(labels) == 2 and len(set(names)) == len(names) > 0 and
            all(vs and all(len(v)==len(names) for v in vs) for vs in vertices), 'invalid binary rate catalog')
    ids = range(len(names))
    courses = cert['four']['courses']
    require(len(courses) == len(names)**2, 'missing prospective prefix')
    radii = []
    for (p,a),course in zip(product(ids,repeat=2),courses):
        require(course['prefix'] == [names[p],names[a]], 'prefix order')
        words = [(p,a,b,c) for b,c in product(ids,repeat=2)]
        kept = course['kept']
        require(1 <= len(kept) <= 4 and kept == sorted(set(kept)) and all(type(j) is int and 0 <= j < len(words) for j in kept), 'retained leaves')
        require(len(course['lower']) <= 8 and all(type(t['leaf']) is int and 0 <= t['leaf'] < len(kept) for t in course['lower']), 'compact support')
        lifted = [{**t,'leaf':kept[t['leaf']]} for t in course['lower']]
        proof = {'observations':course['boundary']['observations'],'worlds':course['boundary']['worlds'],'radius':course['radius'],'lower':lifted}
        radii.append(check_four(vertices,labels,words,proof))
    four = max(radii)
    best = courses[radii.index(four)]['prefix']
    require(four == F(cert['four']['radius']) and best == cert['four']['bestPrefix'], 'unrestricted four-pulse result')
    words = five_words(source['program'], names)
    five = check_five(vertices,labels,words,cert['five'])
    error = F(cat['noiseBound'])
    decision = 'within-four' if error < four else 'minimum-five' if error < five else 'four-refuted-exhibited-five-refuted'
    minimum = '5' if decision == 'minimum-five' else None
    require(cert['atRequestedNoise'] == decision and cert['minimumPulses'] == minimum, 'incorrect horizon claim')
    return {'unrestrictedFourRadius':str(four),'bestFourPrefix':best,'fourPrefixes':len(courses),
            'fourLeafPairs':len(names)**4,'exhibitedFiveRadius':str(five),'fiveLeaves':len(words),'minimumPulses':minimum}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('certificate', type=Path)
    args = parser.parse_args()
    print(json.dumps(replay(json.loads(args.source.read_text()),json.loads(args.certificate.read_text()))))
