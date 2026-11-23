"""Check every released clock and raw-column support without returning stress, kinematics, or depth."""
import collections,hashlib,io,json,re,zipfile
from decimal import Decimal as D
from xml.etree import ElementTree as ET
from schema import source,FILES,NS
def letters(k):
    n=0
    for c in k:n=n*26+ord(c)-64
    return n
def val(c,ss):
    if c is None:return None
    v=c.find(NS+"v")
    if v is None or v.text is None:return None
    return ss[int(v.text)] if c.get("t")=="s" else v.text
def run_clock(n,b):
    out={}
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        ss=["".join(t.text or "" for t in p.iter(NS+"t")) for p in ET.fromstring(z.read("xl/sharedStrings.xml"))] if "xl/sharedStrings.xml" in z.namelist() else []
        rel={e.get("Id"):e.get("Target") for e in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        wb=ET.fromstring(z.read("xl/workbook.xml"));sheets=wb.find(NS+"sheets")
        for sh in sheets:
            name=sh.get("name");r=rel[sh.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
            root=ET.fromstring(z.read(r.lstrip("/") if r.startswith("/") else "xl/"+r)); rows=[]
            for row in root.findall(".//"+NS+"row"):
                rows.append({letters(re.match(r"[A-Z]+",c.get("r"))[0]):c for c in row.findall(NS+"c")})
            if n.startswith("S2"):
                ids={k:val(v,ss) for k,v in rows[1].items() if re.fullmatch(r"g[1-9]",str(val(v,ss)))}
                for k,g in ids.items():
                    times=[];raw_missing=0;signal_off_axis=0;first=None;last=None;holes=0;fbase=0
                    for i,rr in enumerate(rows[3:],4):
                        vv=val(rr.get(k),ss);rc=rr.get(k+1)
                        has=rc is not None and rc.find(NS+"v") is not None
                        if vv is None:
                            signal_off_axis+=int(has);continue
                        tt=D(vv);first=i if first is None else first;last=i
                        times.append(tt);raw_missing+=int(not has);fbase+=int(rc is not None and rc.find(NS+"f") is not None)
                    diffs=[v-u for u,v in zip(times,times[1:])]
                    positive=all(v>0 for v in diffs)
                    out[name+":"+g]={"n":len(times),"first_row":first,"last_row":last,"row_span":last-first+1,"t0":str(times[0]),"tlast":str(times[-1]),"min_step":str(min(diffs)),"max_step":str(max(diffs)),"max_1ms_grid_error":str(max(abs(t-times[0]-D(i)/1000) for i,t in enumerate(times))),"positive":positive,"missing_raw":raw_missing,"unclocked_raw":signal_off_axis,"raw_formula_cells":fbase}
            elif n.startswith("S1"):
                label_row=next(i for i,rr in enumerate(rows[:7]) if any(re.fullmatch(r"g[1-9]",str(val(v,ss))) for v in rr.values()))
                markers={k:val(v,ss) for k,v in rows[label_row].items() if re.fullmatch(r"g[1-9]",str(val(v,ss)))}
                for ik,(k,g) in enumerate(sorted(markers.items())):
                    end=sorted(markers)[ik+1] if ik+1<len(markers) else max(rows[label_row+2])+1
                    q=[]
                    for col in range(k,end):
                        if "u velocity" in str(val(rows[label_row+2].get(col),ss)):
                            tt=val(rows[label_row+1].get(col),ss)
                            if tt is not None:q.append(tt)
                    out[name+":"+g]={"declared_time_coordinates":q}
            else:
                cond={k:val(v,ss) for k,v in rows[0].items() if re.fullmatch(r"IMF-2[1-3][1-5]",str(val(v,ss)))}
                for k,c in cond.items():
                    q=[D(t) for rr in rows[3:] if (t:=val(rr.get(k),ss)) is not None]
                    out[c+":"+str(val(rows[1].get(k),ss))]={"n":len(q),"t0":str(q[0]),"tlast":str(q[-1]),"min_step":str(min(b-a for a,b in zip(q,q[1:])))}
    return out
if __name__=="__main__":
    out={}
    for n in FILES:
        b=source(n)
        if n.startswith("S7"):
            with zipfile.ZipFile(io.BytesIO(b)) as z:out[n]={p:z.read(p).decode("utf-8-sig",errors="replace") for p in z.namelist() if "/Stress/" in p and not p.endswith("/")}
        else:out[n]=run_clock(n,b)
    print(json.dumps(out,sort_keys=True,ensure_ascii=True))
