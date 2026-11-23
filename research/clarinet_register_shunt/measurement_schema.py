"""Read figure/model source and v5 MATLAB variable headers only. No array payload interpreted."""
import hashlib,io,json,pathlib,re,struct,sys,zipfile,zlib
def matrix_header(data,order):
    def elem(pos):
        tag,n=struct.unpack_from(order+"II",data,pos)
        if tag>>16:
            return tag&65535,(tag>>16),pos+4,pos+8
        return tag,n,pos+8,pos+8+(n+7)//8*8
    pos=0
    ty,n,p,pos=elem(pos);assert ty==6 and n==8
    flags=struct.unpack_from(order+"I",data,p)[0]
    ty,n,p,pos=elem(pos);assert ty==5
    dims=struct.unpack_from(order+"i"*(n//4),data,p)
    ty,n,p,pos=elem(pos);assert ty in (1,2)
    name=data[p:p+n].decode("ascii")
    return dict(name=name,shape=dims,mxclass=flags&255,complex=bool(flags&2048))
def schema(raw):
    if raw[126:128] not in (b"IM",b"MI"):return dict(unsupported="non-v5 header")
    order="<" if raw[126:128]==b"IM" else ">"
    pos=128;out=[]
    while pos+8<=len(raw):
        ty,n=struct.unpack_from(order+"II",raw,pos);begin=pos+8
        if ty==15:
            h=zlib.decompressobj().decompress(raw[begin:begin+n],320)
            mat,sz=struct.unpack_from(order+"II",h);assert mat==14
            out.append(matrix_header(h[8:],order));pos=begin+n
        elif ty==14:
            out.append(matrix_header(raw[begin:begin+320],order));pos=begin+(n+7)//8*8
        else:raise ValueError(("unsupported element",ty,n,pos))
    return out
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in sorted(z.namelist()):
        if re.search(r"/data/(Impedance_Measurements/diam [123]/Z[1-7]|Geometric_Data/data_prototypes)\.mat$",n):
            raw=z.read(n)
            print(json.dumps(dict(file=n,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),schema=schema(raw))))
        elif n.endswith(("/post-processing/Impedance_Measurements/impedances_article.m","/Methods/compute_Mtot.m","/Methods/impedance_tube_CstL1.m","/README.txt")):
            raw=z.read(n);print(json.dumps(dict(source=n,sha256=hashlib.sha256(raw).hexdigest(),matlab=raw.decode("utf8",errors="replace"))))
