"""Range-read official archive member names and checksums without extracting observations."""
import io
import re
import urllib.request

class RangeReader(io.RawIOBase):
    def __init__(self,url):
        self.url=url;self.pos=0;self.total_read=0;self.request_count=0
        req=urllib.request.Request(url,headers={"Range":"bytes=0-15","Accept-Encoding":"identity"})
        with urllib.request.urlopen(req,timeout=90) as f:
            m=re.fullmatch(r"bytes 0-15/(\d+)",f.headers.get("Content-Range",""))
            if f.status!=206 or m is None:raise IOError(f"Server refused bounded range ({f.status}, {f.headers.get('Content-Length')})")
            self.size=int(m[1]);self.final=f.geturl();self.etag=f.headers.get("ETag")
            self.name=f.headers.get("Content-Disposition");self.magic=f.read(16).hex();self.mime=f.headers.get("Content-Type")
        self.request_count+=1;self.total_read+=16
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.pos
    def seek(self,pos,whence=0):
        nxt=[pos,self.pos+pos,self.size+pos][whence]
        if nxt<0:raise ValueError("negative source offset")
        self.pos=nxt;return nxt
    def read(self,n=-1):
        n=min(self.size-self.pos,n) if n>=0 else self.size-self.pos
        if n<=0:return b""
        if n>32_000_000:raise ValueError(f"Unbounded directory/member read {n}")
        lo=self.pos;hi=lo+n-1;headers={"Range":f"bytes={lo}-{hi}","Accept-Encoding":"identity"}
        if self.etag:headers["If-Match"]=self.etag
        with urllib.request.urlopen(urllib.request.Request(self.final,headers=headers),timeout=90) as f:
            if f.status!=206 or f.headers.get("Content-Range")!=f"bytes {lo}-{hi}/{self.size}" or f.headers.get("ETag")!=self.etag:
                raise IOError("Range, object size or ETag changed")
            data=f.read(n+1)
        if len(data)!=n:raise IOError("Wrong source length")
        self.pos+=n;self.request_count+=1;self.total_read+=n;return data


