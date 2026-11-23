"""Read the authors' impedance mapping scripts and metadata-only MATLAB element tags."""
import hashlib,json,struct,sys,zipfile,zlib
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in sorted(z.namelist()):
        if n.endswith(("/impedances_article.m","/coeffs_lowpass_Gamma.m","/Minimal_Example_RegisterHoleOpening.m")):
            b=z.read(n);print(json.dumps(dict(source=n,sha256=hashlib.sha256(b).hexdigest(),code=b.decode("utf8",errors="replace"))))
        elif "/data/Impedance_Measurements/diam " in n and n.endswith(".mat"):
            b=z.read(n);o="<" if b[126:128]==b"IM" else ">";i=128;rows=[]
            while i+8<=len(b):
                typ,size=struct.unpack_from(o+"II",b,i)
                assert typ in (14,15)
                h=zlib.decompressobj().decompress(b[i+8:i+8+size],512)[8:] if typ==15 else b[i+8:i+8+min(size,512)]
                j=0;tags=[];cls=None
                while j+8<=len(h) and len(tags)<7:
                    t,k=struct.unpack_from(o+"II",h,j);small=bool(t>>16)
                    if small:k=t>>16;t=t&65535
                    start=j+4 if small else j+8
                    tag=dict(mi=t,length=k)
                    if len(tags)==0 and t==6 and k==8:
                        flags=struct.unpack_from(o+"I",h,start)[0];cls=flags&255;tag.update(mx=cls,complex=bool(flags&2048))
                    if cls not in (16,17) and len(tags)==1 and t==5 and 0<k<=32:
                        tag["dims"]=struct.unpack_from(o+"i"*(k//4),h,start)
                    if t in (1,2,16) and k<=80 and start+k<=len(h):
                        x=h[start:start+k]
                        if all(31<v<127 or v==0 for v in x):tag["label"]=x.rstrip(b"\0").decode("ascii")
                    tags.append(tag)
                    j=j+8 if small else start+(k+7)//8*8
                rows.append(tags);i+=8+size if typ==15 else 8+(size+7)//8*8
            print(json.dumps(dict(file=n,sha256=hashlib.sha256(b).hexdigest(),outer_element_headers=rows)))
