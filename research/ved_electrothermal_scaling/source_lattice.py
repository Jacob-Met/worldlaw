"""Inspect author solver and range-addressed archive directories without decoding MAT/FIG recordings."""
import hashlib,io,json,re,struct,urllib.request,zipfile
from urllib.parse import quote
BASE="https://zenodo.org/records/18336535/files/"
code="code_availibity.zip"
archives=["Frequency_tunable_Regime_1_DC_vs_C_crit.zip","Frequency_tunable_Regime_2_DC_vs_C_crit.zip","Frequency_untunable_Regime_DC_vs_C_crit.zip"]
def req(name,h=None):
    url=BASE+quote(name,safe="/")+"?download=1"
    return urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Public MEMS model and archive-directory reader",**(h or {})}),timeout=45)
class Remote(io.RawIOBase):
    def __init__(self,name):
        self.name=name;self.pos=0;self.ranges=[]
        with req(name,{"Range":"bytes=0-0"}) as f:
            m=re.fullmatch(r"bytes 0-0/([0-9]+)",f.headers.get("Content-Range",""))
            if f.status!=206 or not m:raise ValueError(("server range refused",name,f.status))
            self.size=int(m[1]);assert len(f.read(2))==1
    def seekable(self):return True
    def tell(self):return self.pos
    def seek(self,offset,whence=0):
        self.pos=[0,self.pos,self.size][whence]+offset
        if self.pos<0:raise OSError("negative")
        return self.pos
    def read(self,n=-1):
        n=min(self.size-self.pos,n if n>=0 else self.size-self.pos)
        if n<=0:return b""
        if n>4*1024*1024:raise ValueError(("directory window too large",n))
        a=self.pos;b=self.pos+n-1
        with req(self.name,{"Range":f"bytes={a}-{b}"}) as f:
            if f.status!=206 or f.headers.get("Content-Range")!=f"bytes {a}-{b}/{self.size}":raise ValueError("range identity")
            buf=f.read(n+1);assert len(buf)==n
        self.pos+=n;self.ranges.append([a,n,hashlib.sha256(buf).hexdigest()]);return buf
def main():
    name=archives[0]
    remote=Remote(name)
    with zipfile.ZipFile(remote) as archive:
        entries=[[i.filename,i.file_size,i.compress_size,i.CRC,i.header_offset] for i in archive.infolist() if "__MACOSX" not in i.filename and i.filename.endswith((".mat",".m"))]
        print("DIRECTORY",json.dumps({"archive":name,"bytes":remote.size,"ranges":list(remote.ranges),"entries":entries},separators=(",",":")),flush=True)
        for item in entries:
            if item[0].endswith(".m"):
                if item[1]>65536:raise ValueError("oversize analysis script")
                code=archive.read(item[0])
                print("AUTHOR_ANALYSIS",json.dumps([item[0],hashlib.sha256(code).hexdigest(),code.decode(errors="replace")]),flush=True)
    print("Physical MAT/FIG members opened: 0")

if __name__=="__main__":
    from vector_field import check
    print("EXACT",json.dumps(check()),flush=True)
    main()
