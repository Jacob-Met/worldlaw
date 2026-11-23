"""Recount the visible shear and pressure means in the authors' Figure 3."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile
import io
import urllib.request
import tempfile
from xml.etree import ElementTree as ET

SOURCE_SHA = "8534c98a6169053f8ede138034839f0597323997f2122f4918f3b14b0162a62a"
NUMBER = r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?"
WALLS = {(126,47,142):"L.O", (0,0,0):"Smooth", (191,0,191):"L.I",
         (119,172,48):"S.I", (0,128,0):"S.O", (0,0,255):"Leafspring"}


def numbers(s):
    return list(map(float, re.findall(NUMBER, s)))


def replay(pdf):
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError("Figure 3 source hash mismatch")
    with tempfile.TemporaryDirectory() as td:
        svg = Path(td)/"figure.svg"
        subprocess.run(["pdftocairo", "-svg", str(pdf), str(svg)], check=True)
        paths = [e for e in ET.parse(svg).getroot().iter() if e.tag.endswith("}path")]
    walls = {wall:{} for wall in WALLS.values()}
    for name, box, cap, height in (("shear",(89.716,29.585,363.117,239.951),2.8,350),
                                    ("pressure",(93.698,285.881,366.241,502.090),2.9,1000)):
        x0, y0, x1, y1 = box
        # Identify the opaque plot rectangle from its path (and painter order).
        frame = []
        for i, e in enumerate(paths):
            if e.get("fill") != "rgb(100%, 100%, 100%)" or e.get("fill-opacity") != "1":
                continue
            xy = numbers(e.get("d",""))
            if len(xy) < 8: continue
            bbox = (min(xy[0::2]),min(xy[1::2]),max(xy[0::2]),max(xy[1::2]))
            if max(abs(a-b) for a,b in zip(box,bbox)) < .02:
                frame.append(i)
        if len(frame)!=1: raise ValueError((name,"ambiguous plot frame",frame))
        data = collections.defaultdict(lambda:collections.defaultdict(list))
        for e in paths[frame[0]+1:]:
            if not e.get("stroke") or not e.get("transform"): continue
            rgb = tuple(round(v*2.55) for v in numbers(e.get("stroke","")))
            if rgb not in WALLS: continue
            d=e.get("d","").strip()
            if not re.fullmatch(r"M\s+"+NUMBER+r"\s+"+NUMBER+r"\s+L\s+"+NUMBER+r"\s+"+NUMBER,d):continue
            a,b,c,f,tx,ty=numbers(e.get("transform"))
            u,v,s,t=numbers(d)
            xa,ya=a*u+c*v+tx,b*u+f*v+ty
            xb,yb=a*s+c*t+tx,b*s+f*t+ty
            if abs(ya-yb)>.005 or abs(abs(xa-xb)-cap)>.10:continue
            x,y=(xa+xb)/2,(ya+yb)/2
            if x0<x<x1 and y0<y<y1:
                data[WALLS[rgb]][round(x,2)].append(y)
        for w in walls:
            if len(data[w])!=10: raise ValueError((name,w,"expected ten radial stations",len(data[w])))
            rows=[]
            for x, ends in sorted(data[w].items()):
                if len(ends)!=2: raise ValueError((w,x,"expected two error-bar ends",ends))
                center=sum(ends)/2
                rows.append([14*(x-x0)/(x1-x0),height*(y1-center)/(y1-y0)])
            walls[w][name]=rows
    counts={}
    for wall, channels in walls.items():
        pairs=zip(channels['shear'],channels['pressure'])
        mu=[]
        for (r,tau),(s,pressure) in pairs:
            if abs(r-s)>.001 or pressure<=0: raise ValueError((wall,r,s,pressure))
            mu.append(tau/pressure)
        channels['stress_ratio']=mu
        counts[wall]=sum(v>.25 for v in mu)
    for wall, channels in walls.items():
        channels['matched_radius_max_delta_d'] = max(abs(a[0]-b[0]) for a,b in zip(channels['shear'],channels['pressure']))
    return {'walls':walls,'yielded_nodes':counts,'walls_with_two':sum(v>=2 for v in counts.values()),
            'required_walls':3,'admitted':sum(v>=2 for v in counts.values())>=3}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("figure", type=Path, nargs="?", help="optional local author stress_boundaries.pdf")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as td:
        figure = args.figure
        if figure is None:
            url = "https://arxiv.org/src/2205.11675v1"
            with urllib.request.urlopen(url, timeout=90) as source:
                archive = source.read()
            if hashlib.sha256(archive).hexdigest() != "8a35f75d3241cb74befdddfd2a65e73eadbdc49efc8d06ea136b42679364bfe2":
                raise ValueError("author source archive hash mismatch")
            with tarfile.open(fileobj=io.BytesIO(archive)) as tf:
                data = tf.extractfile("stress_boundaries.pdf").read()
            figure = Path(td)/"stress_boundaries.pdf"
            figure.write_bytes(data)
        result = replay(figure)
    if args.out:
        args.out.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    frozen = json.loads(Path(__file__).with_name("observed.json").read_text())
    if result['yielded_nodes'] != frozen['yielded_nodes'] or result['admitted'] != frozen['admitted']:
        raise ValueError("frozen admission recount differs")
    for wall, fields in result['walls'].items():
        for field in ('shear', 'pressure'):
            for row, expected in zip(fields[field], frozen['walls'][wall][field], strict=True):
                if abs(row[0]-expected[0])>.001 or abs(row[1]-expected[1])>.05:
                    raise ValueError((wall,field,"digitized centers differ"))
    print(json.dumps({k:v for k,v in result.items() if k!='walls'},sort_keys=True))


if __name__ == "__main__":
    main()
