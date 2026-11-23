import hashlib, math, struct, urllib.request, zlib
from collections import Counter
def tag(buf,p):
    code=struct.unpack_from("<I",buf,p)[0]
    n=code>>16
    if n:return code&65535,buf[p+4:p+4+n],p+8
    t,n=struct.unpack_from("<II",buf,p)
    assert p+8+n<=len(buf)
    return t,buf[p+8:p+8+n],p+8+((n+7)//8)*8
def read(buf):
    if not len(buf):return None
    _,flag,p=tag(buf,0);cl=flag[0]
    _,dat,p=tag(buf,p);shape=struct.unpack("<"+"i"*(len(dat)//4),dat)
    _,name,p=tag(buf,p)
    if cl in (2,3):
        if cl==3:_,_,p=tag(buf,p)
        _,b,p=tag(buf,p);w=struct.unpack("<i",b)[0]
        _,b,p=tag(buf,p)
        names=[bytes(b[j:j+w]).split(b"\0",1)[0].decode("utf-8","replace") for j in range(0,len(b),w)]
        n=math.prod(shape);rows=[{} for _ in range(n)]
        for row in rows:
            for k in names:
                t,b,p=tag(buf,p);row[k]=read(b) if t==14 else None
        return rows
    if cl==1:
        out=[]
        while p<len(buf):
            t,b,p=tag(buf,p);out.append(read(b) if t==14 else None)
        return out
    if cl==4:
        if p==len(buf):return ""
        t,b,p=tag(buf,p);e={2:"latin1",4:"utf-16le",16:"utf8",17:"utf-16le",18:"utf-32le"}.get(t)
        return bytes(b).decode(e,"replace") if e else ""
    if p==len(buf):return None
    t,b,p=tag(buf,p)
    return (t,shape,b)  # opaque scientific numeric payload
def numbers(a):
    t,_,b=a;fm={2:"B",3:"h",4:"H",5:"i",6:"I",7:"f",9:"d",12:"q",13:"Q"}[t]
    return [x[0] for x in struct.iter_unpack("<"+fm,b)]
def fig(name,digest):
    u="https://zenodo.org/api/records/5500449/files/"+name+"/content"
    b=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"WORLDLAW typed figure receiver"}),timeout=90).read()
    assert hashlib.sha256(b).hexdigest()==digest
    i=128
    while i+8<=len(b):
        t,n=struct.unpack_from("<II",b,i);p=b[i+8:i+8+n]
        if t==15:
            m,c,_=tag(memoryview(zlib.decompress(p)),0);i+=8+n
        elif t==14:
            m,c=14,memoryview(p);i+=8+((n+7)//8)*8
        else:raise ValueError(t)
        if m==14:
            f=read(c)
            if isinstance(f,list):
                for e in f:
                    if isinstance(e,dict) and e.get("type")=="figure":return e
    raise ValueError("Missing figure")
def axes(f):
    return [v for v in f["children"] if v["type"]=="axes"]
def prop(c):
    return (c.get("properties") or [{}])[0]
def readaxes(f):
    for a in axes(f):
        children=a.get("children") or []
        labels=[prop(c).get("String") for c in children if c.get("type")=="text"]
        curves=[]
        for c in children:
            if c["type"]=="graph2d.lineseries":
                p=prop(c);color=numbers(p["Color"]);x=numbers(p["XData"])
                curves.append((color,x,p["YData"]))
        if curves:yield labels,curves
names={"Fig2_a.fig":"e26d7284779f1fa33ca9cea3c894a21c859c1f1af3456134262ce5acd6f02e0c","Fig2_b_top_middle.fig":"8d2333780b9de0fcca62e69eeb7a674531fdcde6b6e46a7e0e94fdc8394ecca3"}
