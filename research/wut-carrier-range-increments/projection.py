"""Byte-pinned RINEX projection. Only the selected phase fields are converted."""
import gzip
import hashlib
import json
import math
import zipfile
from pathlib import Path

SOURCES = {
    'WUT000POL_R_2024068.zip': 'b5fb7116ba01ec2fcef9f7163bb6ad26eb691dec40085b719db04618378feb87',
    'WUT100POL_R_2024068.zip': 'fff1a8da7c268ca6742ea6ccb9f582bf44344b9b14a667114527e84c3cecade6',
}
CODES = ('L1C', 'L5Q', 'L7Q')
LENGTH = dict(zip(CODES, (299792458 / f for f in (1575420000, 1176450000, 1207140000))))

def digest(path):
    with Path(path).open('rb') as stream:
        h = hashlib.sha256()
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h.hexdigest()

def authenticate(root):
    for name, expected in SOURCES.items():
        if digest(root / name) != expected:
            raise ValueError('source mismatch ' + name)

def dump(path, obj):
    data = json.dumps(obj, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    with path.open('xb') as stream:
        stream.write(gzip.compress(data, compresslevel=6, mtime=0))
    return {'name': path.name, 'bytes': path.stat().st_size, 'sha256': digest(path)}

def read(path):
    return json.loads(gzip.decompress(Path(path).read_bytes()))

def phase(line, index):
    start = 3 + 16 * index
    raw = line[start:start + 14].strip()
    value = float(raw) if raw else None
    if value is not None and (value == 0 or not math.isfinite(value)):
        value = None
    lli = int(line[start + 14:start + 15].strip() or b'0')
    if not 0 <= lli <= 7:
        raise ValueError('invalid LLI')
    return value, lli

def site_hour(path, hour, codes):
    suffix = f'2024068{hour:02d}00_01H_01S_MO.rnx'
    observations = {}
    epoch_flags = {}
    with zipfile.ZipFile(path) as archive:
        member, = [name for name in archive.namelist() if name.endswith(suffix)]
        with archive.open(member) as stream:
            system = None
            galileo = []
            for line in stream:
                label = line[60:].strip()
                if label == b'END OF HEADER':
                    break
                if label == b'SYS / # / OBS TYPES':
                    if line[:1] != b' ':
                        system = line[:1]
                    if system == b'E':
                        galileo.extend(line[7:60].decode('ascii').split())
            else:
                raise ValueError('unterminated header')
            if [galileo.index(c) for c in CODES] != [1, 9, 13]:
                raise ValueError('unexpected phase schema')
            indices = [galileo.index(code) for code in codes]
            sec = None
            flag = None
            for line in stream:
                if line.startswith(b'>'):
                    parts = line.split()
                    if list(map(int, parts[1:5])) != [2024, 3, 8, hour]:
                        raise ValueError('wrong date/hour in member')
                    second = float(parts[6])
                    minute = int(parts[5])
                    if not second.is_integer() or not (0 <= minute < 60 and 0 <= second < 60):
                        raise ValueError('unsupported epoch')
                    sec = minute * 60 + int(second)
                    flag = int(parts[7])
                    epoch_flags.setdefault(sec, []).append(flag)
                elif line[:1] == b'E' and line[1:3].isdigit() and flag in (0, 1):
                    sat = line[:3].decode()
                    if not 1 <= int(sat[1:]) <= 99:
                        raise ValueError('unknown satellite')
                    data = observations.setdefault(sat, {})
                    if sec in data:
                        raise ValueError('duplicate satellite epoch')
                    data[sec] = tuple(phase(line.rstrip(b'\r\n'), j) for j in indices)
    summaries = {}
    for minute in range(59):
        times = range(60 * minute, 60 * minute + 61)
        epoch_ok = all(epoch_flags.get(t) == [0] for t in times)
        for sat, values in observations.items():
            samples = [values[t] for t in times if t in values]
            if not samples:
                continue
            by_code = {}
            for j, code in enumerate(codes):
                valid = sum(sample[j][0] is not None for sample in samples)
                flagged = sum(sample[j][1] != 0 for sample in samples)
                ends = [values.get(t) for t in (times[0], times[-1])]
                pair = [sample[j][0] if sample else None for sample in ends]
                delta = None if None in pair else (pair[1] - pair[0]) * LENGTH[code]
                by_code[code] = [delta, valid, flagged]
            summaries[(minute, sat)] = (epoch_ok, by_code)
    return summaries

def projected(root, hour, codes):
    sites = [site_hour(root / file, hour, codes) for file in SOURCES]
    for minute, sat in sorted(sites[0].keys() | sites[1].keys()):
        yield (hour, minute, sat), [site.get((minute, sat)) for site in sites]

def clean(cells, codes):
    return all(cell is not None and cell[0] and all(cell[1][code][1:] == [61, 0] for code in codes) for cell in cells)

def endpoints(cells, codes):
    return [[cell[1][code][0] if cell else None for code in codes] for cell in cells]
