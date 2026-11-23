"""Generate all angular and published-control predictions before reading the target."""
import base64,hashlib,io,json
from pathlib import Path
import numpy as np
from common_acquisition import inputs
from common_model import V,predict
def main():
    p=json.loads(Path(__file__).with_name("common_protocol.json").read_text())
    mu=np.asarray(p["angles"]);lines=np.asarray(p["lines"])
    local,author,r=inputs(p);out=[];detail=[]
    for date in p["target"]["dates"]:
        one=[]
        for j,line in enumerate(lines):
            a=(mu,local[:,j],author[j],line,date)
            pred,d=predict(*a);one.append(pred)
            d.update(date=date,line=float(line));d["sensitivity"]={}
            for name,kw in [("narrow",dict(flat=4,edge=6.3)),("steep",dict(flat=6,edge=7.3)),("square",dict(flat=7.19,edge=7.3)),("linear_limb",dict(limb="linear")),("omit_limb",dict(limb="omit")),("sidereal",dict(sidereal=True)),("start",dict(hours=0)),("end",dict(hours=24))]:
                other,_=predict(*a,**kw)
                d["sensitivity"][name]=float(np.sqrt(np.mean((other[0,abs(V)<=3]-pred[0,abs(V)<=3])**2)))
            d["coupling_rms"]=float(np.sqrt(np.mean((pred[0,abs(V)<=3]-pred[1,abs(V)<=3])**2)));detail.append(d)
        out.append(one)
    ix=abs(V)<7.3
    a=dict(v=V,observed_v=V[ix],mu=mu,lines=lines,local=local[:,:,ix],author=author[:,ix],forecast=np.asarray(out))
    assert a["forecast"].shape==(3,8,5,441) and all(np.all(np.isfinite(x)) for x in a.values())
    buf=io.BytesIO();np.savez_compressed(buf,**a);data=buf.getvalue()
    stamp=dict(records=detail,slices=r,arrays={k:[list(x.shape),hashlib.sha256(np.ascontiguousarray(x,dtype="<f8").tobytes()).hexdigest()] for k,x in a.items()},packet_bytes=len(data),packet_sha256=hashlib.sha256(data).hexdigest(),target_spectral_rows=0)
    print("FORECAST "+json.dumps(stamp,sort_keys=True,separators=(",",":")),flush=True)
    for off in range(0,len(data),24000):print("PACK "+str(off)+" "+base64.b64encode(data[off:off+24000]).decode(),flush=True)
if __name__=="__main__":main()
