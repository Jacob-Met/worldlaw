"""Extract source-declared coordinates and count the remaining data cells without reading their values."""
import json,re
from source_schema import original_members,sheets,NS,cell_text
def read_axis(c,shared):
    t=cell_text(c,shared);v=c.find(NS+"v")
    return t if t is not None else (v.text if v is not None else None)
def occupied(c):
    return c is not None and (c.find(NS+"v") is not None or c.find(NS+"is") is not None or c.find(NS+"f") is not None)
def axes():
    out={}
    for n,d in original_members():
        if n.endswith(".txt"):
            out[n]=re.sub(r"[-+]?\d+[.]?\d*","<number>",d.decode("utf-8-sig",errors="replace"));continue
        if not n.endswith(".xlsx"):continue
        seismic="_Seismic_" in n
        for sheet,rows,ss in sheets(d):
            header=rows[0];assert header.get("r")=="1"
            labels={c.get("r"):cell_text(c,ss) for c in header.findall(NS+"c")}
            triples=[]
            for r in rows[1:]:
                cells={re.match(r"[A-Z]+",c.get("r"))[0]:c for c in r.findall(NS+"c")}
                coord=tuple(read_axis(cells[k],ss) if occupied(cells.get(k)) else None for k in ("AB" if seismic else "A"))
                triples.append((int(r.get("r")),coord,{k:occupied(c) for k,c in cells.items()}))
            out[n]={"header":labels,"rows":triples,"sheet":sheet}
    return out
if __name__=="__main__":print(json.dumps(axes(),sort_keys=True))
