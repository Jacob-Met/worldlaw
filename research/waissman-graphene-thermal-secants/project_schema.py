import hashlib, json, os, struct, urllib.request, zlib
from collections import Counter
from pathlib import Path
REFERENCE=json.loads(Path(__file__).with_name("figure-manifest.json").read_text())
seen=set()
url="https://zenodo.org/api/records/5500449"
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"WORLDLAW source-only MATLAB graphics schema audit"})
    return urllib.request.urlopen(req,timeout=90).read()
records=json.loads(fetch(url))
def tag(buf,i):
    prefix=struct.unpack_from("<I",buf,i)[0]
    small_size=prefix>>16
    if small_size:
        return prefix&65535,buf[i+4:i+4+small_size],i+8
    t,n=struct.unpack_from("<II",buf,i)
    e=i+8+n
    assert e<=len(buf)
    return t,buf[i+8:e],i+8+((n+7)//8)*8
def readmatrix(buf,ctx,fields,chars,arrays):
    if len(buf)==0:
        return  # Legal empty miMATRIX child has no flags or data.
    pos=0
    _,flags,pos=tag(buf,pos);cl=flags[0]
    _,dims,pos=tag(buf,pos);shape=struct.unpack("<"+"i"*(len(dims)//4),dims)
    _,name,pos=tag(buf,pos);name=bytes(name).rstrip(b"\0").decode("utf-8","replace")
    ctx=ctx or name
    if cl in (2,3):
        if cl==3:_,_,pos=tag(buf,pos)
        _,b,pos=tag(buf,pos);width=struct.unpack("<i",b)[0]
        _,b,pos=tag(buf,pos)
        names=[bytes(b[k:k+width]).split(b"\0")[0].decode("utf-8","replace") for k in range(0,len(b),width)]
        fields.update(names)
        j=0
        while pos<len(buf):
            t,chunk,pos=tag(buf,pos)
            if t==14:readmatrix(chunk,names[j%len(names)],fields,chars,arrays)
            j+=1
    elif cl==1:
        while pos<len(buf):
            t,b,pos=tag(buf,pos)
            if t==14:readmatrix(b,ctx,fields,chars,arrays)
    elif cl==4 and pos<len(buf):
        t,b,pos=tag(buf,pos)
        enc={2:"latin1",4:"utf-16le",16:"utf-8",17:"utf-16le",18:"utf-32le"}.get(t)
        if enc and ctx in {"String","DisplayName","Tag","type","Type","Name","Title","Identifier","XLabel","YLabel"}:
            v=bytes(b).decode(enc,"replace").strip()
            if v and len(v)<450:chars.add((ctx,v))
    elif ctx.lower() in {"xdata","ydata","zdata","cdata","udata","vdata","userdata"}:
        arrays[(ctx,tuple(shape),cl)]+=1
for file in sorted(records["files"],key=lambda f:f["key"]):
    name=file["key"];raw=fetch(file["links"]["self"])
    assert hashlib.md5(raw).hexdigest()==file["checksum"].split(":")[1]
    wanted=REFERENCE[name];seen.add(name)
    assert len(raw)==wanted["size"] and hashlib.sha256(raw).hexdigest()==wanted["sha256"]
    assert raw[126:128]==b"IM"
    i=128;fields=Counter();chars=set();arrays=Counter();top=[]
    while i+8<=len(raw):
        t,n=struct.unpack_from("<II",raw,i);payload=memoryview(raw)[i+8:i+8+n]
        if t==15:
            decoded=zlib.decompress(payload);m,chunk,_=tag(memoryview(decoded),0)
            if m==14:readmatrix(chunk,"",fields,chars,arrays)
            i+=8+n
        elif t==14:
            readmatrix(payload,"",fields,chars,arrays)
            i+=8+((n+7)//8)*8
        else:raise ValueError((i,t,n,name))
        top.append(t)
    parsed={"labels":[list(k) for k in sorted(chars)],"scientific_array_shapes":[[k[0],list(k[1]),k[2],v] for k,v in arrays.items()],"top_level":top}
    assert parsed==wanted["graphics"],name
    print("FIGURE",name,len(raw),hashlib.sha256(raw).hexdigest(),json.dumps({"labels":sorted(chars),"scientific_array_shapes":[[k[0],k[1],k[2],v] for k,v in arrays.items()],"top_level":top},ensure_ascii=True),flush=True)
assert seen==set(REFERENCE) and len(seen)==16
print("Only numeric format/dimensions/class flags and character metadata decoded. No numeric XData/YData/CData payload interpreted.")
