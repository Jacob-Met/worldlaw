"""Check every initial pair of the six-pulse catalog using original physical inequalities."""
import argparse
import base64
from fractions import Fraction
import gzip
import importlib.util
import io
import itertools
import json
from pathlib import Path

SCHEMA = 'worldlaw.grouped-six-pulse-portfolio/v1'


def load_receiver():
    path = Path(__file__).with_name('verify-factored-feedback.py')
    spec = importlib.util.spec_from_file_location('physical_receiver', path)
    receiver = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(receiver)
    return receiver


def load_portfolio(path):
    manifest = json.loads(path.read_text())
    commands = manifest['commands']
    names = [f'{path.stem}-row-{i}.json' for i in range(len(commands))]
    if manifest.get('rows') != names:
        raise ValueError('missing, renamed or reordered certificate shard')
    prefixes = []
    for i, name in enumerate(names):
        shard = json.loads(path.with_name(name).read_text())
        if shard.get('first') != i or not isinstance(shard.get('prefixes'), list):
            raise ValueError('certificate shard does not match its initial command')
        expected = [[i, j] for j in range(len(commands)) if (i, j) != (0, 0)]
        if [row.get('prefix') for row in shard['prefixes']] != expected:
            raise ValueError('shard omits or mislabels a second command')
        prefixes.extend(shard['prefixes'])
    return dict(schema=manifest['schema'], commands=commands, prefixes=prefixes,
                midpointRefinements=manifest.get('midpointRefinements', []))


def pairs(source, portfolio):
    commands = source['catalog']['commands']
    if portfolio.get('schema') != SCHEMA or portfolio.get('commands') != commands:
        raise ValueError('source commands differ from the portfolio')
    expected = list(itertools.product(range(len(commands)), repeat=2))
    if [row.get('prefix') for row in portfolio['prefixes']] != [list(p) for p in expected[1:]]:
        raise ValueError('prefixes must cover each remaining ordered pair exactly once in source order')
    return expected


def physical_stream(row, reference):
    if row is None:
        return reference.open(encoding='utf8')
    data = base64.b64decode(row['gzipBase64'], validate=True)
    return io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(data)), encoding='utf8')


def certify_midpoint(source, prefix, correction, horizon):
    """Maximize the centered chord residual over all suffix choices using the extreme gaps."""
    laws = source['catalog']['laws']
    raw_weights = correction['weights']
    if len(laws) != 2 or len(raw_weights) != 2:
        raise ValueError('two source mixtures are required')
    rates, weights = [], []
    for law, row in zip(laws, raw_weights):
        if any(type(q) not in (str, int) for q in row):
            raise ValueError('supply exact mixture weights')
        ws = list(map(Fraction, row))
        vs = law['vertices']
        if len(ws) != len(vs) or not ws or min(ws) < 0 or sum(ws) != 1:
            raise ValueError('mixture is outside the source simplex')
        weights.append(ws)
        rates.append([sum(w*Fraction(v[j]) for w,v in zip(ws,vs)) for j in range(len(vs[0]))])
    gaps = [a-b for a,b in zip(*rates)]
    low, high = min(gaps), max(gaps)
    worst = Fraction(0)
    for left in range(horizon):
        for right in range(left+1, horizon+1):
            for sign in (-1, 1):
                total = Fraction(0)
                for t in range(horizon):
                    coefficient = sign*(horizon*int(left<=t<right)-(right-left))
                    gap = gaps[prefix[t]] if t<len(prefix) else (high if coefficient>0 else low)
                    total += coefficient*gap
                worst = max(worst, total)
    upper = worst/(4*horizon)
    if str(upper) != correction['upper']:
        raise ValueError('fixed-prefix chord support differs')
    return upper, weights, rates


