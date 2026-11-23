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
with zipfile.ZipFile(io.BytesIO(blob)) as archive:
    items=[dict(name=v.filename,size=v.file_size,crc32=format(v.CRC,"08x")) for v in archive.infolist() if not v.is_dir()]
    assert len(items)<=900
    assert len(json.dumps(items,ensure_ascii=True).encode())<60000,"roster output exceeds bounded catalog receipt"
    print(json.dumps({"source_sha256":hashlib.sha256(blob).hexdigest(),"member_count":len(items),"members":items,"expanded_scientific_members":0},ensure_ascii=True),flush=True)
