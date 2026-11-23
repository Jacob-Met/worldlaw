"""Read only designated channels from the three pinned public files."""
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ROOT = 'https://data.mendeley.com/public-api/datasets/g86rtgzvkh'
HDR = {'User-Agent':'public scientific record reader', 'Accept':'application/vnd.mendeley-public-dataset.1+json'}
PROTOCOL = json.loads(Path(__file__).with_name('protocol.json').read_bytes())

def workbook(year):
    fid, digest = PROTOCOL['files'][str(year)]
    req = urllib.request.Request(ROOT+'/files?folder_id=root&version=2&$start=0&$limit=1000',headers=HDR)
    with urllib.request.urlopen(req, timeout=60) as reply:
        rows = json.load(reply)
    rec, = [r for r in rows if r['id']==fid]
    req = urllib.request.Request(rec['content_details']['download_url'], headers={'User-Agent':HDR['User-Agent']})
    with urllib.request.urlopen(req,timeout=90) as reply:
        contents = reply.read()
    assert len(contents)==rec['size'] and hashlib.sha256(contents).hexdigest()==digest
    return contents

def read(year, target=False, targets_only=False):
    data=workbook(year)
    out=[]
    allowed={'A','B','C','D'} | (set() if targets_only else {'E','H','L'}) | ({'I'} if target or targets_only else set())
    with zipfile.ZipFile(io.BytesIO(data)) as z, z.open('xl/worksheets/sheet1.xml') as f:
        for _,row in ET.iterparse(f,events=('end',)):
            if row.tag!='{'+NS['s']+'}row':continue
            if row.get('r')=='1':
                row.clear()
                continue
            vals={}
            for cell in row.findall('s:c',NS):
                col=re.fullmatch(r'([A-Z]+)[0-9]+',cell.get('r')).group(1)
                if col not in allowed:continue
                v=cell.findtext('s:v',None,NS)
                if v is None or cell.get('t') not in (None,'n'):
                    vals[col]=None
                else:vals[col]=float(v)
            row.clear()
            if all(vals.get(c) is None for c in 'ABCD'):
                if any(vals.get(c) is not None for c in allowed-{'A','B','C','D'}):raise ValueError('science without timestamp')
                continue
            timestamp=dt.datetime(*(int(vals[c]) for c in 'ABCD'))
            assert timestamp.year==year
            out.append((timestamp,vals))
    if len({t for t,_ in out})!=len(out):raise ValueError('duplicate archive timestamps')
    if any(a[0]>=b[0] for a,b in zip(out,out[1:])):raise ValueError('nonmonotonic archive timestamps')
    return out
