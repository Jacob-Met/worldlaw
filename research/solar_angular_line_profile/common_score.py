"""Verify locked forecasts before acquiring the three independent PEPSI date files."""
import base64, gzip, hashlib, io, json
from pathlib import Path
from urllib.request import urlopen,Request
import numpy as np
from common_model import C,V,sample,measure

ROOT=Path(__file__).resolve().parent
sha=lambda raw:hashlib.sha256(raw).hexdigest()

def header(raw,at):
    res={};start=at
    while True:
        block=raw[at:at+2880]
        if len(block)!=2880:raise ValueError("truncated FITS header")
        at+=2880
        for pos in range(0,2880,80):
            card=block[pos:pos+80].decode("ascii")
            key=card[:8].strip()
            if key=="END":return res,at
            if card[8:10]=="= ":
                value=card[10:].strip()
                res[key]=value[1:value.index("'",1)].strip() if value.startswith("'") else value.split("/")[0].strip()

def locked():
    lock=json.loads((ROOT/"common_forecast_lock.json").read_text())
    data=base64.b64decode((ROOT/"common_forecast_packet.txt").read_text().strip(),validate=True)
    assert sha(data)==lock["packet_sha256"] and len(data)==lock["packet_bytes"]
    with np.load(io.BytesIO(data),allow_pickle=False) as f:a={k:f[k] for k in f.files}
    assert set(a)==set(lock["arrays"])
    for k,x in a.items():
        assert [list(x.shape),sha(np.ascontiguousarray(x,dtype="<f8").tobytes())]==lock["arrays"][k]
    p=json.loads((ROOT/"common_protocol.json").read_text())
    assert np.array_equal(a["v"],V) and np.array_equal(a["lines"],p["lines"]) and a["forecast"].shape==(3,8,5,441)
    return p,a

def read(name,n,hsha):
    u="https://pepsi.aip.de/files/misc/paperI/deep/"+name
    with urlopen(Request(u,headers={"User-Agent":"Solar public scientific archive reader"}),timeout=70) as r:data=r.read()
    raw=gzip.decompress(data)
    h,pos=header(raw,0);t,start=header(raw,pos)
    assert h["NAXIS"]=="0" and h["INSTRUME"]=="PEPSI" and sha(raw[:start])==hsha
    assert [t["TTYPE"+str(i)] for i in range(1,5)]==["Arg","Fun","Var","Mask"]
    assert [t["TFORM"+str(i)] for i in range(1,5)]==["1D","1D","1D","1L"] and t["NAXIS1"]=="25" and int(t["NAXIS2"])==n
    a=np.frombuffer(raw,dtype=[("x",">f8"),("y",">f8"),("var",">f8"),("mask","S1")],count=n,offset=start)
    x=a["x"]
    if not np.all(np.diff(x)>0):raise ValueError("nonmonotone coordinate")
    scales=[s for s in (1,10,10000) if 3700<=s*x[0]<=4000 and 9000<=s*x[-1]<=9300]
    if len(scales)!=1:raise ValueError(("ambiguous full range",x[[0,-1]].tolist()))
    return a,scales[0],dict(file=name,compressed=sha(data),uncompressed=sha(raw),header=sha(raw[:start]),bytes=len(data),range=[float(x[0]),float(x[-1])],scale=scales[0])

def main():
    p,a=locked(); headers=["5ef369c015fecb44472a8aaafb737d4bdd37aef4a35d9843127c5cf247e8b8ed","cbfee9aa623d56f7fcf0e1b7f269c5ab6d45fff630e1b3d7e9e9075db6c3f419","945eac846105b21fed630891a0865077e670c1335a2439028790edb8460ca858"]
    rows=[];meta=[];worst=None;mixed=False;targets=[]
    for day,(name,n,h) in enumerate(zip(p["target"]["spectra"],[504427,504431,504389],headers)):
        tab,scale,kw=read(name,n,h);meta.append(kw);wave=tab["x"]*scale
        for j,lam in enumerate(p["lines"]):
            low,high=np.searchsorted(wave,lam*np.exp(np.array([-8.,8.])/C))
            t=tab[low:high]
            v=C*np.log(wave[low:high]/lam)
            z=sample(v,t["y"]);q,m=measure(np.maximum(1-z,0))
            flags={key.decode():int(ct) for key,ct in zip(*np.unique(t["mask"],return_counts=True))}
            if not set(flags)<=set("TF"):raise ValueError(("unknown FITS logical",flags))
            mixed|=len(flags)>1
            delta=a["forecast"][day,j]-q
            scores={str(core):np.sqrt(np.mean(delta[:,abs(V)<=core]**2,axis=1)).tolist() for core in [2,3,4,6]}
            jj=np.flatnonzero(abs(V)<=3)[np.argmax(abs(delta[0,abs(V)<=3]))]
            entry=dict(date=day,line=lam,v=float(V[jj]),observed=float(q[jj]),arms=a["forecast"][day,j,:,jj].tolist(),residual=float(delta[0,jj]))
            if worst is None or abs(entry["residual"])>abs(worst["residual"]):worst=entry
            rows.append(dict(date=day,line=lam,a_c=m,indices=[int(low),int(high)],flags=flags,rmse=scores,worst=entry))
            targets.append(dict(d=day,l=j,v=v.tolist(),x=t["x"].tolist(),y=t["y"].tolist(),var=t["var"].tolist(),mask=[v.decode() for v in t["mask"]],target=q.tolist()))
    daily=np.asarray([r["rmse"]["3"] for r in rows]).reshape(3,8,5).mean(1)
    print("SCORES "+json.dumps(dict(sources=meta,rows=rows,daily=daily.tolist(),mixed=mixed,gate=bool(not mixed and np.all(daily[:,0,None]<daily[:,1:3])),author_gate=bool(not mixed and np.all(daily[:,0]<daily[:,4])),worst=worst),separators=(",",":"),sort_keys=True),flush=True)
    print("TARGETS "+json.dumps(targets,separators=(",",":"),sort_keys=True),flush=True)
if __name__=="__main__":main()
