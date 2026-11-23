"""Extract disjoint coarse pressure or measure full raw Haar detail energy."""
import json, hashlib, math, re
from pathlib import Path
from literal_development import books
from schema import FILES
from clock_and_repeat import val

def contract():
    return json.loads(Path("protocol.json").read_bytes())

def chunks(x):
    i=0
    while i<len(x):
        size=1 << min(6,(len(x)-i).bit_length()-1)
        yield i,x[i:i+size]
        i+=size

def summaries(x,scales,details):
    blocks=[(i,len(b),math.fsum(b)/len(b)) for i,b in chunks(x)]
    counts=[sum(n//s for _,n,_ in blocks) for s in scales]
    co={"n":len(x),"counts":counts,"dc_sha256":hashlib.sha256(json.dumps(blocks,separators=(",",":")).encode()).hexdigest(),
        "L":[math.fsum((n//s)*max(0.,a) for _,n,a in blocks)/k for s,k in zip(scales,counts)],
        "D2":[math.fsum((n//s)*max(0.,a)**2 for _,n,a in blocks)/k for s,k in zip(scales,counts)]}
    if not details:return co,None
    energy=[];worst=[]
    for s,count in zip(scales,counts):
        sq=[];peak=None
        for i,n,_ in blocks:
            for k in range(i,i+n-s+1,s):
                c=(math.fsum(x[k:k+s//2])-math.fsum(x[k+s//2:k+s]))/math.sqrt(s)
                sq.append(c*c)
                if peak is None or abs(c)>abs(peak[1]):peak=[k,c]
        assert len(sq)==count
        energy.append(math.fsum(sq)/count);worst.append(peak)
    total=math.fsum(v*v for v in x)
    transformed=math.fsum(n*a*a for _,n,a in blocks)+math.fsum(n*q for n,q in zip(counts,energy))
    assert math.isclose(total,transformed,rel_tol=2e-14,abs_tol=1e-8)
    assert sum(counts)+len(blocks)==len(x)
    return co,{"Q":energy,"maximum_coeff":worst,"energy":total,"raw":x}

def extract(unseal=False):
    p=contract();ids=set(p["held"]+p["development"]);train=set(p["development"]);records={};targets={}
    for name,rows,ss in books(next(n for n in FILES if n.startswith("S2"))):
        for k,c in rows[1].items():
            rep=val(c,ss)
            if not re.fullmatch(r"g[1-9]",str(rep)):continue
            ident=name+":"+rep
            assert ident in ids and ident not in records and val(rows[2][k+1],ss)=="σi (Pa)"
            x=[float(val(r[k+1],ss)) for r in rows[3:] if val(r.get(k),ss) is not None]
            assert len(x)==p["n"][ident] and all(map(math.isfinite,x))
            co,q=summaries(x,p["scales_ms"],unseal or ident in train)
            if ident in train:co["Q"]=q["Q"]
            if unseal and ident not in train:targets[ident]=q
            records[ident]=co
    assert set(records)==ids and set(targets)==(set(p["held"]) if unseal else set())
    return records,targets
