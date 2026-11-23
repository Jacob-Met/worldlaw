"""Read publisher DOI and file/folder identities without reading any scientific member."""
import json,hashlib,urllib.request,urllib.parse
from collections import Counter
SOURCE="https://data.mendeley.com/public-api/datasets/tfg4byhch8/files"
def fetch(u):
    req=urllib.request.Request(u,headers={"User-Agent":"Public source-catalog reader for a thermoelectric measurement study"})
    with urllib.request.urlopen(req,timeout=45) as f:
        b=f.read(4000000)
        if len(b)>=4000000:raise ValueError("unexpected metadata page length")
        return json.loads(b)
if __name__=="__main__":
    d=fetch("https://api.datacite.org/dois/10.17632/tfg4byhch8.1")["data"]["attributes"]
    report={"doi":d["doi"],"title":d["titles"],"version":d.get("version"),"rights":d["rightsList"],
            "publisher":d["publisher"],"created":d["created"],"accounts":False,"payloads":0}
    try:
        visited=set();listing=[];todo=["root"]
        while todo:
            folder=todo.pop()
            if folder in visited:raise ValueError("cycle")
            visited.add(folder)
            a=fetch(SOURCE+"?"+urllib.parse.urlencode({"folder_id":folder,"version":1}))
            rows=a if isinstance(a,list) else a.get("files",a.get("items",[]))
            if not rows:raise ValueError("unqualified or empty catalog "+str(type(a)))
            for x in rows:
                label=x.get("filename") or x.get("name") or x.get("label")
                isfolder=x.get("type")=="folder" or x.get("is_folder") is True or x.get("folder") is True
                meta={"id":x.get("id"),"name":label,"folder":folder,"folder_entry":isfolder,"keys":sorted(x),"type":x.get("type")}
                if isfolder:todo.append(x["id"])
                listing.append(meta)
        report["entries"]=listing;report["folders"]=sorted(visited)
    except Exception as exc:
        report["source_refusal"]=[type(exc).__name__,str(exc)]
        print(json.dumps(report,sort_keys=True));raise
    print(json.dumps(report,sort_keys=True))
