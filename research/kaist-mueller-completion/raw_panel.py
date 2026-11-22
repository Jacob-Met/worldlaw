"""Verify a whole official compressed raw member while retaining only frozen Mueller cells."""
from bisect import bisect_left
import hashlib
import io
import json
from pathlib import Path
import struct
import urllib.request
import zlib

import numpy as np
from design import ABC_INDEX, GEOM


def fetch_range(url,a,b):
    h={"User-Agent":"KAIST-pBRDF-scientific-reproduction/1","Accept-Encoding":"identity",
       "Range":f"bytes={a}-{b}"}
    with urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=180) as resp:
        if resp.status!=206 or not resp.headers["Content-Range"].startswith(f"bytes {a}-{b}/"):
            raise ValueError("source did not supply the requested byte range")
        d=resp.read(b-a+2)
        if len(d)!=b-a+1:
            raise ValueError("incomplete source byte range")
        return d


def field_headers(blob):
    f=io.BytesIO(blob)
    if f.read(14)!=b"tensor_file\x00\x01\x00":raise ValueError("bad tensor header")
    count=struct.unpack("<I",f.read(4))[0]
    if count!=5:raise ValueError("unexpected field count")
    fields={}
    for _ in range(count):
        size=struct.unpack("<H",f.read(2))[0];name=f.read(size).decode()
        dim,dt,off=struct.unpack("<HBQ",f.read(11))
        shape=struct.unpack("<"+"Q"*dim,f.read(8*dim))
        fields[name]=(dt,off,shape)
    return fields


def extract(archive,folder):
    url=archive["url"]
    members=[m for m in archive["members"] if m["name"].endswith("_raw.pbsdf")]
    if len(members)!=1:raise ValueError("missing unique raw file")
    member=members[0];off=member["local_header_offset"]
    header=fetch_range(url,off,off+29)
    descr=struct.unpack("<4s5H3L2H",header)
    if descr[0]!=b"PK\x03\x04" or descr[3]!=8:raise ValueError("unexpected ZIP local header")
    size,xlen=descr[-2:]
    if fetch_range(url,off+30,off+30+size-1).decode()!=member["name"]:
        raise ValueError("source member identity mismatch")
    off+=30+size+xlen
    n=0;crc=0;sha=hashlib.sha256();compressed=hashlib.sha256();decomp=zlib.decompressobj(-15)
    # Exact source layout from the author's header. One selected angular bin contains
    # five 4x4 float32 matrices. Never load the roughly 956 MB matrix into memory.
    starts=[216+((p*91+d)*91+h)*320 for p,d,h in ABC_INDEX]
    buffers=[bytearray() for _ in starts];head=bytearray();tail=bytearray()
    limit=member["compressed_bytes"];step=8*1024**2
    for pos in range(0,limit,step):
        length=min(step,limit-pos)
        raw=fetch_range(url,off+pos,off+pos+length-1)
        compressed.update(raw)
        while raw:
            d=decomp.decompress(raw,2*1024**2);raw=decomp.unconsumed_tail
            end=n+len(d);crc=zlib.crc32(d,crc);sha.update(d)
            if n<216:head.extend(d[:max(0,min(end,216)-n)])
            if end>956621336:tail.extend(d[max(0,956621336-n):])
            j=bisect_left(starts,n-319)
            while j<len(starts) and starts[j]<end:
                s=starts[j]
                buffers[j].extend(d[max(0,s-n):min(end,s+320)-n]);j+=1
            n=end
    if not decomp.eof or decomp.unused_data or n!=member["bytes"] or hex(crc)!=member["crc32"]:
        raise ValueError(("source CRC/length/eof",n,hex(crc)))
    hdr=field_headers(head)
    assert hdr["M"]==(10,216,(361,91,91,5,4,4)) and hdr["phi_d"][1]==956621336
    assert hdr["wvls"][1]==956623520 and len(tail)==n-956621336
    for axis,l,dtype in [("phi_d",361,"<f4"),("theta_d",91,"<f4"),("theta_h",91,"<f4"),("wvls",5,"<u2")]:
        grid=np.frombuffer(tail,dtype,count=l,offset=hdr[axis][1]-956621336)
        if axis=="phi_d":want=np.linspace(-np.pi,np.pi,361)
        elif axis=="theta_d":want=np.linspace(0,np.pi/2,91)
        elif axis=="theta_h":want=(np.arange(91)/90)**2*np.pi/2
        else:want=np.array([450,500,550,600,650])
        if not np.allclose(grid,want,rtol=0,atol=2e-7):raise ValueError("source axis mismatch "+axis)
    if any(len(b)!=320 for b in buffers):raise ValueError("geometry projection incomplete")
    m=np.frombuffer(b"".join(buffers),"<f4").reshape(-1,4,4)
    if len(m)!=len(GEOM):raise ValueError("bad sample count")
    folder.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(folder/"linear.npz",a=m[:,:3,:3],geometry=GEOM)
    np.savez_compressed(folder/"circular.npz",vv=m[:,3,3])
    return {"compressed_sha256":compressed.hexdigest(),"raw_sha256":sha.hexdigest(),"crc32":hex(crc),
            "bytes":n,"compressed_bytes":limit,"coordinate_count":len(m),"raw_member":member["name"],
            "linear_sha256":hashlib.sha256((folder/"linear.npz").read_bytes()).hexdigest(),
            "circular_sha256":hashlib.sha256((folder/"circular.npz").read_bytes()).hexdigest(),
            "directory_sha256":archive["directory_sha256"]}
