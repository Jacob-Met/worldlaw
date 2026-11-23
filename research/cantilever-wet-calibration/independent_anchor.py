"""Independent rectangle-first reading of the two registered wet-standard glyph columns."""
import hashlib
import io
import itertools
import json
import sys
import zipfile
from fractions import Fraction
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5450008/supplementaryFiles'


def inspect(image, x, ymin, ymax, channel):
    block = image.crop((x-6, ymin, x+7, ymax+1))
    def accepted(rgb):
        others = [v for i,v in enumerate(rgb) if i != channel]
        return rgb[channel] > 55 + max(others)
    raster = list(map(accepted, block.getdata()))
    occupied = [sum(raster[i:i+13]) >= 2 for i in range(0, len(raster), 13)]
    intervals = []
    cursor = ymin
    for state, it in itertools.groupby(occupied):
        length = len(list(it))
        if state and length >= 3:
            intervals.append([cursor, cursor+length-1])
        cursor += length
    fills = []
    for a,b in intervals:
        center = (a+b+1)//2
        bare = image.crop((x-2,center-2,x+3,center+3))
        fills.append(Fraction(sum(map(accepted, bare.getdata())),25))
    separated = len(intervals) == 2 and intervals[1][0] > intervals[0][1]+2
    passes = separated and abs(fills[1]-fills[0]) > Fraction(3,20)
    return dict(intervals=intervals,fills=[str(i) for i in fills],admitted=passes)


def main():
    if len(sys.argv) == 2:
        raw = Path(sys.argv[1]).read_bytes()
    else:
        with urlopen(URL,timeout=60) as f:
            raw = f.read(7000000)
    digest = hashlib.sha256(raw).hexdigest()
    assert len(raw) == 5925278 and digest == '7c02c144eec191841a07122545406dd70f33992b667883861820e9ab750356e3'
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        jpeg=z.read('c6an02674e-f2.jpg')
    image=Image.open(io.BytesIO(jpeg)).convert('RGB')
    assert image.size == (783,645)
    rows={}
    for x,name in [(115,'acetone'),(201,'bromoform')]:
        for idx,limits in enumerate([(40,238),(241,440)],1):
            for color,ch in [('red',0),('blue',2)]:
                rows[f'{name}-{idx}-{color}']=inspect(image,x,*limits,ch)
    print(json.dumps(dict(jpeg_sha=hashlib.sha256(jpeg).hexdigest(),archive_sha=digest,
        rows=rows, passed=sum(v['admitted'] for v in rows.values()),measured_holdout_rows=0),
        sort_keys=True))


if __name__ == '__main__':
    main()
