"""Read nonresponse members of the KU Leuven plate NPZ originals via verified HTTP ranges."""
import ast
import concurrent.futures
import hashlib
import io
import json
import re
import struct
import urllib.parse
import urllib.request
import zipfile

RECORD = 'https://zenodo.org/api/records/11033677'
NAMES = ['baseline','1 mass','3 masses','4 masses','5 masses','6 masses','1 elongated mass']


class HTTPArchive(io.RawIOBase):
    def __init__(self, url, size):
        self.url=url
        self.size=size
        self.pos=0
        self.received=0
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.pos
    def seek(self, n, whence=0):
        self.pos=(0,self.pos,self.size)[whence]+n
        if self.pos<0:raise OSError('negative byte position')
        return self.pos
    def read(self, n=-1):
        if n<0:n=self.size-self.pos
        n=min(n,self.size-self.pos)
        if n<=0:return b''
        if n>256000:raise ValueError('metadata-only read exceeds 256000 bytes')
        first=self.pos;end=first+n-1
        req=urllib.request.Request(self.url,headers={'Range':f'bytes={first}-{end}',
                                                    'Accept-Encoding':'identity'})
        with urllib.request.urlopen(req,timeout=35) as response:
            assert response.status==206
            assert response.headers['Content-Range']==f'bytes {first}-{end}/{self.size}'
            data=response.read(n+1)
        assert len(data)==n
        self.pos+=n;self.received+=n
        return data


def unpack(bytestr):
    f=io.BytesIO(bytestr)
    assert f.read(6)==b'\x93NUMPY' and f.read(2)==b'\x01\x00'
    n=struct.unpack('<H',f.read(2))[0]
    meta=ast.literal_eval(f.read(n).decode())
    numeric={'<u2':'H','<u4':'I','<i4':'i','<i8':'q','<f8':'d','<f4':'f'}
    data=[x[0] for x in struct.iter_unpack('<'+numeric[meta['descr']],f.read())]
    return meta,data


def assess(task):
    name,meta=task
    raw=HTTPArchive(meta['links']['self'],meta['size'])
    with zipfile.ZipFile(raw) as archive:
        names=archive.namelist()
        desired=['frequency','node_position','probing_nodes'] if name=='baseline' else ['mass_nodes']
        out={}
        for member in desired:
            data=archive.read(member+'.npy')
            desc,values=unpack(data)
            info={'shape':desc['shape'],'dtype':desc['descr'],'member_sha256':hashlib.sha256(data).hexdigest()}
            if member=='frequency':
                info.update(min_hz=min(values),max_hz=max(values),count=len(values),
                            strictly_increasing=all(y>x for x,y in zip(values,values[1:])))
            elif member=='node_position':
                info.update(count=len(values))
            else:info['indices_zero_based']=values
            out[member]=info
    return name,{'source_size':meta['size'],'catalogue_checksum':meta['checksum'],
                 'archive_member_names':names,'projected_metadata':out,'range_bytes':raw.received}


def main():
    cat=json.load(urllib.request.urlopen(RECORD,timeout=30))
    members={v['key']:v for v in cat['files']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        out=dict(pool.map(assess,[(n,members[n+'.npz']) for n in NAMES]))
    print(json.dumps({'record':cat['id'],'frf_response_members_opened':0,'originals':out},
                     sort_keys=True))


if __name__=='__main__':main()
