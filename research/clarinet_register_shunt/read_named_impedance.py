"""Access only requested named numeric variables in SHA-identified MATLAB v5 members."""
import hashlib,io,json,pathlib,struct,zipfile,zlib
import numpy as np

def variables(raw,names):
    order="<" if raw[126:128]==b"IM" else ">"
    pos=128;out={}
    def tag(data,j):
        kind,n=struct.unpack_from(order+"II",data,j)
        if kind>>16:return kind&65535,kind>>16,j+4,j+8
        return kind,n,j+8,j+8+(n+7)//8*8
    while pos+8<=len(raw):
        kind,n=struct.unpack_from(order+"II",raw,pos);start=pos+8
        assert kind in (14,15)
        comp=raw[start:start+n]
        header=zlib.decompressobj().decompress(comp,160)[8:] if kind==15 else comp[:160]
        typ,k,s,j=tag(header,0);assert (typ,k)==(6,8)
        flags=struct.unpack_from(order+"I",header,s)[0]
        if flags&255==6:
            typ,k,s,j=tag(header,j);assert typ==5
            dims=struct.unpack_from(order+"i"*(k//4),header,s)
            typ,k,s,j=tag(header,j);name=header[s:s+k].decode("ascii")
            if name in names:
                assert dims==(19501,1) and bool(flags&2048)==(name!="fmes")
                plain=zlib.decompress(comp)[8:] if kind==15 else comp
                typ,k,s,j=tag(plain,j);assert (typ,k)==(9,19501*8)
                v=np.frombuffer(plain,dtype=order+"f8",count=19501,offset=s).copy()
                if flags&2048:
                    typ,k,s,j=tag(plain,j);assert (typ,k)==(9,19501*8)
                    v=v+1j*np.frombuffer(plain,dtype=order+"f8",count=19501,offset=s)
                if not np.isfinite(v).all():raise ValueError(("nonfinite input",name))
                out[name]=v
        pos=start+n if kind==15 else start+(n+7)//8*8
    assert set(out)==set(names)
    return out

def read_records(file,reg,mode):
    closed={};opened={};frequency=None
    with zipfile.ZipFile(file) as z:
        for row in reg["acquisitions"]:
            path=row["path"];tokens=path.split("/")
            u=int(tokens[-2][-1]);l=int(tokens[-1][1])
            if mode=="score" and l not in reg["held_lower"]:continue
            names=["fmes","Z_closed"] if mode=="forecast" else ["fmes","Z_open"]
            if mode=="forecast" and l in reg["calibration_lower"]:names.append("Z_open")
            raw=z.read(path)
            if hashlib.sha256(raw).hexdigest()!=row["sha256"]:raise ValueError(("mat identity",path))
            cols=variables(raw,names);f=cols["fmes"]
            assert hashlib.sha256(f.astype("<f8").tobytes()).hexdigest()==reg["frequency"]["sha256"]
            if frequency is None:frequency=f
            for name,dst in [("Z_closed",closed),("Z_open",opened)]:
                if name in cols:
                    v=cols[name]
                    assert np.all(abs(v+1)>1e-10*(1+abs(v)))
                    dst[u,l]=(v-1)/(v+1)
    return frequency,closed,opened
