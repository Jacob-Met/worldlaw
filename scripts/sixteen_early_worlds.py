"""Replay the early reading correction using persistent original source mixtures."""
from base64 import b64decode
from fractions import Fraction
from functools import lru_cache
from itertools import combinations_with_replacement
import json
from pathlib import Path

NAMES = ('ref', 'group', 'x0', 'y0', 'z0', 'x1', 'y1', 'z1')


@lru_cache(maxsize=1)
def certificate():
    path = Path(__file__).resolve().parents[1] / 'examples' / 'sixteen-pulse-early-worlds.json'
    packet = json.loads(path.read_text())
    if packet['schema'] != 'worldlaw.sixteen-pulse-early-collision/v1':
        raise ValueError('Unexpected early-collision certificate')
    branches = packet['branches']
    if set(branches) != set(NAMES[2:]):
        raise ValueError('Missing ninth-command branch')
    for table in branches.values():
        table['assignments'] = b64decode(table['assignments'], validate=True)
        if len(table['assignments']) != 3432:
            raise ValueError('Expected one witness for each seven-action histogram')
    ranks = {h:i for i,h in enumerate(combinations_with_replacement(range(8), 7))}
    return branches, ranks


def receive_prefix(commands, experiment, source_rates):
    branches, ranks = certificate()
    first_suffix = commands[8]
    table = branches[first_suffix]
    shift = Fraction(table['shift'])
    tail = tuple(NAMES.index(c) for c in commands[9:])
    # Padding selects a private witness for a partial transcript. Its readings
    # before tick 16 are already fixed independently of the padding.
    hist = tuple(sorted(tail + (0,) * (7 - len(tail))))
    pair = table['pairs'][table['assignments'][ranks[hist]]]
    scale, *values = pair
    if scale <= 0 or len(values) != 10:
        raise ValueError('Invalid physical witness')
    x = [Fraction(v, scale) for v in values]
    states, rates, positions = [], [], []
    for l, (law_id, order) in enumerate(experiment.bindings):
        weights = x[3*l:3*l+3]
        weights.append(1 - sum(weights))
        if min(weights) < 0:
            raise ValueError('Negative source mixture')
        origin, drift = x[6+2*l:8+2*l]
        physical = source_rates(l, weights)
        rates.append({c:physical[c] + drift for c in NAMES})
        positions.append(origin)
        original_weights = [None]*4
        for j, source_index in enumerate(order):
            original_weights[source_index] = str(weights[j])
        states.append(dict(law=law_id, weights=original_weights, origin=str(origin), drift=str(drift)))
    nominal = Fraction(0)
    readings = []
    for tick in range(len(commands) + 1):
        if tick:
            c = commands[tick-1]
            nominal += experiment.mu[c]
            positions = [v + r[c] for v,r in zip(positions,rates)]
        reading = sum(positions) / 2 if tick == 16 else nominal + (shift if tick >= 9 else 0)
        if any(abs(p-reading) > experiment.e for p in positions):
            raise ValueError('Early witness misses a measured original position')
        readings.append(dict(tick=str(tick), reading=str(reading)))
    return dict(radius=str(experiment.e), branch='corrected reference prefix',
                readingShift=str(shift), measurements=readings, worlds=states)
