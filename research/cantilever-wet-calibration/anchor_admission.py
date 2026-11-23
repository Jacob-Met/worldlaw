"""Read two predeclared anchor columns. Long-probe holdouts stay outside the projection."""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from PIL import Image


def ranges(rows):
    groups = []
    for y in rows:
        if not groups or y != groups[-1][-1] + 1:
            groups.append([])
        groups[-1].append(y)
    return [(group[0], group[-1]) for group in groups if len(group) >= 3]


def ink(color, rgb):
    r, g, b = rgb
    if color == "red":
        return r - max(g, b) > 55
    return b - max(g, r) > 55


def anchor_bands(image, x, mode, color):
    low, high = (40, 238) if mode == 1 else (241, 440)
    rows = []
    for y in range(low, high + 1):
        hits = sum(ink(color, image.getpixel((column, y))) for column in range(x - 6, x + 7))
        if hits >= 2:
            rows.append(y)
    bands = ranges(rows)
    centers = [(lo + hi) / 2 for lo, hi in bands]
    occupancies = []
    for center in centers:
        y0 = int(center + 0.5)
        hits = sum(ink(color, image.getpixel((column, row))) for column in range(x - 2, x + 3)
                   for row in range(y0 - 2, y0 + 3))
        occupancies.append(hits / 25)
    separated = len(bands) == 2 and bands[1][0] - bands[0][1] - 1 >= 2
    distinct_fill = separated and abs(occupancies[0] - occupancies[1]) > .15
    return dict(bands=bands, centers=centers, central_occupancy=occupancies,
                two_separate=separated, distinct_fill=distinct_fill, admitted=bool(distinct_fill))


def main(path):
    raw = Path(path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == '7c02c144eec191841a07122545406dd70f33992b667883861820e9ab750356e3'
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        data = archive.read('c6an02674e-f2.jpg')
    image = Image.open(io.BytesIO(data)).convert('RGB')
    assert image.size == (783, 645)
    evidence = {}
    for name, x in [('acetone', 115), ('bromoform', 201)]:
        for mode in (1, 2):
            for color in ('red', 'blue'):
                evidence[f'{name}-{mode}-{color}'] = anchor_bands(image, x, mode, color)
    print(json.dumps(dict(figure_sha256=hashlib.sha256(data).hexdigest(), calibration=evidence,
                          passed=sum(v['admitted'] for v in evidence.values()),
                          all_admitted=all(v['admitted'] for v in evidence.values()),
                          held_ordinates_used=0, whole_jpeg_decoded=True), sort_keys=True))


if __name__ == '__main__':
    main(sys.argv[1])
