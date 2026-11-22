import io,struct,urllib.request
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



class Inner(io.RawIOBase):
 def __init__(self,remote,begin,length):self.remote,self.begin,self.size,self.pos,self.blocks=remote,begin,length,0,{}
 def seekable(self):return True
 def readable(self):return True
 def tell(self):return self.pos
 def seek(self,off,whence=0):
  self.pos=off if whence==0 else self.pos+off if whence==1 else self.size+off
  assert 0<=self.pos<=self.size;return self.pos
 def read(self,n=-1):
  n=self.size-self.pos if n<0 else min(n,self.size-self.pos);out=[]
  while n:
   idx=self.pos//16384
   if idx not in self.blocks:
    off=idx*16384;self.remote.seek(self.begin+off);self.blocks[idx]=self.remote.read(min(self.size-off,16384))
   chunk=self.blocks[idx];v=self.pos%16384;take=min(n,len(chunk)-v);assert take>0;out.append(chunk[v:v+take]);self.pos+=take;n-=take
  return b"".join(out)
 def readinto(self,target):
  b=self.read(len(target));target[:len(b)]=b;return len(b)
def subfile(rr,e):
 rr.seek(e["offset"]);header=rr.read(30);assert header[:4]==b"PK"+bytes([3,4]);a,b=struct.unpack_from("<HH",header,26);return Inner(rr,e["offset"]+30+a+b,e["size"])
