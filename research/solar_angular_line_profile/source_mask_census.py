import concurrent.futures, hashlib, json, math, struct, urllib.request
from itertools import groupby
BASE="https://www.astro.physik.uni-goettingen.de/research/solar-lib/data/"
angles=[0.2,0.3,0.35,0.4,0.5,0.6,0.7,0.8,0.9,0.95,0.97,0.98,0.99,1]
lines=[5250.2084,5250.6453,5432.947,5434.5232,5576.0881,6173.3344,6301.5008,6302.4932]
C=299792.458
def vac(a):
    w=a
    for _ in range(4):
        s=(10000/w)**2
        w=a*(1+1e-8*(8342.13+2406030/(130-s)+15997/(38.9-s)))
    return w
def read(mu):
    rows=[]
    for a in lines:
        center=vac(a)
        i=math.floor((center*math.exp(-22/C)-4200)*1000)-2
        j=math.ceil((center*math.exp(22/C)-4200)*1000)+2
        p=2880+8*(3800001+i);n=8*(j-i+1)
        req=urllib.request.Request(BASE+f"solarspectrum_mu{mu:.2f}.fits",headers={"Range":f"bytes={p}-{p+n-1}","User-Agent":"Solar atlas public support audit"})
        with urllib.request.urlopen(req,timeout=35) as r:
            assert r.status==206 and r.headers["Content-Range"].startswith(f"bytes {p}-{p+n-1}/")
            buf=r.read(n+1)
        assert len(buf)==n
        # IEEE binary64 exponent only. Never decode or report a finite intensity.
        bad=[i+k for k,(u,) in enumerate(struct.iter_unpack(">Q",buf)) if (u>>52)&2047==2047]
        groups=[list(x[1] for x in g) for key,g in groupby(enumerate(bad),lambda x:x[1]-x[0])]
        def coord(q):return round(C*math.log((4200+q*.001)/center),6)
        rows.append({"air":a,"slice":[i,j],"sha256":hashlib.sha256(buf).hexdigest(),"nonfinite":len(bad),"invalid_runs":[[g[0],g[-1],coord(g[0]),coord(g[-1])] for g in groups]})
    return {"mu":mu,"rows":rows}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:out=list(pool.map(read,angles))
print("MASK_ONLY",json.dumps(out,separators=(",",":")),flush=True)
