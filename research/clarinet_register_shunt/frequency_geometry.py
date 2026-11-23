"""Read physical dimensions and acquisition frequency axes only, without decoding impedance."""
import io,json,struct,sys,zipfile,zlib,hashlib
def target(raw,allowed):
    o="<" if raw[126:128]==b"IM" else ">";pos=128;out={}
    while pos+8<=len(raw):
        t,n=struct.unpack_from(o+"II",raw,pos);b=pos+8
        assert t in (14,15)
        comp=raw[b:b+n]
        h=zlib.decompressobj().decompress(comp,160)[8:] if t==15 else comp[:160]
        def e(data,j):
            k,m=struct.unpack_from(o+"II",data,j)
            if k>>16:return k&65535,k>>16,j+4,j+8
            return k,m,j+8,j+8+(m+7)//8*8
        a,k,start,j=e(h,0);flags=struct.unpack_from(o+"I",h,start)[0]
        if flags&255==6 and not flags&2048:
            a,k,start,j=e(h,j);assert a==5
            a,k,start,j=e(h,j);name=h[start:start+k].decode()
            if name in allowed:
                content=zlib.decompress(comp)[8:] if t==15 else comp
                a,k,start,j=e(content,j);assert a==9 and k%8==0
                out[name]=struct.unpack_from(o+"d"*(k//8),content,start)
        pos=b+n if t==15 else b+(n+7)//8*8
    return out
with zipfile.ZipFile(sys.argv[1]) as z:
    for m in sorted(z.namelist()):
        if m.endswith("/Geometric_Data/data_prototypes.mat"):
            v=target(z.read(m),{"L1","L2","Lh","R","Rh"});assert len(v)==5;print(json.dumps(dict(geometry=v)))
        if "/Impedance_Measurements/diam " in m and m.endswith(".mat"):
            x=target(z.read(m),{"fmes"})["fmes"];d=[y-a for a,y in zip(x,x[1:])]
            packed=struct.pack("<"+"d"*len(x),*x)
            print(json.dumps(dict(path=m,fmin=x[0],fmax=x[-1],count=len(x),min_gap=min(d),max_gap=max(d),frequency_sha256=hashlib.sha256(packed).hexdigest())))
