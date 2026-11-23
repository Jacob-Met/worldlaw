"""Design bounded source feedback experiments with exact Benders cuts from suffix blocks.

The LP optimizer proposes rational witnesses. Original primal and dual substitution
decides whether to accept each subproblem and master solution.
"""
from itertools import product
from fractions import Fraction as F
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
import argparse, os, tempfile, importlib.util
import numpy as np
from scipy.sparse import coo_matrix
from scipy.optimize import linprog
import sys, json, warnings
warnings.filterwarnings('ignore', message='Unrecognized options detected')

@lru_cache(maxsize=32000)
def rat(v):
    return F(float(v)).limit_denominator(1000000)

def sparse_matrix(rows, width):
    ii = []
    jj = []
    data = []
    for i, row in enumerate(rows):
        for j, v in row.items():
            if v:
                ii.append(i)
                jj.append(j)
                data.append(float(v))
    return coo_matrix((data, (ii, jj)), shape=(len(rows), width)).tocsr()

def solve_checked_lp(rows, rhs, width):
    """Use HiGHS to propose a basis, then check primal feasibility and the exact dual."""
    objective = np.zeros(width)
    objective[0] = 1
    result = linprog(objective, A_ub=sparse_matrix(rows, width), b_ub=np.asarray(rhs, dtype=float), bounds=(None, None), method='highs-ds', options={'threads': 1})
    if not result.success:
        raise ArithmeticError(result.message)
    x = [rat(v) for v in result.x]
    dual = {i: rat(-v) for i, v in enumerate(result.ineqlin.marginals) if v < -1e-12}
    # Matrix and point are scaled to integers for fast, exact row checks.
    from math import lcm
    den = lcm(*(v.denominator for v in x))
    scaled = [int(v * den) for v in x]
    for row, b in zip(rows, rhs):
        if sum((v * scaled[j] for j, v in row.items())) > b * den:
            raise ArithmeticError('rational primal failed')
    coeff = defaultdict(F)
    value = F(0)
    for i, w in dual.items():
        if w <= 0:
            raise ArithmeticError('nonpositive dual')
        value += w * rhs[i]
        for j, v in rows[i].items():
            coeff[j] += w * v
    if coeff.pop(0, 0) != -1 or any(coeff.values()) or value != -x[0]:
        raise ArithmeticError('rational dual failed')
    return (x, dual, int(result.nit))

def position_rows(words, vertices):
    """Raw mixture-simplex and two-sided position rows in stable leaf/source order."""
    coords = {'e': 0}
    rows = []
    rhs = []

    def var(key):
        if key not in coords:
            coords[key] = len(coords)
        return coords[key]

    def row(z, h):
        rows.append({k: v for k, v in z.items() if v})
        rhs.append(h)
    for w in words:
        observations = [None, None] + [var(('y', w[:t])) for t in range(2, len(w) + 1)]
        for law, vs in enumerate(vertices):
            origin = var((w, law, 'p'))
            drift = var((w, law, 'v'))
            masses = [var((w, law, i)) for i in range(len(vs) - 1)]
            for j in masses:
                row({j: -1}, 0)
            row(dict.fromkeys(masses, 1), 1)
            disp = [0] * len(vs)
            for t, y in enumerate(observations):
                if t:
                    for i, v in enumerate(vs):
                        disp[i] += v[w[t - 1]]
                z = {j: d - disp[-1] for j, d in zip(masses, disp)}
                z[origin] = 1
                z[drift] = t
                if y is not None:
                    z[y] = -1
                for sign in (1, -1):
                    row({**{j: v * sign for j, v in z.items()}, 0: -1}, -sign * disp[-1])
    return (coords, rows, rhs)

def solve_suffix_block(words, vertices, outer, values):
    """Pin only shared ancestors; lift the local noise dual to a valid master cut."""
    coords, rows, rhs = position_rows(words, vertices)
    shared = {i: outer[k] for k, i in coords.items() if k != 'e' and k in outer}
    private = {i: j for j, i in enumerate((i for i in range(len(coords)) if i not in shared))}
    local = [{private[k]: v for k, v in row.items() if k in private} for row in rows]
    bound = [h - sum((row[k] * values[g] for k, g in shared.items() if k in row)) for h, row in zip(rhs, rows)]
    x, dual, pivots = solve_checked_lp(local, bound, len(private))
    gradient = defaultdict(F)
    constant = F(0)
    for i, w in dual.items():
        constant += rhs[i] * w
        for k, g in shared.items():
            gradient[g] += w * rows[i].get(k, 0)
    cut = {j: v for j, v in gradient.items() if v}
    cut[0] = -1
    if sum((v * values[j] for j, v in cut.items() if j)) - constant != x[0]:
        raise ArithmeticError('invalid lifted supporting cut')
    return (x[0], cut, constant, dual, x, pivots, len(rows), len(private))

