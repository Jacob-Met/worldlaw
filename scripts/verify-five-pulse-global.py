"""Verify complete five-pulse feedback thresholds and display any physical collision path."""
import argparse
import base64
from collections import defaultdict
from fractions import Fraction
from functools import lru_cache
import gzip
from io import BytesIO
from itertools import product
import json
from pathlib import Path


def require(ok, message):
    if not ok:
        raise ValueError(message)


@lru_cache(maxsize=65536)
def rational(value):
    require(type(value) in (str, int), "expected an exact rational string or integer")
    return Fraction(value)


def unpack(block):
    data = base64.b64decode(block, validate=True)
    with gzip.open(BytesIO(data), "rb") as stream:
        raw = stream.read(2_000_001)
    require(len(raw) <= 2_000_000, "prefix exceeds the supported packet size")
    return json.loads(raw)


def check_prefix(commands, laws, prefix, packed, wanted):
    """Read independent physical worlds first, then substitute the sparse lower proof."""
    record = unpack(packed)
    require(record["p"] == list(prefix), "prefix order changed")
    radius = rational(record["r"])
    require(radius >= 0, "negative first-failure radius")
    coordinates = [rational(x) for x in record["worlds"]]
    dual = {}
    for key, weight in record["lower"]:
        require(type(key) is int and key >= 0 and key not in dual, "invalid dual row")
        weight = rational(weight)
        require(weight > 0, "dual weight must be positive")
        dual[key] = weight

    position = 0
    equation = 0
    shared = {}
    coefficient = defaultdict(Fraction)
    constant = Fraction(0)
    noise = Fraction(0)
    displayed = None

    def take():
        nonlocal position
        require(position < len(coordinates), "missing coordinate")
        index = position
        position += 1
        return index

    def weighted_row(terms, rhs, tube=False):
        nonlocal equation, constant, noise
        weight = dual.pop(equation, None)
        equation += 1
        if weight is None:
            return
        for variable, value in terms:
            coefficient[variable] += value * weight
        constant += rhs * weight
        if tube:
            noise -= weight

    for suffix in product(range(len(commands)), repeat=3):
        word = prefix + suffix
        observation_ids = [None, None]
        for tick in range(2, 6):
            history = word[:tick]
            if history not in shared:
                shared[history] = take()
            observation_ids.append(shared[history])
        readings = [0 if key is None else coordinates[key] for key in observation_ids]
        shown_worlds = []
        for law, vertices in laws:
            origin, drift = take(), take()
            masses = [take() for _ in vertices[:-1]]
            weights = [coordinates[k] for k in masses]
            weights.append(1 - sum(weights))
            require(min(weights) >= 0, "invalid constant physical mixture")
            for key in masses:
                weighted_row([(key, -1)], 0)
            weighted_row([(key, 1) for key in masses], 1)
            displacement = [0] * len(vertices)
            clean = []
            for tick, observed in enumerate(readings):
                if tick:
                    action = word[tick - 1]
                    displacement = [v + row[action] for v, row in zip(displacement, vertices)]
                actual = coordinates[origin] + tick * coordinates[drift] + sum(
                    w * v for w, v in zip(weights, displacement))
                require(abs(observed - actual) <= radius, "physical trajectory leaves the noise tube")
                clean.append(actual)
                # Original constraints order each upper position row before its lower row.
                if equation in dual or equation + 1 in dual:
                    terms = [(origin, 1), (drift, tick)]
                    terms.extend((k, d - displacement[-1]) for k, d in zip(masses, displacement))
                    if observation_ids[tick] is not None:
                        terms.append((observation_ids[tick], -1))
                    weighted_row(terms, -displacement[-1], True)
                    weighted_row([(k, -v) for k, v in terms], displacement[-1], True)
                else:
                    equation += 2
            if word == wanted:
                shown_worlds.append(dict(law=law, mixture=list(map(str, weights)),
                                         origin=str(coordinates[origin]), drift=str(coordinates[drift]),
                                         cleanPositions=list(map(str, clean))))
        if word == wanted:
            displayed = dict(commands=[commands[i] for i in word], readings=list(map(str, readings)),
                             noiseBound=str(radius), worlds=shown_worlds)

    require(position == len(coordinates), "extra physical coordinates")
    require(not dual, "dual refers to an absent equation")
    require(not any(coefficient.values()) and noise == -1 and constant == -radius,
            "lower combination does not prove the asserted radius")
    return radius, displayed


def verify(source, packet, history=None):
    catalog = source["catalog"]
    commands = catalog["commands"]
    require(packet.get("schema") == "worldlaw.five-pulse-all-prefixes/v1" and
            packet.get("encoding") == "base64-gzip-json/v1", "unknown packet format")
    require(packet["catalog"] == {"commands": commands, "laws": catalog["laws"]}, "catalog changed")
    require(2 <= len(commands) <= 8 and len(set(commands)) == len(commands), "invalid command menu")
    laws = [(law["id"], [[rational(v) for v in vertex] for vertex in law["vertices"]])
            for law in catalog["laws"]]
    require(len(laws) == 2 and laws[0][0] != laws[1][0], "supply two distinct families")
    require(all(1 <= len(vertices) <= 16 and all(len(row) == len(commands) for row in vertices)
                for _, vertices in laws), "invalid rate vertices")
    prefixes = list(product(range(len(commands)), repeat=2))
    require(len(packet["prefixes"]) == len(prefixes), "incomplete prospective prefix cover")
    wanted = None
    if history is not None:
        require(isinstance(history, list) and len(history) == 5
                and all(c in commands for c in history), "supply a five-command history")
        wanted = tuple(commands.index(c) for c in history)
    results = []
    collision = None
    for prefix, block in zip(prefixes, packet["prefixes"]):
        radius, physical = check_prefix(commands, laws, prefix, block, wanted)
        results.append((radius, [commands[i] for i in prefix]))
        if physical is not None:
            collision = physical
    best = max(r for r, _ in results)
    summary = dict(unrestrictedFiveRadius=str(best),
                   bestPrefixes=[p for r, p in results if r == best],
                   prefixRadii=[dict(prefix=p, radius=str(r)) for r, p in results],
                   leafPairs=len(commands)**5, physicalWorlds=2 * len(commands)**5)
    if wanted is not None:
        require(collision is not None, "missing the requested physical history")
        summary["boundaryHistory"] = collision
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("packet", type=Path)
    parser.add_argument("--history", type=json.loads, help="JSON array of five command names")
    args = parser.parse_args()
    print(json.dumps(verify(json.loads(args.source.read_text()), json.loads(args.packet.read_text()),
                            args.history), separators=(",", ":")))
