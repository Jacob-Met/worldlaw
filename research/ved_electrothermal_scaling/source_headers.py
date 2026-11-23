"""Inspect only source MAT descriptors and complete ZIP attachment types, never signal samples."""
import collections
import hashlib
import io
import json
import struct
import zipfile
import zlib
from pathlib import Path
from source_lattice import Remote

class Prefix:
    def __init__(self, raw):
        self.decoder=zlib.decompressobj()
        self.pending=raw
    def read(self,n):
        b=self.decoder.decompress(self.pending,n)
        self.pending=self.decoder.unconsumed_tail
        if len(b)!=n:raise ValueError("short compressed descriptor")
        return b

def tag(reader):
    head=reader.read(8)
    a,b=struct.unpack("<II",head)
    if a>>16:
        count=a>>16
        if count>4:raise ValueError("invalid inline size")
        return a&65535,count,head[4:4+count]
    return a,b,None

def metadata_element(reader):
    kind,n,small=tag(reader)
    if n>256:raise ValueError("oversized metadata")
    if small is not None:return kind,small
    b=reader.read((n+7)//8*8)
    return kind,b[:n]

def descriptors(blob):
    assert blob[:6]==b"MATLAB" and blob[126:128]==b"IM"
    vars=[]
    pos=128
    while pos<len(blob):
        typ,size=struct.unpack_from("<II",blob,pos)
        payload=memoryview(blob)[pos+8:pos+8+size]
        if typ!=15:raise ValueError(("unexpected top-level MATLAB element",typ))
        src=Prefix(payload)
        mt,sz,small=tag(src)
        assert mt==14 and small is None
        _,flags=metadata_element(src)
        _,dims=metadata_element(src)
        _,key=metadata_element(src)
        # Stop before even requesting the data element tag, including small-value tags.
        vars.append((key.decode(),struct.unpack("<"+"i"*(len(dims)//4),dims),struct.unpack("<II",flags)))
        pos+=8+size
    assert pos==len(blob)
    return vars

def main():
    lattice=json.loads(Path("matched_commands.json").read_text())
    reader=Remote(lattice["archive"])
    with zipfile.ZipFile(reader) as archive:
        ext=collections.Counter(Path(i.filename).suffix.lower() for i in archive.infolist() if not i.is_dir())
        companions=[i.filename for i in archive.infolist() if not i.is_dir() and Path(i.filename).suffix.lower()!=".mat"]
        print("INVENTORY",json.dumps([ext,companions]),flush=True)
        for index in [0,10,20]:
            row=lattice["triads"][index][0]
            assert row["bias"]==100
            info=archive.getinfo(row["name"])
            assert [info.CRC,info.file_size,info.compress_size,info.header_offset]==[row[k] for k in ("crc","bytes","compressed","offset")]
            blob=archive.read(info)
            print("SOURCE_HEADERS",json.dumps([row["name"],hashlib.sha256(blob).hexdigest(),descriptors(blob)]),flush=True)
    print("Target files opened 0. MATLAB signal samples decoded 0.")
if __name__=="__main__":main()