def design(vertices, prefix, horizon, wordset=None, rounds=32, split=None, block_limit=128, word_limit=16):
    """Keep separator readings and verified cuts; discard every suffix matrix after use."""
    m = len(vertices[0][0])
    depth = max(len(prefix), horizon - 1) if split is None else split
    if not len(prefix) <= depth <= horizon or rounds < 1 or block_limit < 1 or (word_limit < 1):
        raise ValueError('invalid split or work limits')
    if wordset is None:
        if m ** (depth - len(prefix)) > block_limit or m ** (horizon - depth) > word_limit:
            raise ValueError('separator or block exceeds the configured intake limit')
        prefixes = list((tuple(prefix) + q for q in product(range(m), repeat=depth - len(prefix))))
        words = lambda p: [p + s for s in product(range(m), repeat=horizon - depth)]
    else:
        prefixes = sorted(set((w[:depth] for w in wordset)))
        words = lambda p: sorted((w for w in wordset if w[:depth] == p))
    if len(prefixes) > block_limit or (wordset is not None and max((len(words(p)) for p in prefixes)) > word_limit):
        raise ValueError('separator or block exceeds the configured intake limit')
    ancestors = sorted(set((p[:i] for p in prefixes for i in range(2, depth))), key=lambda w: (len(w), w))
    outer = {('y', p): i + 1 for i, p in enumerate(ancestors)}
    outer['e'] = 0
    cuts = [({0: -1}, 0, None, {})]
    known = set()
    hist = []
    stats = dict(solves=0, pivots=0, rowsProcessed=0, peakRows=0, peakWidth=0, peakTerminalLeaves=0)

    def charge(n, k, p, term):
        stats['solves'] += 1
        stats['pivots'] += p
        stats['rowsProcessed'] += n
        stats['peakRows'] = max(stats['peakRows'], n)
        stats['peakWidth'] = max(stats['peakWidth'], k)
        stats['peakTerminalLeaves'] = max(stats['peakTerminalLeaves'], term)
    cached = {}
    best = None
    lo = None
    for mode in range(rounds):
        values, multipliers, piv = solve_checked_lp([r for r, h, b, d in cuts], [h for r, h, b, d in cuts], len(outer))
        charge(len(cuts), len(outer), piv, 0)
        lo = values[0]
        mused = [(cuts[j], w) for j, w in multipliers.items()]
        added = []
        high = F(0)
        for p in prefixes:
            # The cache retains only one block result per separator value, with no block matrices.
            key = tuple((values[outer['y', p[:t]]] for t in range(2, depth)))
            if p not in cached or cached[p][0] != key:
                tapes = words(p)
                result = solve_suffix_block(tapes, vertices, outer, values)
                r, cut, bound, dual, x, piv, n, k = result
                charge(n, k, piv, len(tapes))
                cached[p] = (key, (r, cut, bound, dual))
            r, cut, bound, dual = cached[p][1]
            high = max(high, r)
            if r > lo:
                ident = (tuple(sorted(cut.items())), bound)
                if ident not in known:
                    known.add(ident)
                    added.append((cut, bound, p, dual))
        if best is None or high < best[0]:
            best = (high, values[:])
        hist.append([str(lo), str(best[0]), len(cuts), len(added)])
        if lo == best[0] or not added:
            break
        cuts.extend(added)
    if lo > best[0]:
        raise ArithmeticError('inverted bounds')
    summary = dict(status='exact' if lo == best[0] else 'bounded', lower=str(lo), upper=str(best[0]), history=hist, stats=stats)
    return (summary, (prefixes, outer, best, mused))

