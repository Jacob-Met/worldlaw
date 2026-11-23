"""Read v2 sheet dimensions, merges, nonnumeric header strings and author code roster without interpreting measured values."""
import hashlib,io,json,re,urllib.parse,urllib.request,zipfile
import xml.etree.ElementTree as ET
from pathlib import PurePosixPath
SOURCE="https://zenodo.org/records/5764145/files/"
FILES={"S7_codes_data analysis.zip":[5270,"a3112ca12221beeffa412f9eb177a217"],"S3_data_granular flow_flow depth.xlsx":[42860,"44cfeaf1c5cc67367346aef0162d7197"],"S2_data_granular flow_stress.xlsx":[7829391,"f3ed584320c4ddca763a17e9af069a0a"],"S1_data_granular flow_velocity.xlsx":[412045,"52d13f622f2fd5bcb93d9422122529c5"]}
NS="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
def source(n):
    size,md5=FILES[n]
    u=SOURCE+urllib.parse.quote(n)+"?download=1"
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"physical experiment schema and unit audit"}),timeout=120) as f:b=f.read(size+1)
    assert len(b)==size and hashlib.md5(b).hexdigest()==md5,n
    return b
def structures(n,b):
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        if n.endswith(".zip"):return {"code":[[p.filename,p.file_size,hashlib.sha256(z.read(p)).hexdigest()] for p in z.infolist() if not p.is_dir()]}
        wb=ET.fromstring(z.read("xl/workbook.xml"));sheets=wb.find(NS+"sheets")
        rel=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"));refs={e.get("Id"):e.get("Target") for e in rel}
        ss=[]
        if "xl/sharedStrings.xml" in z.namelist():ss=["".join(t.text or "" for t in p.iter(NS+"t")) for p in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        result=[]
        for sh in sheets:
            ref=sh.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id");path=refs[ref]
            path=path.lstrip("/") if path.startswith("/") else "xl/"+path
            root=ET.fromstring(z.read(path));dim=root.find(NS+"dimension");titles=[]
            for row in root.findall(".//"+NS+"row"):
                if int(row.get("r"))>7:break
                for cell in row.findall(NS+"c"):
                    value=cell.find(NS+"v");ty=cell.get("t")
                    if ty=="s" and value is not None:text=ss[int(value.text)]
                    elif ty=="inlineStr":text="".join(t.text or "" for t in cell.iter(NS+"t"))
                    else:continue
                    if re.search(r"[a-zA-Z]",text) and not re.fullmatch(r"[+-]?[0-9.eE+-]+",text.strip()) and len(text)<300:
                        titles.append([cell.get("r"),text.strip()])
            result.append({"sheet":sh.get("name"),"state":sh.get("state","visible"),"dimension":dim.get("ref") if dim is not None else None,"headers":titles[:120],"header_count":len(titles),"merges":[r.get("ref") for r in root.findall(".//"+NS+"mergeCell")][:80]})
        return {"sheets":result}
if __name__=="__main__":
    res={}
    for n in sorted(FILES):
        b=source(n);res[n]={"sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b),**structures(n,b)}
    print(json.dumps(res,sort_keys=True,ensure_ascii=True))
