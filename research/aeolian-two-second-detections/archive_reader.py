"""Read exact byte ranges from pinned public ZIP members with validated offsets."""
import hashlib
import io
import json
import pathlib
import tempfile
import urllib.parse
import urllib.request
import zipfile

HEAD={'User-Agent':'Field-data scientific source qualification'}


def get(url,headers=None):
    return urllib.request.urlopen(urllib.request.Request(url,headers={**HEAD,**(headers or {})}),timeout=75)


class RangeFile:
    def __init__(self,url,size):
        self.url,self.size,self.position=url,size,0
        self.requests=[]
    def seek(self,offset,whence=0):
        self.position=(self.position if whence==1 else self.size if whence==2 else 0)+offset
        return self.position
    def tell(self):return self.position
    def seekable(self):return True
    def read(self,n=-1):
        n=self.size-self.position if n<0 else min(n,self.size-self.position)
        if n<=0:return b''
        assert n<24_000_000, 'unexpectedly large single archive read'
        a,b=self.position,self.position+n-1
        with get(self.url,{'Range':f'bytes={a}-{b}','Accept-Encoding':'identity'}) as r:
            if r.status!=206 or r.headers.get('Content-Range','').split('/')[0] != f'bytes {a}-{b}':
                raise IOError(f'expected exact range {a}-{b}, got {r.status} {r.headers.get("Content-Range")}')
            data=r.read(n+1)
        assert len(data)==n
        self.position+=n;self.requests.append([a,b,hashlib.sha256(data).hexdigest()])
        return data