def proof_lines(commands, law_ids, vertices, plan, data, summary):
    """Stream the best verified upper worlds and expand the master's lower proof."""
    export = dict(solves=0, pivots=0, rowsProcessed=0)
    summary['export'] = export
    prefixes, outer, (upper, values), active = data
    h = plan['horizon']
    split = plan['split']
    wordset = plan.get('words')
    m = len(commands)

    def block_words(p):
        if wordset is None:
            return [p + s for s in product(range(m), repeat=h - split)]
        return [tuple(w) for w in wordset if tuple(w[:split]) == p]
    combined = defaultdict(lambda: defaultdict(F))
    domain = F(0)
    for (row, b, p, local), weight in active:
        if p is None:
            domain += weight
            continue
        for i, lam in local.items():
            combined[p][i] += weight * lam
    yield {'type': 'header', 'schema': 'worldlaw.factored-feedback-certificate/v1', 'plan': plan, 'commands': commands, 'lawIds': law_ids, 'vertices': [[[str(q) for q in row] for row in vs] for vs in vertices], 'status': summary['status'], 'lower': summary['lower'], 'upper': summary['upper'], 'domain': str(domain), 'shared': [[list(key[1]), str(values[i])] for key, i in outer.items() if key != 'e']}
    for p in prefixes:
        ws = block_words(p)
        r, _, _, _, x, pivots, row_count, _ = solve_suffix_block(ws, vertices, outer, values)
        export['solves'] += 1
        export['pivots'] += pivots
        export['rowsProcessed'] += row_count
        if r > upper:
            raise ArithmeticError('upper regeneration differs')
        ids, _, _ = position_rows(ws, vertices)
        private = [key for key in ids if key == 'e' or key not in outer]
        private = {key: x[j] for j, key in enumerate(private)}
        physical = []
        for w in ws:
            physical.append([[str(private[w, l, 'p']), str(private[w, l, 'v']), *[str(private[w, l, i]) for i in range(len(vs) - 1)]] for l, vs in enumerate(vertices)])
        observations = [[list(k[1]), str(x)] for k, x in private.items() if k != 'e' and len(k) == 2 and (k[0] == 'y') and (len(k[1]) < h)]
        yield {'type': 'block', 'prefix': list(p), 'readings': observations, 'worlds': physical, 'lower': [[i, str(w)] for i, w in sorted(combined[p].items()) if w]}

def main():
    parser = argparse.ArgumentParser(description='Design an exact bounded feedback policy by suffix-block decomposition.')
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--complete', action='store_true', help='design every suffix after the supplied prefix')
    parser.add_argument('--prefix', type=json.loads)
    parser.add_argument('--horizon', type=int)
    parser.add_argument('--split', type=int)
    parser.add_argument('--rounds', type=int, default=32)
    parser.add_argument('--block-limit', type=int, default=128)
    parser.add_argument('--word-limit', type=int, default=16)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError(args.output)
    path = Path(__file__).with_name('verify-factored-feedback.py')
    spec = importlib.util.spec_from_file_location('feedback_receiver', path)
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    src = json.loads(args.source.read_text())
    raw = src['catalog']
    commands = raw['commands']
    law_ids = [law['id'] for law in raw['laws']]
    vertices = [[[verifier.rational(v) for v in row] for row in law['vertices']] for law in raw['laws']]
    # Retain integral coefficients as integers in exact scalar products.
    vertices = [[[int(q) if q.denominator == 1 else q for q in row] for row in vs] for vs in vertices]
    if len(law_ids) != 2 or len(set(law_ids)) != 2 or len(set(commands)) != len(commands) or (not all((vs and all((len(row) == len(commands) for row in vs)) for vs in vertices))):
        raise ValueError('supply two finite rate families with compatible named commands')
    prefix, h, words = verifier.source_tree(src, args.complete, args.prefix, args.horizon)
    split = max(len(prefix), h - 1) if args.split is None else args.split
    summary, data = design(vertices, prefix, h, words, args.rounds, split, args.block_limit, args.word_limit)
    plan = dict(prefix=list(prefix), horizon=h, split=split, words=None if words is None else [list(w) for w in words])
    with tempfile.NamedTemporaryFile(mode='w', dir=args.output.parent, delete=False) as f:
        name = f.name
    try:
        with open(name, 'w') as f:
            for row in proof_lines(commands, law_ids, vertices, plan, data, summary):
                f.write(json.dumps(row, separators=(',', ':')) + '\n')
        with open(name) as f:
            received = verifier.verify(src, f, args.complete, args.prefix, args.horizon)
        os.link(name, args.output)
    finally:
        os.unlink(name)
    print(json.dumps(dict(result=received, design=summary), separators=(',', ':')))
if __name__ == '__main__':
    main()
