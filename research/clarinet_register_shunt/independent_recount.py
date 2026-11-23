"""Independent stdlib recount from the three protected author loads and serialized forecast bytes."""
import array,ast,hashlib,io,json,math,struct,sys,zipfile,zlib
def numeric_fields(raw,want):
    end="<" if raw[126:128]==b"IM" else ">"
    def cursor(buf,pos):
        word,size=struct.unpack_from(end+"II",buf,pos)
        if word>>16:return word&65535,word>>16,pos+4,pos+8
        return word,size,pos+8,pos+8+8*((size+7)//8)
    out={};i=128
    while i+8<=len(raw):
        typ,size=struct.unpack_from(end+"II",raw,i);packed=raw[i+8:i+8+size]
        mat=zlib.decompress(packed)[8:] if typ==15 else packed
        assert typ in (14,15)
        _,_,p,j=cursor(mat,0);flags=int.from_bytes(mat[p:p+4],"little" if end=="<" else "big")
        if flags&255==6:
            _,n,p,j=cursor(mat,j);dims=struct.unpack_from(end+"i"*(n//4),mat,p)
            _,n,p,j=cursor(mat,j);name=mat[p:p+n].decode("ascii")
            if name in want:
                assert dims==(19501,1);typ2,n,p,j=cursor(mat,j);assert typ2==9
                real=struct.unpack_from(end+"19501d",mat,p)
                if flags&2048:
                    typ2,n,p,j=cursor(mat,j);assert typ2==9
                    imag=struct.unpack_from(end+"19501d",mat,p);out[name]=list(map(complex,real,imag))
                else:out[name]=real
        i=i+8+size if typ==15 else i+8+8*((size+7)//8)
    assert set(out)==set(want);return out
def npy(raw,dtype,shape):
    s=io.BytesIO(raw);assert s.read(8)==b"\x93NUMPY\x01\x00";n=int.from_bytes(s.read(2),"little")
    h=ast.literal_eval(s.read(n).decode("ascii").strip())
    assert h["shape"]==shape and h["descr"]==dtype and h["fortran_order"] is False
    a=array.array("f" if dtype=="<c8" else "d");a.frombytes(s.read())
    if sys.byteorder!="little":a.byteswap()
    return a
def main(file,forecast):
    reg=json.load(open("protocol.json"));obs=json.load(open("raw-score.json"))
    raw=open(forecast,"rb").read();assert hashlib.sha256(raw).hexdigest()==obs["archive_sha"]
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        A=npy(z.read("predictions.npy"),"<c8",(9,19501,3,3));f=npy(z.read("frequencies.npy"),"<f8",(19501,))
    rms=[[0.]*9 for _ in range(9)];maxima=[(0,None)]*9;checks=[];windows=0
    with zipfile.ZipFile(file) as z:
        for i,u in enumerate(reg["upper"]):
            for j,l in enumerate(reg["held_lower"]):
                row=next(x for x in reg["acquisitions"] if x["path"].endswith(f"diam {u}/Z{l}.mat"));raw=z.read(row["path"]);assert hashlib.sha256(raw).hexdigest()==row["sha256"]
                fields=numeric_fields(raw,{"Z_open","Z_closed","fmes"});assert list(fields["fmes"])==list(f)
                truth=[(y-1)/(y+1) for y in fields["Z_open"]]
                for r in range(9):
                    offsets=[2*((r*19501+k)*9+3*i+j) for k in range(19501)]
                    errs=[math.hypot(A[o]-y.real,A[o+1]-y.imag) for o,y in zip(offsets,truth)]
                    rms[r][i*3+j]=math.sqrt(math.fsum(v*v for v in errs)/19501)
                    checks.append(abs(rms[r][i*3+j]-obs["per_unit_rmse"][r][i][j]))
                    k=max(range(19501),key=errs.__getitem__)
                    if errs[k]>maxima[r][0]:maxima[r]=(errs[k],(k,u,l))
                    if (u,l)==(obs["worst_primary"]["upper"],obs["worst_primary"]["lower"]):
                        for rr in obs["worst_primary"]["window"]:
                            k=rr["index"];o=offsets[k]
                            assert [A[o],A[o+1]]==rr["role_reflections"][r] and [fields["Z_open"][k].real,fields["Z_open"][k].imag]==rr["Z_open"] and [fields["Z_closed"][k].real,fields["Z_closed"][k].imag]==rr["Z_closed"]
                            checks.append(abs(errs[k]-rr["role_errors"][r]));windows+=1
    means=[math.fsum(t)/9 for t in rms];wins=[sum(a<b for a,b in zip(rms[0],t)) for t in rms]
    for r,(v,loc) in enumerate(maxima):
        s=obs["worst_by_role"][r];assert loc==(s["index"],s["upper"],s["lower"]);checks.extend((abs(v-s["absolute"]),abs(means[r]-obs["mean_rmse"][r])))
    assert wins==obs["primary_wins_of_9"] and max(checks)<1e-12 and all(means[0]<m and n>=6 for m,n in zip(means[1:],wins[1:]))
    print(json.dumps(dict(original_archive=obs["archive_sha"],complex_residuals=9*9*19501,held_acquisitions=9,per_unit_cells=81,all_role_extremes=9,verified_local_role_rows=windows,max_abs_scalar_disagreement=max(checks),means=means,wins=wins),sort_keys=True))
if __name__=="__main__":main(*sys.argv[1:])
