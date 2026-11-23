"""Access only the atmosphere-excised resolved atlas and published disk control."""
import hashlib
import numpy as np
from acquisition import BASE,C,headers,read_range,vacuum
from common_model import sample

def inputs(p):
    angles=np.asarray(p["angles"]);lines=np.asarray(p["lines"])
    results=[];receipts=[]
    for k in list(angles)+[None]:
        pub=k is None
        u=BASE+("IAG23_atlas.fits" if pub else f"solarspectrum_mu{k:.2f}.fits")
        h,off=headers(u)
        if off!=2880:raise ValueError("primary structure")
        if pub:
            h+=read_range(u,off,2880);off+=2880
            if not(b"BINTABLE" in h and b"Angstrom (in Vacuum)" in h):raise ValueError("table identity")
        rows=[]
        for line in lines:
            c=float(vacuum(line))
            i=int(np.ceil((c*np.exp(-8/C)-4200)*1000));j=int(np.floor((c*np.exp(8/C)-4200)*1000))
            if pub:
                init=np.frombuffer(read_range(u,off+16*i,8),dtype=">f8")[0]
                shift=round((init-(4200+i*.001))/.001);i-=shift;j-=shift
                raw=read_range(u,off+16*i,16*(j-i+1));x,y=np.frombuffer(raw,dtype=">f8").reshape(-1,2).T
            else:
                a=read_range(u,off+8*i,8*(j-i+1));b=read_range(u,off+8*(3800001+i),8*(j-i+1));raw=a+b
                x=np.frombuffer(a,dtype=">f8");y=np.frombuffer(b,dtype=">f8")
            v=C*np.log(x/c)
            if max(abs(v))>8.00001 or max(abs(np.diff(x)-.001))>2e-6 or not np.all(np.isfinite(y)):
                raise ValueError(("raw source support",k,line,float(v[0]),float(v[-1])))
            rows.append(sample(v,y));receipts.append(dict(mu=None if pub else float(k),line=float(line),i=i,j=j,v=[float(v[0]),float(v[-1])],sha=hashlib.sha256(raw).hexdigest()))
        results.append(np.stack(rows))
    return np.stack(results[:-1]),results[-1],receipts
