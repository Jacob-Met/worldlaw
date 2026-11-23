"""Cold scalar recount using original worksheet coordinates and the locked forecast file."""
import bisect
from decimal import Decimal as D, getcontext
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

getcontext().prec=50
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'worldlaw-public-metadata-reader/1.0'}),timeout=90) as f:return f.read()
root=Path(__file__).parent
spec=json.loads((root/'protocol.json').read_text())
fore=(root/'forecasts.json').read_bytes()
assert hashlib.sha256(fore).hexdigest()=='3c8be4fa779779221fbb2d6d4ef997a5ca36679320294f139693cb41d9628839'
fore=json.loads(fore,parse_float=D,parse_int=D)
saved=json.loads((root/'result.json').read_text(),parse_float=D,parse_int=D)
meta=json.loads(fetch('https://zenodo.org/api/records/21387374'))
payload=fetch(meta['files'][0]['links']['self'])
assert hashlib.sha256(payload).hexdigest()==spec['archive']['sha256']
outer=zipfile.ZipFile(io.BytesIO(payload))
maximum=D(0)
counts={'forecasts':0,'profile_rows':0,'metric_cells':0,'native_brackets':0}
def chk(x,y,tol=D('2e-12')):
    global maximum
    delta=abs(x-y)/max(D(1),abs(y));maximum=max(delta,maximum)
    assert delta<=tol,(str(x),str(y),str(delta))
records={}
wins=0
worst=(D(-1),)
for host,h in spec['hosts'].items():
    book=zipfile.ZipFile(io.BytesIO(outer.read(next(n for n in outer.namelist() if n.endswith('/'+h['file'])))))
    sheet=ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
    cells={v.get('r'):v.findtext('{*}v') for v in sheet.findall('.//{*}c')}
    temps=h['cols'][-5:];records[host]=[]
    grid=[int(d) for d in fore[host]['detunings']]
    center=D(10_000_000)/D(str(h['lambda0_nm']))
    maps=[(D(a),D(s)) for a,s in zip(h['as'],h['s'])]
    def red_offset(d):
        d=D(d)
        if d<=maps[0][0]:return d+maps[0][1]-maps[0][0]
        for (x,y),(xx,yy) in zip(maps,maps[1:]):
            if d<=xx:return y+(yy-y)*(d-x)/(xx-x)
        return d+maps[-1][1]-maps[-1][0]
    for i,col in enumerate(temps):
        q=fore[host]['targets'][i]
        z=saved['profiles'][host][i]
        axis=h['axis_last'] if i==4 else h['axis']
        rows=sorted((D(v),int(k[len(axis):])) for k,v in cells.items() if re.fullmatch(axis+r'\d+',k) and int(k[len(axis):])>=3 and v is not None)
        def sample(u):
            j=bisect.bisect_left(rows,(u,0))
            (u0,l),(u1,r)=rows[j-1:j+1]
            a,b=D(cells[col+str(l)]),D(cells[col+str(r)])
            y=(a*(u1-u)+b*(u-u0))/(u1-u0)
            return y,[l,r,u0,u1,a,b,u]
        scale=sum(sample(center-red_offset(d))[0] for d in grid)/len(grid)
        chk(scale,q['scale'])
        observed=[]
        for j,d in enumerate(grid):
            raw,br=sample(center+d)
            for a,b in zip(br,z['native_brackets'][j]):chk(a,b)
            y=raw/scale;chk(y,z['observed'][j]);observed.append(y)
        counts['native_brackets']+=len(grid)
        metrics={}
        for role,values in q['forecasts'].items():
            assert len(values)==len(observed)
            errors=[abs(y-f) for y,f in zip(observed,values)]
            pair=[sum(errors)/len(errors),(sum(e*e for e in errors)/len(errors)).sqrt()]
            for v,w in zip(pair,z['metrics'][role]):chk(v,w)
            metrics[role]=pair
            counts['metric_cells']+=2
            counts['forecasts']+=len(values)
            if role==spec['roles'][0]:
                for j,error in enumerate(errors):
                    if error>worst[0]:worst=(error,host,q['T'],j,observed[j],q['forecasts'])
        counts['profile_rows']+=1
        wins+=int(metrics[spec['roles'][0]][0]<metrics['fit_blue_red_slope'][0])
        records[host].append(metrics)
roles=spec['roles'];candidate=roles[0]
av={host:{r:[sum(a[r][k] for a in values)/len(values) for k in (0,1)] for r in roles} for host,values in records.items()}
macro={r:[sum(a[r][k] for a in av.values())/len(av) for k in (0,1)] for r in roles}
for r in roles:
    for k in (0,1):
        for host in av:chk(av[host][r][k],saved['host_means'][host][r][k]);counts['metric_cells']+=1
        chk(macro[r][k],saved['macro'][r][k]);counts['metric_cells']+=1
gate=all(macro[candidate][k]<macro[r][k] for r in roles[1:] for k in (0,1)) and all(v[candidate][k]<v[r][k] for v in av.values() for r in ['blue_persistence','fit_blue_red_slope'] for k in (0,1)) and wins>=7
assert gate==saved['gate'] and wins==saved['wins']
e,host,t,j,y,arms=worst
w=saved['worst'];assert [host,t,fore[host]['detunings'][j]]==[w['host'],w['T'],w['detuning']]
chk(y,w['observed']);chk(e,w['abs_error'])
for r in roles:chk(arms[r][j],w['same_cell_predictions'][r])
print(json.dumps({'counts':counts,'gate':gate,'wins':wins,'worst':[host,str(t),int(w['detuning']),str(e)],'max_scaled_delta':str(maximum),'sha_forecast':'3c8be4fa779779221fbb2d6d4ef997a5ca36679320294f139693cb41d9628839','source':'fresh author ZIP, independent workbook parser and Decimal coordinates, locked forecasts; predictor and scorer not imported'},sort_keys=True))
