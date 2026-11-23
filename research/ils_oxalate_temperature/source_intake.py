import json,hashlib,urllib.request
def get(url,limit=600000):
 with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"HAMON public package design metadata"}),timeout=35) as r:
  x=r.read(limit+1)
  assert len(x)<=limit
  return x
host="https://api.github.com/repos/cran/ILS";head=json.loads(get(host+"/commits/HEAD"))["sha"];tree=json.loads(get(host+"/git/trees/"+head+"?recursive=1"));assert not tree["truncated"]
entries={v["path"]:v for v in tree["tree"] if v["type"]=="blob"}
def gitblob(b):return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
docs={}
for f in ["DESCRIPTION","man/TG.Rd","man/DSC.Rd","man/IDT.Rd"]:
 if f not in entries:continue
 b=get("https://raw.githubusercontent.com/cran/ILS/"+head+"/"+f);assert gitblob(b)==entries[f]["sha"]
 docs[f]={"bytes":len(b),"sha":entries[f]["sha"],"sha256":hashlib.sha256(b).hexdigest(),"text":b.decode()}
print(json.dumps({"mirror":"CRAN/ILS","head":head,"doc":docs,"data_catalog":[{"path":k,"bytes":v.get("size"),"git":v["sha"]} for k,v in entries.items() if k.startswith("data/")],"thermogravimetric_or_calorimetric_bytes_opened":False},sort_keys=True))