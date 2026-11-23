"""Confirm release bindings and inspect only one named development trace."""
import hashlib,json,urllib.request,urllib.parse
from pathlib import Path
from catalog import SOURCE,fetch

def manifest():
    prior={x["name"]:x["id"] for x in json.loads(Path("catalog-result.json").read_bytes())["entries"]}
    rows=fetch(SOURCE+"?folder_id=root&version=1")
    assert isinstance(rows,list) and len(rows)==len(prior)==72
    assert {x["filename"]:x["id"] for x in rows}==prior
    return {x["filename"]:x for x in rows}
def body(x):
    u=x["content_details"]["download_url"]
    req=urllib.request.Request(u,headers={"User-Agent":"Public scientific source reader"})
    with urllib.request.urlopen(req,timeout=90) as f:b=f.read(6000000)
    assert len(b)==x["size"] and len(b)<6000000
    return b
if __name__=="__main__":
    roster=manifest()
    split=json.loads(Path("split.json").read_bytes())
    assert set(split["source"]+split["held"])==set(roster) and len(split["source"])==44 and len(split["held"])==28
    name="TEG1_1.txt"
    assert name in split["source"]
    row=roster[name];b=body(row)
    print(json.dumps({"development_file":name,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"top":b[:1800].decode("latin-1"),"bottom":b[-450:].decode("latin-1"),"content_detail_keys":sorted(row["content_details"]),"source_count":44,"held_count":28,"held_read":0},sort_keys=True))
