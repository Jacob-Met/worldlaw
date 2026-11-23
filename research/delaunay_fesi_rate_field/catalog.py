"""Read only archive names and the authors' acquisition cover. No loop members are decoded."""
import collections
import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile
import urllib.request
import zipfile

ROOT = pathlib.Path(tempfile.mkdtemp(prefix="fesi-release-", dir=os.environ.get("TMPDIR")))
API = "https://zenodo.org/api/records/17579041"
PINS = {
    "DatasetCover.pdf":"6e714ca971baa3d93031003dba06c7f2",
    "Ring20_Dataset_Txt.zip":"b37ee99b7e4f57e0efc8ba12245cf166",
    "Ring35_Dataset_Txt.zip":"026d6bc932667b6522032bad008d4ce0",
}

def fetch(url):
    req = urllib.request.Request(url,headers={"User-Agent":"WORLDLAW-source-metadata/1.0","Accept-Encoding":"identity"})
    return urllib.request.urlopen(req, timeout=120)

with fetch(API) as response:
    meta = json.load(response)
if str(meta["id"])!="17579041":
    raise ValueError("record")
print("RELEASE",meta.get("doi"),ROOT,flush=True)
for row in sorted(meta["files"], key=lambda f:f["key"]):
    name = row["key"]
    if row["checksum"]!="md5:"+PINS[name]:
        raise ValueError(("publisher checksum",name,row["checksum"]))
    out=ROOT/name
    md=hashlib.md5()
    sh=hashlib.sha256()
    with fetch(row["links"].get("content") or row["links"]["self"]) as response, out.open("xb") as dst:
        while data:=response.read(1024*1024):
            md.update(data)
            sh.update(data)
            dst.write(data)
    assert out.stat().st_size==row["size"] and md.hexdigest()==PINS[name]
    print("EXACT",name,out.stat().st_size,sh.hexdigest(),flush=True)
    if name.endswith("pdf"):
        doc=subprocess.check_output(["pdftotext","-layout",str(out),"-"],encoding="utf-8")
        for n,line in enumerate(doc.splitlines(),1):
            print("COVER",n,line,flush=True)
    else:
        with zipfile.ZipFile(out) as archive:
            members=[i.filename for i in archive.infolist() if not i.is_dir()]
        forest=collections.defaultdict(list)
        for n in members:
            parent,_,leaf=n.rpartition("/")
            forest[parent].append(leaf)
        print("MEMBER_TOTAL",len(members),"DIRECTORIES",len(forest),flush=True)
        for parent,names in sorted(forest.items()):
            print("GROUP",parent,len(names),json.dumps(sorted(names)[:3]),json.dumps(sorted(names)[-1:]),flush=True)
print("COMPLETE: loop data members read = 0",flush=True)
