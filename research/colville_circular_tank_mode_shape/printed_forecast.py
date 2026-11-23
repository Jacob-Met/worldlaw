"""Fixed PDF-chart receiver. Forecast stage receives development plus upper-envelope summaries only."""
import hashlib,io,json,pathlib,sys,urllib.request
from collections import Counter
from functools import lru_cache
import numpy as np
import pymupdf
from PIL import Image
P=pathlib.Path(".")
def sha(b):return hashlib.sha256(b).hexdigest()
def read(n):return json.loads((P/n).read_text())
@lru_cache(maxsize=1)
def pdf_bytes(url,expected):
    with urllib.request.urlopen(url,timeout=100) as f:pdf=f.read()
    assert sha(pdf)==expected
    return pdf

def chart(reg,which):
    pdf=pdf_bytes(reg["source"]["pdf_url"],reg["source"]["pdf_sha256"])
    doc=pymupdf.open(stream=pdf,filetype="pdf");g=reg["figs"][which]
    im=doc.extract_image(g["xref"]);raw=im["image"]
    pic=np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"),dtype=np.int32)
    h,w=pic.shape[:2];assert [h,w]==[g["height"],g["width"]]
    colors=[]
    for yy in g["swatch_y"]:
        win=pic[round((yy-.011)*h):round((yy+.011)*h)+1,round(.73*w):round(.79*w)+1]
        eligible=win[win.max(2)-win.min(2)>=50];assert len(eligible)>0
        # Count coarse color cells, then use the median RGB in the modal cell.
        codes=eligible//32;freq=Counter(tuple(row) for row in codes);code=min(freq,key=lambda k:(-freq[k],k))
        colors.append(np.rint(np.median(eligible[(codes==code).all(1)],axis=0)).astype(int).tolist())
    assert min(np.linalg.norm(np.subtract(colors[i],colors[j])) for i in range(3) for j in range(i))>100
    d=np.stack([np.sum((pic-c)**2,axis=2) for c in colors],axis=2)
    labels=np.argmin(d,axis=2);valid=(np.min(d,axis=2)<=96**2)&(pic.max(2)-pic.min(2)>=50)
    # No held y ordinates leave the trusted upper-only extraction stage.
    return g,h,w,labels,valid,colors,sha(raw)
def extract(reg,which,channel,side):
    g,h,w,labels,valid,colors,raw_sha=chart(reg,which)
    centers=.980+np.arange(41)*.001
    x=g["fx_lo"]+((np.arange(w)+.5)/w-g["px_lo"])*(g["fx_hi"]-g["fx_lo"])/(g["px_hi"]-g["px_lo"])
    vals=[];counts=[]
    for f in centers:
        col=(x>=f-.0005)&(x<f+.0005)
        yy,_=np.nonzero((labels[:,col]==channel)&valid[:,col]);counts.append(len(yy))
        amp=(g["y0"]-(yy+.5)/h)/g["dy_per_unit"]
        vals.append(float(np.quantile(amp,side)) if len(amp)>=3 else None)
    return {"values":vals,"counts":counts,"palette":colors,"image_sha":raw_sha}
def fit(reg):
    rows=[]
    for ch in range(3):
        up=extract(reg,"development",ch,.95)["values"];lo=extract(reg,"development",ch,.05)["values"]
        pairs=[(i,u,v) for i,(u,v) in enumerate(zip(up,lo)) if u is not None]
        assert len(pairs)>=20 and min(u for _,u,v in pairs)>=0;rows.extend(pairs)
    i,u,y=np.array(rows).T;scale=float(np.mean(u));a=u/scale
    pool=float(u@y/(u@u))
    fits={n:np.linalg.lstsq(np.stack([a**k for k in range(n+1)],axis=1),y,rcond=None)[0].tolist() for n in (1,2)}
    freq=[]
    for ix in range(41):
        mask=np.abs(i-ix)<=3;s=u[mask];freq.append(float(s@y[mask]/(s@s)) if s@s>0 else pool)
    return {"training_pairs":len(rows),"scale":scale,"pool":pool,"affine":fits[1],"quadratic":fits[2],"frequency":freq}
def predict(reg,upper,fill,fit):
    r=reg["ratios"][fill];factor=min(r,1/r);other=reg["ratios"][".67" if fill==".5" else ".5"]
    rows=[]
    for i,u in enumerate(upper):
        if u is None:rows.append([None]*len(reg["roles"]));continue
        assert u>=0
        a=u/fit["scale"];poly=lambda q:sum(v*a**k for k,v in enumerate(q))
        gap=(1-fit["pool"])/(1-reg["ratios"][".3"])
        vals=[factor*u,u,0,fit["pool"]*u,poly(fit["affine"]),poly(fit["quadratic"]),fit["frequency"][i]*u,(1-gap*(1-factor))*u,min(other,1/other)*u,r*u]
        rows.append(np.clip(vals,0,u).tolist())
    return rows
def forecast():
    reg=read("printed-protocol.json");model=fit(reg);rows=[]
    for ch,fill in [(1,".5"),(2,".67")]:
        up=extract(reg,"held",ch,.95)
        rows.append({"fill":fill,"upper":up,"forecast":predict(reg,up["values"],fill,model)})
    print(json.dumps({"protocol_sha":sha((P/"printed-protocol.json").read_bytes()),"roles":reg["roles"],"training":model,"rows":rows,"held_lower_outputs_emitted":0},sort_keys=True))
if __name__=="__main__":forecast()
