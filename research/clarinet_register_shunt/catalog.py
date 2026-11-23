"""Verify the authors' archive and report member names, sizes, and CRC only."""
import hashlib,json,os,pathlib,tempfile,urllib.request,zipfile
URL="https://zenodo.org/api/records/16169580"
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"WORLDLAW-acquisition-metadata/1.0","Accept-Encoding":"identity"}),timeout=120)
with get(URL) as f:rec=json.load(f)
assert str(rec["id"])=="16169580"
rows=[(r["key"],r["checksum"]) for r in rec["files"]]
assert rows==[("ClarinetRegisterHole.zip","md5:b0a4803fad80df3e512b9acbf0652640")]
r=rec["files"][0];folder=pathlib.Path(tempfile.mkdtemp(prefix="clarinet-author-",dir=os.environ.get("TMPDIR")));file=folder/r["key"]
md=hashlib.md5();sha=hashlib.sha256()
with get(r["links"].get("content") or r["links"]["self"]) as src,file.open("xb") as dst:
    while b:=src.read(1024*1024):
        md.update(b);sha.update(b);dst.write(b)
assert file.stat().st_size==r["size"] and md.hexdigest()=="b0a4803fad80df3e512b9acbf0652640"
print("EXACT",str(file),file.stat().st_size,sha.hexdigest(),flush=True)
with zipfile.ZipFile(file) as z:
    names=[[v.filename,v.file_size,format(v.CRC,"08x")] for v in z.infolist() if not v.is_dir()]
print(json.dumps(dict(doi=rec.get("doi"),members=names,decoded_members=0),sort_keys=True))
