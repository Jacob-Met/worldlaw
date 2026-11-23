"""Inventory the original public archive without decoding scientific members."""
import hashlib,io,json,urllib.request
import rarfile
URL="https://zenodo.org/records/8371594/files/Data.rar?download=1"
request=urllib.request.Request(URL,headers={"User-Agent":"public scientific archive metadata reader"})
with urllib.request.urlopen(request,timeout=120) as f:b=f.read(200000)
assert hashlib.md5(b).hexdigest()=="ce4c81b8066b5d098b6572162ea7de1c"
with rarfile.RarFile(io.BytesIO(b)) as r:
    members=[{"path":i.filename,"bytes":i.file_size,"crc":i.CRC,"method":i.compress_type,"directory":i.isdir()} for i in r.infolist()]
print(json.dumps({"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"members":members,"scientific_member_values_opened":0},sort_keys=True))
