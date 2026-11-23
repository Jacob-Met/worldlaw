"""Inventory conditions and read author README members exclusively."""
import csv,hashlib,json,pathlib,re,sys,zipfile
root=pathlib.Path(sys.argv[1])
rows=[]
def emit(kind,**kw): print(json.dumps(dict(kind=kind,**kw),sort_keys=True),flush=True)
for n in (20,35):
    fn="Ring%d_Dataset_Txt.zip"%n
    with zipfile.ZipFile(root/fn) as z:
        for m in z.infolist():
            p=pathlib.PurePosixPath(m.filename)
            if not m.filename.startswith("Ring%d_Dataset_Txt/"%n) or m.is_dir() or p.name.startswith("."):continue
            if "readme" in p.name.lower():
                raw=z.read(m);emit("readme",ring=n,path=m.filename,sha256=hashlib.sha256(raw).hexdigest(),utf8=raw.decode("utf-8-sig",errors="replace"))
            else:
                rows.append([n,m.filename,m.file_size,"%08x"%m.CRC])
emit("census",rows=rows)
