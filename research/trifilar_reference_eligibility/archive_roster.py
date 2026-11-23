"""Read the v4 public archive's end record and central directory only. Never read file payloads."""
import hashlib,json,re,struct,urllib.request,collections
u="https://data.mendeley.com/public-api/zip/zww548rfbn/download/4"
def read_range(spec,expected):
    req=urllib.request.Request(u,headers={"User-Agent":"Public scientific metadata reader","Range":"bytes="+spec})
    with urllib.request.urlopen(req,timeout=45) as r:
        if r.status!=206:raise ValueError(("server did not honor Range",r.status))
        cr=r.headers.get("Content-Range","");m=re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)",cr)
        if not m:raise ValueError("missing byte interval")
        a,b,n=map(int,m.groups())
        if b-a+1!=expected:raise ValueError(("unexpected response bytes",cr,expected))
        d=r.read(expected+1)
        if len(d)!=expected:raise ValueError("short read")
        return d,a,b,n
out={"version":4,"physical_files_opened":0}
try:
    d,a,b,n=read_range("-22",22)
    sig,disk,cddisk,local,total,cs,off,comment=struct.unpack("<4s4H2IH",d)
    if sig!=b"PK\x05\x06" or comment or disk or cddisk or total!=local or cs>4000000 or off+cs!=a:raise ValueError(("unsupported end record",list(d[:4]),total,cs,off,a))
    index,ia,ib,nn=read_range(f"{off}-{off+cs-1}",cs)
    if (ia,ib,nn)!=(off,off+cs-1,n):raise ValueError("range position changed")
    pos=0; record=[];dirs=collections.Counter()
    for _ in range(total):
        if index[pos:pos+4]!=b"PK\x01\x02":raise ValueError("central header mismatch")
        method=struct.unpack_from("<H",index,pos+10)[0]
        crc,slen,flen=struct.unpack_from("<III",index,pos+16)
        l,e,c=struct.unpack_from("<3H",index,pos+28)
        name=index[pos+46:pos+46+l].decode("utf-8")
        folder=name.split("/")
        if len(folder)>1:dirs[folder[1]]+=1
        if "example data" in name.lower() or "calibration" in name.lower() and "design" not in name.lower():
            record.append([name,flen,slen,format(crc,"08x")])
        pos+=46+l+e+c
    if pos!=len(index):raise ValueError("unexpected central directory bytes")
    out.update(archive_bytes=n,central_sha256=hashlib.sha256(index).hexdigest(),declared_members=total,top_folders=dirs,example_count=len(record),example_members=record[:180])
except (OSError,ValueError) as e:out["intake_refusal"]=str(e)
print(json.dumps(out,sort_keys=True))
