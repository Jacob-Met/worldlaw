"""Read seekable byte ranges from an immutable scientific archive."""
import io
import urllib.request


class RangeFile(io.RawIOBase):
    def __init__(self,url,size):
        self.url,self.size,self.pos=url,size,0
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.pos
    def seek(self,pos,whence=0):
        value=pos if whence==0 else self.pos+pos if whence==1 else self.size+pos
        if value<0:raise ValueError("negative range")
        self.pos=value;return value
    def read(self,n=-1):
        length=self.size-self.pos if n<0 else min(n,self.size-self.pos)
        if length<=0:return b""
        assert length<=16*1024*1024,("unexpected large metadata range",length)
        start=self.pos;end=start+length-1
        req=urllib.request.Request(self.url,headers={"Range":f"bytes={start}-{end}","Accept-Encoding":"identity","User-Agent":"public-research-metadata/1.0"})
        with urllib.request.urlopen(req,timeout=70) as rr:
            assert rr.status==206 and rr.headers.get("Content-Range","").startswith(f"bytes {start}-{end}/"),(rr.status,rr.headers.get("Content-Range"))
            byte=rr.read(length+1)
        assert len(byte)==length;self.pos+=len(byte);return byte


