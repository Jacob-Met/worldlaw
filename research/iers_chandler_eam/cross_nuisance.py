"""Postscore crossed-nuisance diagnostic for the frozen triaxial and isotropic roles."""
import base64
import cmath
import hashlib
import json
import math
import zlib
from datetime import date,timedelta
from cold_recount import archive,ph,read
def targets():
    receipt=read("held_geodetic.json")
    raw=zlib.decompress(base64.b64decode(receipt["zlib_base64"]))
    assert len(raw)==receipt["bytes"] and hashlib.sha256(raw).hexdigest()==receipt["sha256"]
    out={}
    for l in raw.splitlines():
        y,m,d,_,_,x,w=l.split()
        out[date(int(y),int(m),int(d))]=1000*complex(float(x),-float(w))
    assert len(out)==3643
    return out
def diagnostic():
    truth=targets();fit=read("development.json")["fit"]
    a,b=fit[0]["coef"],fit[1]["coef"]
    diff=[complex(a[k]-b[k],a[k+4]-b[k+4]) for k in range(4)]
    dt=cmath.exp((1j-1/358)*2*math.pi/434.2)
    orient=cmath.exp(1j*math.radians(-14.928509))
    r=math.sqrt(8.0100829*(8.0364807-8.0100829)/(8.0102594*(8.0364807-8.0102594)))
    rows={}
    for y,locked in sorted(archive().items()):
        corr_t=corr_i=0j;loss=[0.0]*4
        for i,p in enumerate(locked):
            d=date(y,1,1)+timedelta(days=i);obs=truth[d+timedelta(days=1)]
            v=sum(z*f for z,f in zip(diff,ph(d)))
            q=(corr_t+v)/orient;q=dt*complex(q.real,q.imag/r)
            corr_t=-v+orient*complex(q.real,r*q.imag)
            corr_i=v+dt*(corr_i-v)
            for k,z in enumerate([p[1],p[1]+corr_i,p[0]+corr_t,p[0]]):loss[k]+=abs(z-obs)**2
        ii,it,ti,tt=[math.sqrt(s/len(locked)) for s in loss]
        shape=((ti-ii)+(tt-it))/2;coef=((it-ii)+(tt-ti))/2
        assert abs(shape+coef-(tt-ii))<1e-12
        rows[y]=[ii,it,ti,tt,shape,coef]
    return dict(order=["iso+iso_coef","iso+triax_coef","triax+iso_coef","triax+triax_coef","shape_change_RMSE","coef_change_RMSE"],by_year=rows,average=[math.fsum(v[k] for v in rows.values())/10 for k in range(6)])
if __name__=="__main__":print(json.dumps(diagnostic(),sort_keys=True))
