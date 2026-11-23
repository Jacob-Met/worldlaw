import hashlib,io,json,pathlib,urllib.request,zipfile
api="https://zenodo.org/api/records/21387374"
def read(url):
    request=urllib.request.Request(url,headers={"User-Agent":"worldlaw-public-metadata-reader/1.0"})
    with urllib.request.urlopen(request, timeout=75) as response:
        data=response.read(8400001)
    if len(data)>8400000:
        raise ValueError("bounded public object size")
    return data
record=json.loads(read(api))
assert str(record["id"])=="21387374"
entry,=record["files"]
assert entry["key"]=="Data for Science Advances revision.zip"
assert entry["checksum"]=="md5:cf4b6e063e57c95b99cf22a390f7684b"
print(json.dumps({"doi":record["doi"],"license":record.get("metadata",{}).get("license"),"access":record.get("access"),"name":entry["key"],"size":entry["size"]}),flush=True)
blob=read(entry["links"]["self"])
assert len(blob)==entry["size"] and hashlib.md5(blob).hexdigest()==entry["checksum"][4:]
import re,xml.etree.ElementTree as ET
M='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
P='{http://schemas.openxmlformats.org/package/2006/relationships}'
with zipfile.ZipFile(io.BytesIO(blob)) as outer:
    for info in outer.infolist():
        name=pathlib.PurePosixPath(info.filename).name
        if name not in {'Fig-2.xlsx','Fig-6.xlsx','Readme.docx'}: continue
        with zipfile.ZipFile(io.BytesIO(outer.read(info))) as inner:
            if name=='Readme.docx':
                doc=ET.fromstring(inner.read('word/document.xml'))
                w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                pp=[''.join((t.text or '') for t in p.iter(w+'t')) for p in doc.iter(w+'p')]
                for p in pp:
                    if len(p)<480 and re.search(r'normalized|unit|wavelength|wavenumber|raw data|figure 2|figure 6|zenodo|acqui|correct|spectral|energy scale',p,re.I):
                        print(json.dumps({'readme_method':p}),flush=True)
                continue
            wb=ET.fromstring(inner.read('xl/workbook.xml'))
            rel={e.attrib['Id']:e.attrib['Target'] for e in ET.fromstring(inner.read('xl/_rels/workbook.xml.rels'))}
            sts=[]
            if 'xl/sharedStrings.xml' in inner.namelist():
                stm=ET.fromstring(inner.read('xl/sharedStrings.xml'))
                sts=[''.join(t.text or '' for t in item.iter(M+'t')) for item in stm]
            for sheet in wb.iter(M+'sheet'):
                path=rel[sheet.attrib[R+'id']].lstrip('/')
                if not path.startswith('xl/'):path='xl/'+path
                cells=ET.fromstring(inner.read(path))
                if sheet.get('name') not in ('Fig2-A','Fig6-A'):continue
                axes=('A','U','Y','AS') if name=='Fig-2.xlsx' else ('A','S')
                header={}
                axes_vals={a:[] for a in axes}
                for cell in cells.iter(M+'c'):
                    addr=cell.get('r')
                    col,k=re.fullmatch(r'([A-Z]+)([0-9]+)',addr).groups()
                    k=int(k)
                    typ=cell.get('t','n')
                    value=cell.findtext(M+'v')
                    if k==2 and (value is not None or typ=='inlineStr'):
                        if typ=='s':header[col]=sts[int(value)]
                        elif typ=='inlineStr':header[col]=''.join(t.text or '' for t in cell.iter(M+'t'))
                        elif typ=='n' and value and 90<=float(value)<=500:header[col]=float(value)
                    if k>=4 and col in axes and typ=='n' and value is not None:
                        axes_vals[col].append([k,float(value)])
                import math
                from statistics import median
                rr={}
                for c,x in axes_vals.items():
                    assert all(math.isfinite(v) for _,v in x)
                    if not x: continue
                    ds=[b[1]-a[1] for a,b in zip(x,x[1:])]
                    rr[c]=[len(x),x[0],x[-1],min(ds),median(ds),max(ds),hashlib.sha256(json.dumps(x,separators=(',',':')).encode()).hexdigest()]
                print(json.dumps({'file':name,'row2_headers':header,'axis_only_from_row4':rr}),flush=True)
