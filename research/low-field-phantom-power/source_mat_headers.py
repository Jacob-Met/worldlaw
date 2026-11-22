"""Read only MAT v5 variable names, dimensions, and structure-field descriptions."""
import io
import json
import struct
import zlib

CLASSES = ('unknown','cell','struct','object','char','sparse','double','single','int8','uint8','int16','uint16','int32','uint32','int64','uint64','function','opaque')


def tag(buf, pos):
    first, second = struct.unpack_from('<II',buf,pos)
    size = first >> 16
    if size:
        if size>4: raise ValueError('invalid small MAT field')
        return first & 65535, size, pos+4, pos+8
    return first, second, pos+8, pos+8+((second+7)//8)*8


def header(buf, start):
    kind,num,pos,end = tag(buf,start)
    if kind!=14: raise ValueError('expected an miMATRIX')
    _,_,p,n=tag(buf,pos)
    which=struct.unpack_from('<I',buf,p)[0] & 255
    _,m,p,n=tag(buf,n)
    dims=list(struct.unpack_from('<'+'i'*(m//4),buf,p))
    _,m,p,n=tag(buf,n)
    name=bytes(buf[p:p+m]).decode()
    h={'name':name,'class':CLASSES[which] if which<len(CLASSES) else str(which),'dims':dims}
    if which==2 and all(i==1 for i in dims):
        _,m,p,n=tag(buf,n); width=struct.unpack_from('<i',buf,p)[0]
        _,m,p,n=tag(buf,n)
        names=[bytes(buf[i:i+width]).split(b'\x00')[0].decode() for i in range(p,p+m,width)]
        h['fields']={}
        for k in names:
            t,s,d,e=tag(buf,n)
            if t!=14 or s==0:
                h['fields'][k]={'class':'empty_or_other'}; n=e; continue
            desc,n=header(buf,n)
            desc.pop('name',None)
            h['fields'][k]=desc
    return h,end


def inspect(data):
    if data[126:128]!=b'IM':raise ValueError('not MAT v5 little endian')
    ret=[];pos=128
    while pos<len(data):
        t,size,start,end=tag(data,pos)
        if t==15:
            raw=zlib.decompress(memoryview(data)[start:start+size])
            h,_=header(raw,0);pos=start+size
        elif t==14:
            h,pos=header(data,pos)
        else:
            raise ValueError(f'unexpected top-level type {t} at {pos}')
        ret.append(h)
    return ret
