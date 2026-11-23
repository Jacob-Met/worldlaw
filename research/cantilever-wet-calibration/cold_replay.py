"""Recount all eight registered glyph projections from the lossless RGB strips."""
import argparse
import base64
from fractions import Fraction as Q
import hashlib
import json
from pathlib import Path
import sys
import zlib

ROOT = Path(__file__).resolve().parent

def tally(data):
    report = {}
    for x, name in [('115','acetone'),('201','bromoform')]:
        raw = zlib.decompress(base64.b64decode(data[x]['deflate_base64'], validate=True))
        assert len(raw)==13*401*3 and hashlib.sha256(raw).hexdigest()==data[x]['sha256']
        for mode, (lo,hi) in enumerate([(40,238),(241,440)],1):
            for color, channel in [('red',0),('blue',2)]:
                on = set()
                for row in range(lo,hi+1):
                    for col in range(13):
                        idx = ((row-40)*13+col)*3
                        rgb = raw[idx:idx+3]
                        if all(rgb[channel]-rgb[k]>55 for k in range(3) if k!=channel):
                            on.add((row,col))
                active = {r for r in range(lo,hi+1) if sum((r,c) in on for c in range(13))>=2}
                bands=[]
                for start in sorted(active):
                    if start-1 in active: continue
                    stop=start
                    while stop+1 in active: stop+=1
                    if stop>=start+2: bands.append([start,stop])
                fills=[]
                for start,stop in bands:
                    y=(start+stop+1)//2
                    hits=sum((r,c) in on for r in range(y-2,y+3) for c in range(4,9))
                    fills.append(Q(hits,25))
                separated=len(bands)==2 and bands[1][0]-bands[0][1]>=3
                admitted=separated and abs(fills[0]-fills[1])>Q(3,20)
                report[f'{name}-{mode}-{color}']=dict(bands=bands,
                    fill_fractions=[str(f) for f in fills], admitted=admitted)
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strips',type=Path,default=ROOT/'anchor-rgb.json')
    parser.add_argument('--expected',type=Path)
    args=parser.parse_args()
    evidence=tally(json.loads(args.strips.read_text()))
    if args.expected:
        expected=json.loads(args.expected.read_text())
        assert evidence.keys()==expected['calibration'].keys()
        for key,value in evidence.items():
            target=expected['calibration'][key]
            assert value['bands']==target['bands'] and value['admitted']==target['admitted']
            assert [float(Q(x)) for x in value['fill_fractions']]==target['central_occupancy']
        assert sum(v['admitted'] for v in evidence.values())==expected['passed']
    print(json.dumps(dict(cells=evidence,passed=sum(v['admitted'] for v in evidence.values()),
        calibration_only=True, experimental_forecasts=0),sort_keys=True))

if __name__=='__main__':
    main()
