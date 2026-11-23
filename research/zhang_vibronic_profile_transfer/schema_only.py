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
                heads=[]
                for c in cells.iter(M+'c'):
                    pos=c.get('r','')
                    if not re.fullmatch(r'[A-Z]+[1-3]',pos):continue
                    ct=c.get('t')
                    if ct=='s':
                        t=sts[int(c.findtext(M+'v'))]
                    elif ct=='inlineStr':
                        t=''.join(v.text or '' for v in c.iter(M+'t'))
                    else:continue
                    if len(t)<=100 and (re.fullmatch(r'\s*\d{2,3}\s*(K|[kK]elvin)\s*',t) or re.search(r'[a-zA-Z\u4e00-\u9fff]{2,}',t)):
                        heads.append((pos,t))
                print(json.dumps({'file':name,'sheet':sheet.get('name'),'dim':cells.find(M+'dimension').get('ref'),'text_headers_only':heads}),flush=True)
