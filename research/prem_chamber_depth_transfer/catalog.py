"""Inventory authentic ReBL software and published workbook axes before spectra."""
import hashlib
import io
import json
import pathlib
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT="https://zenodo.org/records/6757550/files/"
FILES={"codes.zip":"0dc715ffcbadaefa2674f758ccd54e4f","lab_spectra.xlsx":"79f07ba24d16490dd91984d7b136944c","flowchart.pdf":"95cedf67c3d5f57061237a4dc1695a97"}
def digest(b):return hashlib.sha256(b).hexdigest()
def fetch(name):
    url=ROOT+name+"?download=1"
    req=urllib.request.Request(url,headers={"User-Agent":"public ReBL scientific source qualification"})
    with urllib.request.urlopen(req,timeout=75) as response:b=response.read()
    assert hashlib.md5(b).hexdigest()==FILES[name]
    return b
rows={}
out={"record":6757550,"files":rows,"scientific_numeric_cells_emitted":0}
for name in FILES:
    b=fetch(name)
    pathlib.Path(name).write_bytes(b)
    rows[name]={"n":len(b),"sha256":digest(b),"md5":FILES[name]}
with zipfile.ZipFile("codes.zip") as z:
    out["code_archive"]=[{"name":x.filename,"bytes":x.file_size} for x in z.infolist() if "__MACOSX" not in x.filename]
ns="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
with zipfile.ZipFile("lab_spectra.xlsx") as x:
    book=ET.fromstring(x.read("xl/workbook.xml"))
    sheets=[s.get("name") for s in book.find(ns+"sheets")]
    strings=[]
    if "xl/sharedStrings.xml" in x.namelist():
        strings=["".join(t.text or "" for t in s.iter(ns+"t")) for s in ET.fromstring(x.read("xl/sharedStrings.xml"))]
    out["sheets"]=sheets
    out["text_labels_and_dimensions"]={}
    for p in x.namelist():
        if not re.fullmatch(r"xl/worksheets/sheet\d+\.xml",p):continue
        chunked=ET.iterparse(x.open(p),events=("end",))
        labels=[]
        for _,el in chunked:
            if el.tag==ns+"dimension":dimension=el.get("ref")
            if el.tag!=ns+"c":continue
            if el.get("t")=="s" and el.find(ns+"v") is not None:
                t=strings[int(el.findtext(ns+"v"))].strip()
                if any(ch.isalpha() for ch in t):
                    labels.append([el.get("r"),t[:950]])
            el.clear()
        out["text_labels_and_dimensions"][p]={"dimension":dimension,"text":labels[:90],"n_text":len(labels)}
print(json.dumps(out,sort_keys=True),flush=True)
