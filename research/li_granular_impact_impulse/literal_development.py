"""Expose only named development trace and optical-row *labels* for a premeasurement methods check."""
import io,json,hashlib,zipfile,math
from xml.etree import ElementTree as ET
from schema import source,FILES,NS
from clock_and_repeat import letters,val
import re
def books(n):
    b=source(n)
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        rr=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"));rel={x.get("Id"):x.get("Target") for x in rr}
        wb=ET.fromstring(z.read("xl/workbook.xml"));ss=["".join(z.text or "" for z in e.iter(NS+"t")) for e in ET.fromstring(z.read("xl/sharedStrings.xml"))] if "xl/sharedStrings.xml" in z.namelist() else []
        for x in wb.find(NS+"sheets"):
            p=rel[x.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
            root=ET.fromstring(z.read(p.lstrip("/") if p.startswith("/") else "xl/"+p))
            yield x.get("name"),[{letters(re.match(r"[A-Z]+",e.get("r"))[0]):e for e in row.findall(NS+"c")} for row in root.findall(".//"+NS+"row")],ss
def filt(raw,half,cycles):
    x=raw[:]
    for _ in range(cycles):
        pad=[raw[0]]*half+x+[raw[-1]]*half
        x=[math.fsum(pad[i:i+2*half+1])/(2*half+1) for i in range(len(raw))]
    return x
if __name__=="__main__":
    out={}
    n=next(n for n in FILES if n.startswith("S2"));name,rows,ss=next(t for t in books(n) if t[0]=="IMF-223")
    k=next(k for k,c in rows[1].items() if val(c,ss)=="g3")
    assert val(rows[2][k+1],ss)=="σi (Pa)"
    vals=[[float(val(r[k+j],ss)) for j in [0,1,2,3]] for r in rows[3:] if val(r.get(k),ss) is not None]
    raw=[x[1] for x in vals];printed=[x[2] for x in vals]
    for label,y in [("literal_21x30",filt(raw,10,30)),("single_21",filt(raw,10,1))]:
        diff=[a-b for a,b in zip(y,printed)];wi=max(range(len(diff)),key=lambda i:abs(diff[i]))
        out[label]={"n":len(raw),"rmse":math.sqrt(math.fsum(d*d for d in diff)/len(diff)),"max_abs":abs(diff[wi]),"worst":{"index":wi,"record":vals[wi],"predicted":y[wi]}}
    out["decomposition_max_error"]=max(abs(row[1]-row[2]-row[3]) for row in vals)
    n=next(n for n in FILES if n.startswith("S1"));summ={}
    for name,rows,ss in books(n):
        labels=[]
        for i,row in enumerate(rows):
            for k,c in row.items():
                if c.get("t")!="s":continue
                s=val(c,ss)
                if s and any(w in s.lower() for w in ["shear","average","rate","bottom","depth","stress","height"]) and not(i<=6 and k>4):labels.append([i+1,k,s[:100]])
        summ[name]=labels[:35]
    out["source_piv_labels"]=summ
    print(json.dumps(out,sort_keys=True))
