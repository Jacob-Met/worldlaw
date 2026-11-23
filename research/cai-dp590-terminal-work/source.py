"""Index Origin 9 worksheet records without decoding measurement cells."""
import json, pathlib, struct, sys

def section(f, read=False):
    n, newline=struct.unpack("<Ic",f.read(5))
    if newline!=b"\n":raise ValueError("Origin size delimiter")
    pos=f.tell()
    if not n:return n,pos,b""
    if read:
        data=f.read(n)
        if len(data)!=n:raise EOFError("worksheet header")
    else:
        data=b""
        f.seek(n,1)
    if f.read(1)!=b"\n":raise ValueError("Origin record delimiter")
    return n,pos,data

def index(path):
    with path.open("rb") as f:
        header=f.readline()
        if not header.startswith(b"CPYA 4.3168 "):raise ValueError("foreign version")
        section(f)
        assert section(f)[0]==0
        rows=[]
        while True:
            count,_,h=section(f,True)
            if not count:break
            assert len(h)>0x71
            name=h[0x58:0x58+25].split(b"\0")[0].decode("latin1")
            datatype=struct.unpack_from("<h",h,0x16)[0]
            limits=struct.unpack_from("<iii",h,0x19)
            cellbytes=h[0x3d] or 8
            n,start,_=section(f)
            mask,mask_start,_=section(f)
            rows.append({"name":name,"type":datatype,"cell_bytes":cellbytes,
                "declared_rows":limits,"data_offset":start,"data_bytes":n,
                "mask_bytes":mask,"mask_offset":mask_start})
    return rows

import hashlib
import math
import urllib.request
import numpy as np

BIAX={"0:4":(1,3001),"1:4":(2,2998),"2:4":(3,3002),"3:4":(4,3002),"4:0":(5,3000),
      "4:1":(6,3002),"4:2":(7,3002),"4:3":(8,3002),"4:4":(9,3001)}
HELD=("1:4","2:4","3:4","4:4","4:3","4:2","4:1")
UNI={"0":(2,8221),"45":(3,7755),"90":(4,8160)}
PINS={"biaxial":("tbdsbrnkj9",1262074,"55f314d4eea13adbd8fb2235ec925bebf197ac1e5f677fa7d58e7046f7925a61"),
      "uniaxial":("62nyx7gdd3",1599880,"810e9befa9ce366b8d51005a86f9c53a16361e10116c32d5127bc06092312901")}

def archive(root,kind):
    root=pathlib.Path(root)
    root.mkdir(parents=True,exist_ok=True)
    path=root/(kind+".opj")
    slug,size,sha=PINS[kind]
    if not path.exists():
        fetch=lambda u:urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"WORLDLAW research acquisition"}),timeout=90)
        with fetch("https://data.mendeley.com/public-api/datasets/"+slug+"/files?folder_id=root&version=1") as src:
            row=json.load(src)[0]
        if row["content_details"]["sha256_hash"]!=sha:raise ValueError("Publisher hash")
        with fetch(row["content_details"]["download_url"]) as src:
            b=src.read(size+1)
        if len(b)!=size or hashlib.sha256(b).hexdigest()!=sha:raise ValueError("Archive")
        path.write_bytes(b)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=sha:raise ValueError("Cached archive hash")
    return path

def project(root,kind,books,letters):
    path=archive(root,kind)
    items={e["name"]:e for e in index(path)}
    roster=UNI if kind=="uniaxial" else BIAX
    results={}
    with path.open("rb") as source:
        for label in books:
            book,n=roster[label]
            data=[]
            for col in letters:
                rec=items[f"Book{book}_{col}"]
                if rec["cell_bytes"]!=10 or not rec["type"]&0x100 or rec["mask_bytes"]:
                    raise ValueError("Unexpected Origin typed layout")
                source.seek(rec["data_offset"])
                block=source.read(rec["data_bytes"])
                values=[]
                for j in range(0,len(block),10):
                    if block[j]==1:continue
                    value=struct.unpack_from("<d",block,j+2)[0]
                    if math.isfinite(value) and value!=-1.23456789e-300:
                        if j//10!=len(values):raise ValueError("Noncontiguous released cells")
                        values.append(value)
                if len(values)!=n:raise ValueError(f"Reference length {label}/{col}")
                data.append(values)
            results[label]=np.array(data).T
    return results
