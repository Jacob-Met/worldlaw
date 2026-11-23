"""Read the article-designated revised deposit's public file list only."""
import hashlib,json,urllib.request
u="https://zenodo.org/api/records/5764145"
with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"open granular flow release metadata assessment"}),timeout=120) as response:
    raw=response.read(2000000)
data=json.loads(raw)
assert str(data["id"])=="5764145"
files=[{k:r.get(k) for k in ["key","size","checksum"]} for r in data["files"]]
print(json.dumps({"id":data["id"],"doi":data.get("doi"),"concept":data.get("conceptrecid"),"version":data.get("metadata",{}).get("version"),"record_bytes":len(raw),"record_sha256":hashlib.sha256(raw).hexdigest(),"files":files,"opened_scientific_files":0},sort_keys=True))
