"""Read only the registered figure-A workbooks and the permitted branch coordinates."""
import bisect
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
SPEC = json.loads((Path(__file__).parent / 'protocol.json').read_text())
def acquisition():
    headers={'User-Agent':'worldlaw-public-metadata-reader/1.0'}
    api=urllib.request.Request('https://zenodo.org/api/records/21387374',headers=headers)
    with urllib.request.urlopen(api,timeout=75) as fp: record=json.load(fp)
    entry,=record['files']
    assert str(record['id'])=='21387374' and entry['checksum']=='md5:'+SPEC['archive']['md5']
    request=urllib.request.Request(entry['links']['self'],headers=headers)
    with urllib.request.urlopen(request,timeout=90) as source:
        raw = source.read(3809364)
    if len(raw)!=3809363 or hashlib.sha256(raw).hexdigest()!=SPEC['archive']['sha256']:
        raise ValueError('original archive integrity')
    return zipfile.ZipFile(io.BytesIO(raw))

def emit_json(obj):
    return json.dumps(obj,allow_nan=False,sort_keys=True,separators=(',',':'))

def shift(d,host):
    a,s=host['as'],host['s']
    if d<=a[0]:
        return d+s[0]-a[0]
    if d>=a[-1]:
        return d+s[-1]-a[-1]
    j=bisect.bisect_right(a,d)-1
    return s[j]+(d-a[j])*(s[j+1]-s[j])/(a[j+1]-a[j])

def load_host(archive,h,receiving=False):
    name,= [n for n in archive.namelist() if Path(n).name==h['file']]
    with zipfile.ZipFile(io.BytesIO(archive.read(name))) as z:
        workbook=ET.fromstring(z.read('xl/workbook.xml'))
        relations=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        sheet,=[e for e in workbook.iter(M+'sheet') if e.get('name')==h['sheet']]
        path,=[r.get('Target').lstrip('/') for r in relations if r.get('Id')==sheet.get(R+'id')]
        xml=ET.fromstring(z.read(path if path.startswith('xl/') else 'xl/'+path))
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            strings=[''.join(t.text or '' for t in e.iter(M+'t')) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    cells={c.get('r'):c for c in xml.iter(M+'c')}
    def label(col):
        c=cells[col+'2']
        if c.get('t')=='s':
            return strings[int(c.findtext(M+'v'))]
        return ''.join(v.text or '' for v in c.iter(M+'t'))
    def number(addr):
        cell=cells[addr]
        value=float(cell.findtext(M+'v'))
        if not math.isfinite(value):raise ValueError(addr)
        return value
    dgrid=list(range(h['band'][0],h['band'][1]+1,5))
    u0=1e7/h['lambda0_nm']
    records=[]
    for i,col in enumerate(h['cols']):
        temp=round(h['T_start']+i*h['T_step'],2)
        assert float(label(col).strip().rstrip('K'))==temp
        axis=h['axis_last'] if i==len(h['cols'])-1 else h['axis']
        assert label(axis)=='x(cm-1)'
        grid=sorted((number(addr),int(addr[len(axis):])) for addr in cells if re.fullmatch(axis+r'\d+',addr) and int(addr[len(axis):])>=3 and cells[addr].findtext(M+'v') is not None)
        uu=[g[0] for g in grid]
        assert len(uu)>=250 and all(x<y for x,y in zip(uu,uu[1:]))
        held=i>=h['n']-5
        def sample(u,side):
            j=bisect.bisect_left(uu,u)
            assert 0<j<len(uu)
            lo,rowlo=grid[j-1]
            hi,rowhi=grid[j]
            if held and side=='blue' and not receiving:raise ValueError('sealed blue')
            if side=='red' and hi>=u0:raise ValueError('red bracket crosses nominal ZPL')
            if side=='blue' and lo<=u0:raise ValueError('blue bracket crosses nominal ZPL')
            a,b=number(col+str(rowlo)),number(col+str(rowhi))
            out=a+(b-a)*(u-lo)/(hi-lo)
            return out,[rowlo,rowhi,lo,hi,a,b,u]
        red=[sample(u0-shift(d,h),'red')[0] for d in dgrid]
        scale=sum(red)/len(red)
        assert scale>0 and math.isfinite(scale)
        r={'T':temp,'held':held,'red':[v/scale for v in red],'scale':scale,'column':col}
        if receiving or not held:
            blue=[sample(u0+d,'blue') for d in dgrid]
            r['blue']=[v/scale for v,_ in blue]
            if receiving:r['raw_blue']=[native for _,native in blue]
        records.append(r)
    return dgrid,records
