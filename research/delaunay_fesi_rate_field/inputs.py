"""Read selected published SIN columns. H is decoded only when expressly requested."""
import io, pathlib, json, re, zipfile, numpy as np
def read_file(root,g,r,field=False):
    cols=[]; header=[]
    with zipfile.ZipFile(pathlib.Path(root)/("Ring%d_Dataset_Txt.zip"%g["ring"])) as z:
        info=z.getinfo(r["path"])
        assert (info.file_size,format(info.CRC,"08x"))==(r["size"],r["crc"])
        with z.open(info) as stream:
            for raw in stream:
                line=raw.decode("utf-8-sig").strip()
                if not line:continue
                parts=re.split(r"[\s,;]+",line)
                try: t=float(parts[0])
                except ValueError:
                    if cols: raise ValueError(("nonnumeric data row",r["path"]))
                    header.append(line); continue
                if len(parts)!=4:raise ValueError(("four columns required",r["path"],len(parts)))
                b,d=float(parts[2]),float(parts[3])
                cols.append((t,b,d,float(parts[1])) if field else (t,b,d))
    a=np.asarray(cols,float)
    if a.ndim!=2 or a.shape[0]<8 or not np.isfinite(a).all() or np.any(np.diff(a[:,0])<=0):
        raise ValueError(("finite ordered samples required",r["path"],a.shape))
    return a,header

def groups():return json.load(open("assignments.json"))["groups"]
