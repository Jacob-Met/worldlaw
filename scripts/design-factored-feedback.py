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
from typing import NamedTuple
import sys, json, warnings
warnings.filterwarnings('ignore', message='Unrecognized options detected')

@lru_cache(maxsize=32000)
def rat(v):
    return F(float(v)).limit_denominator(1000000)

def sparse_matrix(rows, width):
    from scipy.sparse import coo_matrix
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

class UnverifiedProposal(ArithmeticError):
    """The numerical LP suggestion did not pass exact substitution."""


def reconstruct_primal(proposal, rows, rhs, dual):
    """Check every raw inequality, optionally removing the shared RHS denominator before rounding."""
    from math import lcm

    def denominators():
        yield 1
        common = lcm(*(F(q).denominator for q in rhs))
        if common != 1 and common <= 2 ** 53:
            yield common
    expected = -sum((weight * rhs[i] for i, weight in dual.items()))
    for scale in denominators():
        x = [rat(v * scale) / scale for v in proposal]
        den = lcm(*(v.denominator for v in x))
        scaled = [int(v * den) for v in x]
        if x[0] == expected and all((sum((v * scaled[j] for j, v in row.items())) <= b * den for row, b in zip(rows, rhs))):
            break
    else:
        raise UnverifiedProposal('rational primal failed after RHS-aware reconstruction')
    return x

def solve_checked_lp(rows, rhs, width):
    """Use HiGHS to propose a basis, then check primal feasibility and the exact dual."""
    import numpy as np
    from scipy.optimize import linprog
    objective = np.zeros(width)
    objective[0] = 1
    result = linprog(objective, A_ub=sparse_matrix(rows, width), b_ub=np.asarray(rhs, dtype=float), bounds=(None, None), method='highs-ds', options={'threads': 1})
    if not result.success:
        raise UnverifiedProposal(result.message)
    dual = {i: rat(-v) for i, v in enumerate(result.ineqlin.marginals) if v < -1e-12}
    x = reconstruct_primal(result.x, rows, rhs, dual)
    coeff = defaultdict(F)
    value = F(0)
    for i, w in dual.items():
        if w <= 0:
            raise ArithmeticError('nonpositive dual')
        value += w * rhs[i]
        for j, v in rows[i].items():
            coeff[j] += w * v
    if coeff.pop(0, 0) != -1 or any(coeff.values()) or value != -x[0]:
        raise UnverifiedProposal('rational dual failed')
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
SNAPSHOTS_PER_BLOCK = 6

class BlockSnapshot(NamedTuple):
    ancestor_key: tuple
    radius: F
    cut: dict
    constant: F
    dual: dict
    bands: tuple

    def lower_at(self, values):
        return sum((v * values[j] for j, v in self.cut.items() if j)) - self.constant

def primal_bands(words, vertices, outer, coords, private, x):
    """Extrema of all raw pinned tubes and the worst remaining private residual."""
    depth = next((t for t in range(2, len(words[0]) + 2) if ('y', words[0][:t]) not in outer))
    from math import lcm
    denominator = lcm(*(v.denominator for v in x))
    x = [int(v * denominator) for v in x]
    lows = [None] * depth
    highs = [None] * depth
    fixed = F(0)
    for w in words:
        for law, vs in enumerate(vertices):
            start = x[private[coords[w, law, 'p']]]
            drift = x[private[coords[w, law, 'v']]]
            masses = [x[private[coords[w, law, i]]] for i in range(len(vs) - 1)]
            masses.append(denominator - sum(masses))
            pos = start
            for t in range(len(w) + 1):
                if t:
                    pos += drift + sum((m * v[w[t - 1]] for m, v in zip(masses, vs)))
                if t < depth:
                    lows[t] = pos if lows[t] is None else min(lows[t], pos)
                    highs[t] = pos if highs[t] is None else max(highs[t], pos)
                else:
                    fixed = max(fixed, abs(pos - x[private[coords['y', w[:t]]]]))
    return (tuple((F(v, denominator) for v in lows)), tuple((F(v, denominator) for v in highs)), F(fixed, denominator))

