"""Decode one content-bound source/target member and compute full-capture statistics."""
import hashlib
import io
import json
import math
import struct
import sys
import zlib
from pathlib import Path
from source_lattice import req
from source_headers import metadata_element, tag

def get_range(archive, total, start, count):
    end=start+count-1
    with req(archive,{"Range":f"bytes={start}-{end}"}) as r:
        if r.status!=206 or r.headers.get("Content-Range")!=f"bytes {start}-{end}/{total}":
            raise ValueError("unaligned response")
        data=r.read(count+1)
    if len(data)!=count:raise ValueError("incomplete member")
    return data

def receive(row, index):
    arc=index["archive"];total=index["bytes"];pos=row["offset"]
    head=get_range(arc,total,pos,30)
    fields=struct.unpack("<IHHHHHIIIHH",head)
    sig,method,crc,compressed,raw_size,nname,nextra=fields[0],fields[3],fields[6],fields[7],fields[8],fields[9],fields[10]
    assert sig==0x04034b50 and method==8 
    if fields[2]&8:
        assert (crc,compressed,raw_size) in [(0,0,0),(row["crc"],row["compressed"],row["bytes"])]
        crc,compressed,raw_size=row["crc"],row["compressed"],row["bytes"]
    else:
        assert (crc,compressed,raw_size)==(row["crc"],row["compressed"],row["bytes"])
    block=get_range(arc,total,pos+30,nname+nextra+compressed)
    assert block[:nname].decode()==row["name"]
    blob=zlib.decompress(block[nname+nextra:],-15)
    assert len(blob)==raw_size and zlib.crc32(blob)==crc
    assert blob[:6]==b"MATLAB" and blob[126:128]==b"IM"
    code,n=struct.unpack_from("<II",blob,128)
    assert code==15 and n==len(blob)-136
    src=io.BytesIO(zlib.decompress(blob[136:]))
    mt,sz,small=tag(src)
    assert mt==14 and small is None and sz==len(src.getbuffer())-8
    _,flags=metadata_element(src);_,dimensions=metadata_element(src);_,name=metadata_element(src)
    assert struct.unpack("<II",flags)==(6,0) and struct.unpack("<ii",dimensions)==(125000,2) and name==b"data"
    kind,n,inline=tag(src)
    assert kind==9 and n==2000000 and inline is None and sys.byteorder=="little"
    x=memoryview(src.read(n)).cast("d")
    assert not src.read(1)
    def shape(a,b):
        channels=[]
        for i in range(2):
            v=x[i*125000+a:i*125000+b]
            mean=math.fsum(v)/len(v)
            rms=math.sqrt(math.fsum((t-mean)**2 for t in v)/len(v))
            channels.append([mean,rms,min(v),max(v)])
        if not all(math.isfinite(t) for c in channels for t in c):raise ValueError("nonfinite")
        return {"channel_mean_rms_min_max":channels,"joint":math.hypot(channels[0][1],channels[1][1])}
    return {"bias":row["bias"],"step":row["step"],"sha256":hashlib.sha256(blob).hexdigest(),"full":shape(0,125000),
            "quarters":[shape(i*31250,(i+1)*31250) for i in range(4)]}

def get_index():
    index=json.loads(Path("matched_commands.json").read_text())
    start,count,expected=index["central_directory"]
    assert hashlib.sha256(get_range(index["archive"],index["bytes"],start,count)).hexdigest()==expected
    return index
