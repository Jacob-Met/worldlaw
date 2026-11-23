"""Inspect paths and author-labeled axes, leaving measurement cell contents out of outputs."""
import ctypes,ctypes.util,hashlib,io,json,posixpath,re,urllib.request,zipfile
from xml.etree import ElementTree as ET
URL="https://zenodo.org/records/8371594/files/Data.rar?download=1"
def original_members():
    with urllib.request.urlopen(urllib.request.Request(URL,headers={"User-Agent":"published archive member source qualification"}),timeout=120) as f:
        data=f.read(200000)
    assert hashlib.md5(data).hexdigest()=="ce4c81b8066b5d098b6572162ea7de1c"
    lib=ctypes.CDLL(ctypes.util.find_library("archive") or "libarchive.so")
    def fn(name, res, *args):
        func=getattr(lib,name);func.restype=res;func.argtypes=list(args);return func
    ptr=ctypes.c_void_p;i=ctypes.c_int
    make=fn("archive_read_new",ptr);r=make();assert r
    rd=fn("archive_read_data",ctypes.c_ssize_t,ptr,ptr,ctypes.c_size_t)
    close=fn("archive_read_free",i,ptr)
    try:
        assert fn("archive_read_support_filter_all",i,ptr)(r)>=0
        assert fn("archive_read_support_format_all",i,ptr)(r)>=0
        raw=ctypes.create_string_buffer(data)
        assert fn("archive_read_open_memory",i,ptr,ptr,ctypes.c_size_t)(r,raw,len(data))==0
        nxt=fn("archive_read_next_header",i,ptr,ctypes.POINTER(ptr))
        pathname=fn("archive_entry_pathname",ctypes.c_char_p,ptr)
        size=fn("archive_entry_size",ctypes.c_longlong,ptr)
        while True:
            ent=ptr();st=nxt(r,ctypes.byref(ent))
            if st==1:break
            assert st==0,st
            path=pathname(ent).decode("utf-8");n=size(ent);assert 0<=n<10000000
            buf=ctypes.create_string_buffer(max(1,n));off=0
            while off<n:
                k=rd(r,ctypes.byref(buf,off),n-off);assert k>0,(path,k);off+=k
            yield path,bytes(buf[:n])
    finally:close(r)
NS="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
def sheets(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        shared=[]
        if "xl/sharedStrings.xml" in z.namelist():
            shared=["".join(v.text or "" for v in p.iter(NS+"t")) for p in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        for n in sorted(n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet[0-9]+\.xml",n)):
            root=ET.fromstring(z.read(n));rows=root.findall(".//"+NS+"row")
            yield n,rows,shared
def cell_text(cell,shared):
    v=cell.find(NS+"v")
    if cell.get("t")=="s":return shared[int(v.text)]
    if cell.get("t")=="inlineStr":return "".join(x.text or "" for x in cell.iter(NS+"t"))
    return None
def source_schema():
    out={}
    for n,d in original_members():
        if n.lower().endswith(".xlsx"):
            tables=[]
            for name,rows,shared in sheets(d):
                labels=[];counts={}
                for row in rows:
                    for c in row.findall(NS+"c"):
                        adr=c.get("r")
                        if re.fullmatch(r"[A-Z]+[1-9][0-9]*",adr) is None:raise ValueError("cell address")
                        col=re.match(r"[A-Z]+",adr)[0];counts[col]=counts.get(col,0)+1
                        t=cell_text(c,shared)
                        if t is not None and int(row.get("r"))<=2 and len(t)<140 and re.search(r"pressure|freq|velocity|speed|^v[ps]|^p.wave|^s.wave|mpa|hz|km/s|m/s",t,re.I):
                            labels.append([adr,re.sub(r"[0-9]+(?:[.][0-9]+)?","<numeric>",t)])
                tables.append({"sheet":name,"rows":len(rows),"column_cell_counts":counts,"text_labels":labels[:30],"text_label_count":len(labels)})
            out[n]={"sha256":hashlib.sha256(d).hexdigest(),"sheets":tables}
        elif n.lower().endswith(".docx"):
            with zipfile.ZipFile(io.BytesIO(d)) as z:
                rt=ET.fromstring(z.read("word/document.xml"))
            ns="{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
            paras=["".join(t.text or "" for t in p.iter(ns+"t")) for p in rt.iter(ns+"p")]
            out[n]={"description":[re.sub(r"[0-9]+(?:[.][0-9]+)?","<numeric>",p)[:600] for p in paras if p.strip()],"sha256":hashlib.sha256(d).hexdigest()}
        elif n.lower().endswith(".txt"):
            out[n]={"bytes":len(d),"sha256":hashlib.sha256(d).hexdigest()}
    return out
if __name__=="__main__":print(json.dumps(source_schema(),sort_keys=True))