def gauge_witness(bands, key, radius):
    """Find one offset and drift satisfying all old source states at new shared readings."""
    lows, highs, fixed = bands
    if fixed > radius:
        return None
    reads = (0, 0) + key
    if len(lows) != len(reads) or len(highs) != len(reads):
        raise ValueError('gauge certificate has the wrong number of ancestral ticks')
    low = [y - c - radius for y, c in zip(reads, lows)]
    high = [y - c + radius for y, c in zip(reads, highs)]
    if any((a > b for a, b in zip(low, high))):
        return None
    left = None
    right = None
    for j in range(1, len(low)):
        for i in range(j):
            a = F(low[j] - high[i], j - i)
            b = F(high[j] - low[i], j - i)
            left = a if left is None else max(left, a)
            right = b if right is None else min(right, b)
            if left > right:
                return None
    slope = left
    offset = max((v - t * slope for t, v in enumerate(low)))
    if not all((a <= offset + t * slope <= b for t, (a, b) in enumerate(zip(low, high)))):
        raise ArithmeticError('invalid source-tube affine correction')
    return (offset, slope)

def zero_vertices(words, vertices):
    """Each selected source vertex admits a zero trajectory along its entire leaf."""
    choices = []
    for w in words:
        controls = set(w)
        pair = []
        for vs in vertices:
            selected = next((j for j, row in enumerate(vs) if all((row[c] == row[w[0]] for c in controls))), None)
            if selected is None:
                return None
            pair.append(selected)
        choices.append(pair)
    return choices

def solve_suffix_block(words, vertices, outer, values, summarize=False):
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
    if summarize:
        bands = primal_bands(words, vertices, outer, coords, private, x)
        return (x[0], cut, constant, dual, None, pivots, len(rows), len(private), bands)
    return (x[0], cut, constant, dual, x, pivots, len(rows), len(private))

