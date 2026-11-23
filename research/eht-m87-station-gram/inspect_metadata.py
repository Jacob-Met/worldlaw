import collections, fractions, hashlib, itertools, json, math, struct, tarfile, io, urllib.request
H="27ae76aacb9067a83388395c3826012b97aac371"
BASE="https://raw.githubusercontent.com/eventhorizontelescope/2019-D01-01/"+H+"/"
def source(name,blob):
    b=urllib.request.urlopen(urllib.request.Request(BASE+name,headers={"User-Agent":"WORLDLAW EHT metadata receiver"}),timeout=80).read()
    assert hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()==blob
    return b
def header(raw,start):
    tags={};i=start
    while True:
        if i+80>len(raw):raise ValueError("truncated FITS header")
        c=raw[i:i+80].decode("ascii");i+=80;k=c[:8].strip()
        if k=="END":break
        if c[8:10]=="= ":
            v=c[10:].split("/",1)[0].strip()
            tags[k]=v.strip("'").strip()
    return tags,start+math.ceil((i-start)/2880)*2880
def fmt(spec):
    import re
    m=re.fullmatch(r"(\d*)([A-Z])",spec)
    assert m,spec
    n=int(m[1] or 1);t=m[2]
    sizes={"A":1,"L":1,"B":1,"I":2,"J":4,"K":8,"E":4,"D":8,"C":8,"M":16}
    return n*sizes[t]
def station_table(raw,pos):
    while pos<len(raw):
        a,p=header(raw,pos)
        if a.get("XTENSION")=="BINTABLE":
            rows=int(a["NAXIS2"]);stride=int(a["NAXIS1"]);fields=int(a["TFIELDS"])
            names={};off=0
            for j in range(1,fields+1):
                nm=a["TTYPE"+str(j)];form=a["TFORM"+str(j)]
                names[nm]=(off,form);off+=fmt(form)
            if a.get("EXTNAME","").strip()=="AIPS AN":
                result={}
                for j in range(rows):
                    i=p+j*stride
                    off,form=names["ANNAME"];name=raw[i+off:i+off+fmt(form)].decode().strip(" \0")
                    off,form=names["NOSTA"];sta=int.from_bytes(raw[i+off:i+off+fmt(form)],"big",signed=True)
                    result[sta]=name
                return result
            n=stride*rows+int(a.get("PCOUNT",0))
        else:n=math.prod(int(a["NAXIS"+str(k)]) for k in range(1,int(a["NAXIS"])+1))*abs(int(a["BITPIX"]))//8
        pos=p+math.ceil(n/2880)*2880
    raise ValueError("missing AIPS AN")
def inspect(name,b):
    h,p=header(b,0);np=int(h["PCOUNT"]);ng=int(h["GCOUNT"]);bit=int(h["BITPIX"])
    na=int(h["NAXIS"]);dims=[int(h["NAXIS"+str(j)]) for j in range(1,na+1)]
    assert h["GROUPS"]=="T" and dims[0]==0 and bit in (-32,-64)
    nbyte=abs(bit)//8;stride=(np+math.prod(dims[1:]))*nbyte
    sta=station_table(b,p+math.ceil(ng*stride/2880)*2880);form=">f" if bit==-32 else ">d"
    meta=[]
    for j in range(np):
        k=str(j+1)
        tag=h["PTYPE"+k].strip()
        if tag in ("BASELINE","DATE","_DATE","INTTIM"):
            meta.append((j,tag,fractions.Fraction(h.get("PSCAL"+k,"1").replace("D","E")),fractions.Fraction(h.get("PZERO"+k,"0").replace("D","E"))))
    assert {m[1] for m in meta}>={"BASELINE","DATE"}
    sets=collections.defaultdict(list);exp=collections.Counter()
    for j in range(ng):
        d=fractions.Fraction(0);baseline=None;duration=None
        for pos,t,scale,zero in meta:
            f=fractions.Fraction.from_float(struct.unpack_from(form,b,p+j*stride+pos*nbyte)[0])*scale+zero
            if t in ("DATE","_DATE"):d+=f
            if t=="BASELINE":baseline=int(f)
            if t=="INTTIM":duration=f;exp[f]+=1
        assert baseline is not None
        if baseline>=65536:abase,bbase=divmod(baseline-65536,2048)
        else:abase,bbase=divmod(baseline,256)
        assert abase in sta and bbase in sta
        sets[d].append((tuple(sorted((sta[abase],sta[bbase]))),duration))
    counts=collections.Counter();width=collections.Counter();maxgap=fractions.Fraction(0);worst=None;ld=None
    for date,edges in sets.items():
        D=dict(edges)
        assert len(edges)==len(D), "duplicate pair in common timestamp"
        if ld is None:ld=date
        nodes=sorted(set(k for e in D for k in e))
        for v in itertools.combinations(nodes,4):
            E=list(itertools.combinations(v,2))
            if not all(e in D for e in E):continue
            dur=[D[e] for e in E]
            assert all(x is not None and x>0 for x in dur)
            gap=max(dur)-min(dur);counts["all_quadruples"]+=1
            counts["equal_integration"]+=int(gap==0)
            counts["all_10s"]+=int(min(dur)==max(dur)==10)
            counts["at_least_99pct_each"]+=int(min(dur)>=fractions.Fraction(99,10))
            counts["spread_above_0.1s"]+=int(gap>fractions.Fraction(1,10))
            counts["spread_above_1s"]+=int(gap>1)
            counts["four_distinct_sites"]+=int(not({"AA","AP"}<=set(v) or {"JC","SM"}<=set(v)))
            if gap>maxgap:
                maxgap=gap;worst=[str(date),v,[str(z) for z in dur]]
    print("DURATION",json.dumps({"file":name,"raw_sha":hashlib.sha256(b).hexdigest(),"groups":ng,"exact_timestamps":len(sets),
        "distinct_integrations":len(exp),"min_s":float(min(exp)),"max_s":float(max(exp)),"counts":counts,"largest_within_quad_spread_s":float(maxgap),
        "witness_JD_and_six_durations_ab_ac_ad_bc_bd_cd":worst},sort_keys=True))
inv=source("INVENTORY.txt","1ffeacf6d75fc9aa23e144580840c5fffd91e66d").decode()
readme=source("README.md","63f0dfe050ce0bc4f7fd13d9120093b3cf486461")
archive=source("EHTC_FirstM87Results_Apr2019_uvfits.tgz","8bc9a7b4fe6af30e24283e8669d04061f44fe7ef")
print("OFFICIAL",H,len(archive),hashlib.sha256(archive).hexdigest(),hashlib.sha256(readme).hexdigest())
expected={l.split("/")[-1] for l in inv.splitlines() if l.endswith(".uvfits")};assert len(expected)==8
with tarfile.open(fileobj=io.BytesIO(archive),mode="r:gz") as t:
    arrived=set()
    for m in t.getmembers():
        name=m.name.split("/")[-1]
        if name not in expected:continue
        assert m.isfile() and name not in arrived
        arrived.add(name);inspect(name,t.extractfile(m).read())
assert arrived==expected
print("All 8 products are named hops_netcal_StokesI; only 10-second random-group parameters/date/station membership and AIPS antenna identity decoded. No visibility components, weights or derived closures decoded; possible cliques precede missing-data/flag qualification.")