def lift_five_lower(source, prefix, horizon, packed):
    """Append the first source command and retain the old rows through tick five."""
    if horizon != 6:
        raise ValueError('five-pulse inheritance needs horizon six')
    record = json.loads(gzip.decompress(base64.b64decode(packed, validate=True)))
    if record['p'] != list(prefix):
        raise ValueError('inherited prefix differs')
    sizes = [len(law['vertices']) + 12 for law in source['catalog']['laws']]
    if len(sizes) != 2:
        raise ValueError('expected two source families')
    m = len(source['catalog']['commands'])
    by_block = {}
    seen = set()
    for index, weight in record['lower']:
        if type(index) is not int or index < 0 or index in seen or Fraction(weight) <= 0:
            raise ValueError('invalid five-pulse lower atom')
        seen.add(index)
        ordinal, offset = divmod(index, sum(sizes))
        if ordinal >= m**3:
            raise ValueError('five-pulse atom outside the complete menu')
        suffix = (ordinal//(m*m), (ordinal//m)%m, ordinal%m)
        # The added tick contributes two rows after each law. The new final
        # command has index zero, so this word comes first in its full block.
        target = offset + (2 if offset >= sizes[0] else 0)
        by_block.setdefault(prefix+suffix, []).append([target, weight])
    return Fraction(record['r']), by_block


def refine_stream(stream, source, prefix, correction, horizon):
    """Keep the original lower atoms and directly generate all refined upper worlds."""
    upper, weights, rates = certify_midpoint(source, prefix, correction, horizon)
    first = (rates[0][prefix[0]]+rates[1][prefix[0]])/2

    def reading(w):
        return str(sum((rates[0][c]+rates[1][c])/2-first for c in w))

    def worlds(w):
        gap = [Fraction(0)]
        for c in w:
            gap.append(gap[-1]+rates[0][c]-rates[1][c])
        slope = gap[-1]/len(w)
        residual = [v-t*slope for t,v in enumerate(gap)]
        center = (max(residual)+min(residual))/2
        return [[str(-sign*center/2), str(-first-sign*slope/2), *map(str, ws[:-1])]
                for sign,ws in zip((1,-1),weights)]

    header = json.loads(next(stream))
    if not Fraction(header['lower']) <= upper < Fraction(header['upper']):
        raise ValueError('midpoint refinement does not tighten the source interval')
    inherited = None
    if 'fivePulseLower' in correction:
        new_lower, inherited = lift_five_lower(source, prefix, horizon, correction['fivePulseLower'])
        if header['plan']['split'] != 5 or not Fraction(header['lower']) < new_lower <= upper:
            raise ValueError('inherited lower does not improve this interval')
        header['lower'] = str(new_lower)
        header['domain'] = '0'
    header['upper'] = str(upper)
    header['status'] = 'exact' if Fraction(header['lower']) == upper else 'bounded'
    header['shared'] = [[w, reading(w)] for w,_ in header['shared']]
    yield json.dumps(header)
    alphabet = range(len(source['catalog']['commands']))
    for line in stream:
        block = json.loads(line)
        b = tuple(block['prefix'])
        if inherited is not None:
            block['lower'] = inherited.get(b, [])
        block['readings'] = [[w, reading(w)] for w,_ in block['readings']]
        block['worlds'] = [worlds(b+suffix) for suffix in itertools.product(alphabet,repeat=horizon-len(b))]
        yield json.dumps(block)


def receive(source, portfolio, reference, selection=None):
    receiver = load_receiver()
    expected = pairs(source, portfolio)
    commands = source['catalog']['commands']
    if selection is not None and tuple(selection) not in expected:
        raise ValueError('unknown prefix')
    adjustments = {tuple(r['prefix']): r for r in portfolio.get('midpointRefinements', [])}
    if len(adjustments) != len(portfolio.get('midpointRefinements', [])) or not set(adjustments) <= set(expected):
        raise ValueError('invalid or repeated midpoint refinement')
    table = []
    champion = None
    high = None
    low = None
    total_worlds = total_pairs = total_blocks = 0
    for p, row in zip(expected, [None] + portfolio['prefixes']):
        if selection is not None and tuple(selection) != p:
            continue
        names = [commands[i] for i in p]
        with physical_stream(row, reference) as stream:
            checked = receiver.verify(source, stream, True, names, 6, True)
        search_lower, search_upper = checked['lower'], checked['upper']
        if p in adjustments:
            with physical_stream(row, reference) as original:
                stream = refine_stream(original, source, p, adjustments[p], 6)
                refined = receiver.verify(source, stream, True, names, 6, True)
            if 'fivePulseLower' not in adjustments[p] and (checked['lower'] != refined['lower'] or checked['policy'] != refined['policy']):
                raise ValueError('refinement changed the independently recovered lower policy')
            checked = refined
        lo, hi = Fraction(checked['lower']), Fraction(checked['upper'])
        if low is None or lo > low:
            low = lo
            champion = dict(prefix=names, policy=checked['policy'])
        high = hi if high is None else max(high, hi)
        total_worlds += checked['physicalWorlds']
        total_pairs += checked['terminalPairs']
        total_blocks += checked['blocks']
        table.append(dict(prefix=names, lower=str(lo), upper=str(hi), searchLower=search_lower, searchUpper=search_upper,
                          retainedWords=checked['retainedWords']))
    return dict(scope='all-first-pairs' if selection is None else 'selected-first-pair',
                status='exact' if low == high else 'bounded', lower=str(low), upper=str(high),
                maximizingLower=champion['prefix'], policy=champion['policy'], prefixes=table,
                physicalWorlds=total_worlds, terminalPairs=total_pairs, blocks=total_blocks)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('portfolio', type=Path)
    parser.add_argument('--ref-ref', type=Path, help='previously released ref/ref physical certificate')
    parser.add_argument('--prefix', nargs=2, help='replay only these two initial commands')
    parser.add_argument('--export-policy', type=Path, help='write the strongest recovered lower policy')
    args = parser.parse_args()
    source = json.loads(args.source.read_text())
    reference = args.ref_ref or args.portfolio.with_name('factored-feedback-six-ref-ref.jsonl')
    commands = source['catalog']['commands']
    selected = [commands.index(c) for c in args.prefix] if args.prefix else None
    result = receive(source, load_portfolio(args.portfolio), reference, selected)
    policy = result.pop('policy')
    if args.export_policy:
        with args.export_policy.open('x') as f:
            json.dump(policy, f, indent=2)
            f.write('\n')
    print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    main()