def fixed_mixture_bound(vertices, weights, horizon):
    """A causal midpoint transcript bounds every tape of this length by a binary chord argument."""
    if len(weights) != 2:
        raise ValueError('provide one fixed mixture per law')
    weights = [[F(q) if type(q) in (int, str) else None for q in ws] for ws in weights]
    for ws, vs in zip(weights, vertices):
        if len(ws) != len(vs) or any(q is None or q < 0 for q in ws) or sum(ws) != 1:
            raise ValueError('invalid fixed mixture')
    rates = [[sum(w * v[j] for w, v in zip(ws, vs)) for j in range(len(vs[0]))]
             for ws, vs in zip(weights, vertices)]
    diff = [a - b for a, b in zip(*rates)]
    radius = (max(diff) - min(diff)) * (horizon * horizon // 4) / (4 * horizon)
    return radius, rates, weights


def midpoint_reading(word, rates):
    return sum((rates[0][c] + rates[1][c] - rates[0][word[0]] - rates[1][word[0]])
               for c in word) / 2


def midpoint_worlds(word, rates, weights):
    gap = [F(0)]
    for c in word:
        gap.append(gap[-1] + rates[0][c] - rates[1][c])
    slope = gap[-1] / len(word)
    residual = [g - t * slope for t, g in enumerate(gap)]
    intercept = (min(residual) + max(residual)) / 2
    first = (rates[0][word[0]] + rates[1][word[0]]) / 2
    return [[str(-sign * intercept / 2), str(-first - sign * slope / 2), *map(str, ws[:-1])]
            for sign, ws in zip((1, -1), weights)]


def read_seed(source, path, verifier):
    """Validate the finite source tree and bind every lower atom to a complete command word."""
    with path.open() as stream:
        verifier.verify(source, stream)
    _, horizon, seed_words = verifier.source_tree(source, False, None, None)
    vertices = [law['vertices'] for law in source['catalog']['laws']]
    stride = sum(len(vs) + 2 * (horizon + 1) for vs in vertices)
    by_word = defaultdict(dict)
    with path.open() as stream:
        next(stream)
        for line in stream:
            block = json.loads(line)
            prefix = tuple(block['prefix'])
            block_words = [w for w in seed_words if w[:len(prefix)] == prefix]
            for i, weight in block['lower']:
                leaf, offset = divmod(i, stride)
                by_word[block_words[leaf]][offset] = F(weight)
    return by_word


def lift_seed(seed, words, prefixes, depth, vertices, outer):
    """Rebuild cuts in the target row order. Only shared readings and noise may survive."""
    groups = defaultdict(list)
    for w in seed:
        groups[w[:depth]].append(w)
    result = []
    for p, retained in sorted(groups.items()):
        if p not in prefixes:
            raise ValueError('seed leaf is outside the target prefix')
        tapes = words(p)
        coords, rows, rhs = position_rows(tapes, vertices)
        stride = len(rows) // len(tapes)
        local = {}
        for w in retained:
            if w not in tapes:
                raise ValueError('seed leaf is outside the target program')
            start = stride * tapes.index(w)
            for offset, weight in seed[w].items():
                if not 0 <= offset < stride or weight <= 0:
                    raise ValueError('invalid source row or lower multiplier')
                local[start + offset] = weight
        terms = defaultdict(F)
        bound = F(0)
        for i, weight in local.items():
            bound += rhs[i] * weight
            for j, coefficient in rows[i].items():
                terms[j] += weight * coefficient
        scale = -terms[coords['e']]
        if scale <= 0 or any(terms[i] for key, i in coords.items() if key not in outer):
            raise ValueError('seed block cannot be lifted at this separator')
        cut = {outer[key]: terms[i] / scale for key, i in coords.items() if key in outer and terms[i]}
        result.append((cut, bound / scale, p, {i: w / scale for i, w in local.items()}))
    return result


def design(vertices, prefix, horizon, wordset=None, rounds=32, split=None, block_limit=128, word_limit=16, seed=None, mixture_bound=None):
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
    seeded = lift_seed(seed or {}, words, prefixes, depth, vertices, outer)
    cuts.extend(seeded)
    known = {(tuple(sorted(row.items())), rhs) for row, rhs, _, _ in seeded}
    hist = []
    stats = dict(solves=0, pivots=0, rowsProcessed=0, peakRows=0, peakWidth=0, peakTerminalLeaves=0)

    def charge(n, k, p, term):
        stats['solves'] += 1
        stats['pivots'] += p
        stats['rowsProcessed'] += n
        stats['peakRows'] = max(stats['peakRows'], n)
        stats['peakWidth'] = max(stats['peakWidth'], k)
        stats['peakTerminalLeaves'] = max(stats['peakTerminalLeaves'], term)
    cached = {p: [] for p in prefixes}
    groups = defaultdict(list)
    for p in prefixes:
        groups[p[:-1]].append(p)
    zero_bands = ((F(0),) * depth, (F(0),) * depth, F(0))
    zero_blocks = set()
    for p in prefixes:
        if zero_vertices(words(p), vertices) is not None:
            zero_blocks.add(p)
    stats.update(exactHits=0, primalHits=0, envelopeChecks=0, primalBuilds=0, cutHits=0, deferredBlocks=0, zeroHits=0, zeroBlocks=len(zero_blocks))
    if seed is not None:
        stats['seedCuts'] = len(seeded)
    best = None
    fixed_start = None
    if mixture_bound is not None:
        upper, rates, _ = mixture_bound
        values = [F(0)] * len(outer)
        for history in ancestors:
            values[outer['y', history]] = midpoint_reading(history, rates)
        best = (upper, values)
        fixed_start = best
        stats['initialUpper'] = str(upper)
    lo = None
    for iteration in range(rounds):
        try:
            values, multipliers, piv = solve_checked_lp([r for r, h, b, d in cuts], [h for r, h, b, d in cuts], len(outer))
        except UnverifiedProposal as error:
            if fixed_start is None or lo is None:
                raise
            stats['numericalStop'] = str(error)
            break
        charge(len(cuts), len(outer), piv, 0)
        lo = values[0]
        mused = [(cuts[j], w) for j, w in multipliers.items()]
        added = []
        high = F(0)
        # A lower cut may defer siblings. Update the upper bound only after full coverage.
        complete = True
        for group in groups.values():
            key = tuple((values[outer['y', group[0][:t]]] for t in range(2, depth)))

            def risk(p):
                return max((record.lower_at(values) for record in cached[p]), default=F(0))
            ordered = sorted(group, key=lambda p: (-risk(p), p))
            for index, p in enumerate(ordered):
                records = cached[p]
                keycut = None
                for record in reversed(records):
                    if record.lower_at(values) > lo:
                        keycut = (record.cut, record.constant, record.dual)
                        break
                if keycut is not None and iteration:
                    cut, bound, dual = keycut
                    stats['cutHits'] += 1
                    ident = (tuple(sorted(cut.items())), bound)
                    if ident not in known:
                        known.add(ident)
                        added.append((cut, bound, p, dual))
                    complete = False
                    stats['deferredBlocks'] += len(ordered) - index - 1
                    break
                if p in zero_blocks and gauge_witness(zero_bands, key, lo) is not None:
                    high = max(high, lo)
                    stats['zeroHits'] += 1
                    continue
                hit = next((record for record in records if record.ancestor_key == key), None)
                if hit is not None:
                    r, cut, bound, dual = (hit.radius, hit.cut, hit.constant, hit.dual)
                    stats['exactHits'] += 1
                else:
                    good = False
                    for record in reversed(records):
                        stats['envelopeChecks'] += 1
                        if gauge_witness(record.bands, key, lo) is not None:
                            good = True
                            break
                    if good:
                        high = max(high, lo)
                        stats['primalHits'] += 1
                        continue
                    tapes = words(p)
                    try:
                        r, cut, bound, dual, x, piv, n, k, bands = solve_suffix_block(tapes, vertices, outer, values, True)
                    except UnverifiedProposal as error:
                        if fixed_start is None:
                            raise
                        stats['numericalStop'] = str(error)
                        break
                    charge(n, k, piv, len(tapes))
                    stats['primalBuilds'] += 1
                    records.append(BlockSnapshot(key, r, cut, bound, dual, bands))
                    if len(records) > SNAPSHOTS_PER_BLOCK:
                        records.pop(0)
                high = max(high, r)
                if r > lo:
                    ident = (tuple(sorted(cut.items())), bound)
                    if ident not in known:
                        known.add(ident)
                        added.append((cut, bound, p, dual))
                    if iteration and index + 1 < len(ordered):
                        complete = False
                        stats['deferredBlocks'] += len(ordered) - index - 1
                        break
            if 'numericalStop' in stats:
                break
        if 'numericalStop' in stats:
            break
        if complete and (best is None or high < best[0]):
            best = (high, values[:])
        hist.append([str(lo), str(best[0]), len(cuts), len(added)])
        if lo == best[0] or not added:
            break
        cuts.extend(added)
    if lo > best[0]:
        raise ArithmeticError('inverted bounds')
    summary = dict(status='exact' if lo == best[0] else 'bounded', lower=str(lo), upper=str(best[0]), history=hist, stats=stats)
    data = (prefixes, outer, best, mused)
    if fixed_start is not None and best is fixed_start:
        data += (mixture_bound,)
    return summary, data

def proof_lines(commands, law_ids, vertices, plan, data, summary):
    """Stream the best verified upper worlds and expand the master's lower proof."""
    export = dict(solves=0, pivots=0, rowsProcessed=0, zeroWorldBlocks=0)
    summary['export'] = export
    prefixes, outer, (upper, values), active = data[:4]
    fixed = data[4] if len(data) == 5 else None
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
        if fixed is not None:
            _, rates, weights = fixed
            histories = sorted({w[:t] for w in ws for t in range(split, h)})
            yield {'type': 'block', 'prefix': list(p),
                   'readings': [[list(w), str(midpoint_reading(w, rates))] for w in histories],
                   'worlds': [midpoint_worlds(w, rates, weights) for w in ws],
                   'lower': [[i, str(weight)] for i, weight in sorted(combined[p].items()) if weight]}
            export['fixedMixtureBlocks'] = export.get('fixedMixtureBlocks', 0) + 1
            continue
        choices = zero_vertices(ws, vertices)
        bands = ((F(0),) * split, (F(0),) * split, F(0))
        pinned = tuple((values[outer['y', p[:t]]] for t in range(2, split)))
        change = gauge_witness(bands, pinned, upper) if choices is not None else None
        if change is not None:
            origin, velocity = change
            physical = []
            for w, chosen in zip(ws, choices):
                pair = []
                for l, j in enumerate(chosen):
                    rate = vertices[l][j][w[0]]
                    pair.append([str(origin), str(velocity - rate), *[str(int(k == j)) for k in range(len(vertices[l]) - 1)]])
                physical.append(pair)
            histories = sorted(set((w[:t] for w in ws for t in range(split, h))))
            observations = [[list(w), str(origin + len(w) * velocity)] for w in histories]
            export['zeroWorldBlocks'] += 1
            yield {'type': 'block', 'prefix': list(p), 'readings': observations, 'worlds': physical, 'lower': [[i, str(weight)] for i, weight in sorted(combined[p].items()) if weight]}
            continue
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
    parser.add_argument('--upper-mixtures', type=json.loads, help='two fixed barycentric vectors for a causal midpoint upper witness')
    parser.add_argument('--seed-proof', type=Path, help='lower cuts from this source’s independently verified finite menu')
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
    seed = read_seed(src, args.seed_proof, verifier) if args.seed_proof else None
    fixed = fixed_mixture_bound(vertices, args.upper_mixtures, h) if args.upper_mixtures is not None else None
    summary, data = design(vertices, prefix, h, words, args.rounds, split, args.block_limit, args.word_limit, seed, fixed)
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
