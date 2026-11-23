"""Source qualification: project only record type, wavelength, and incidence from the vendor scan."""
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
import tempfile

COMMIT = 'dc620d7d47c97c3c0c6140ffb46060103eab35ac'
ROOT = f'https://raw.githubusercontent.com/FAIRmat-NFDI/pynxtools-ellips/{COMMIT}/examples/'
SOURCE = {
    'test-data.dat': '2118714531aaf3d24bab3123363e09962191c01e',
    'eln_data.yaml': '4da2d8b754b5db67bc4d7698be9ed2d0475f6eaa',
}


def project():
    path = Path(tempfile.mkdtemp(prefix='p2-pyelli-source-'))
    originals = {}
    for name, expected in SOURCE.items():
        body = urlopen(ROOT + name, timeout=40).read()
        actual = hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()
        assert actual == expected, (name, actual)
        (path / name).write_bytes(body)
        originals[name] = {'size': len(body), 'git_blob': actual,
                           'sha256': hashlib.sha256(body).hexdigest()}
    lines = (path / 'test-data.dat').read_bytes().splitlines()
    axes = defaultdict(list)
    widths = Counter()
    for record in lines[3:]:
        if not record.strip():
            continue
        fields = record.split()
        kind = fields[0].decode()
        assert kind.isalpha(), 'invalid label on a data record'
        wavelength, angle = float(fields[1]), float(fields[2])
        axes[kind, angle].append(wavelength)
        widths[kind, len(fields)] += 1
    info = {}
    for (kind, angle), points in sorted(axes.items()):
        eligible_nm = [x * 0.1 for x in points if 2100 <= x <= 8000]
        info[f'{kind}/{angle:g}'] = {
            'total': len(points), 'unique': len(set(points)), 'min_angstrom': min(points),
            'max_angstrom': max(points), 'within_210_800_nm': len(eligible_nm),
            'strict_increase': all(y > x for x, y in zip(points, points[1:])),
            'axis_digest': hashlib.sha256(json.dumps(points).encode()).hexdigest(),
        }
    print(json.dumps({'originals': originals, 'header': [s.decode() for s in lines[:3]],
                      'axes': info, 'column_counts': {str(k): v for k, v in widths.items()},
                      'signal_components_parsed': 0, 'source_directory': str(path)}, sort_keys=True))


if __name__ == '__main__':
    project()
