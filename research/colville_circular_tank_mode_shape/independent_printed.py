"""Independent per-pixel receiving, with exact source files and no imports from the forecast or primary scorer."""
import collections,hashlib,io,json,math,pathlib,statistics,urllib.request
from PIL import Image
import pymupdf
P=pathlib.Path(".")
def read(n):return json.loads((P/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
reg=read("printed-protocol.json");lock=read("upper-forecast-lock.json");result=read("score.json")
assert result["lock_sha"]==sha((P/"upper-forecast-lock.json").read_bytes()) and lock["protocol_sha"]==sha((P/"printed-protocol.json").read_bytes())
assert reg["roles"]==lock["roles"]==result["roles"]
with urllib.request.urlopen(reg["source"]["pdf_url"],timeout=90) as f:b=f.read()
assert sha(b)==reg["source"]["pdf_sha256"]
doc=pymupdf.open(stream=b,filetype="pdf")
def quant(v,z):
    s=sorted(v);t=z*(len(s)-1);i=math.floor(t)
    return s[i]+(s[min(i+1,len(s)-1)]-s[i])*(t-i)
def stripes(which):
    g=reg["figs"][which];raw=doc.extract_image(g["xref"])["image"];im=Image.open(io.BytesIO(raw)).convert("RGB");w,h=im.size
    pix=im.load();palette=[]
    for f in g["swatch_y"]:
        cs=[pix[x,y] for x in range(round(.73*w),round(.79*w)+1) for y in range(round((f-.011)*h),round((f+.011)*h)+1)]
        cs=[c for c in cs if max(c)-min(c)>=50];bins=collections.Counter(tuple(a//32 for a in c) for c in cs)
        key=min(bins,key=lambda k:(-bins[k],k));group=[c for c in cs if tuple(v//32 for v in c)==key]
        palette.append([round(statistics.median(a)) for a in zip(*group)])
    table=[]
    for i in range(41):
        f=.980+i*.001;counts=[[] for _ in palette]
        for x in range(w):
            fx=g["fx_lo"]+((x+.5)/w-g["px_lo"])*(g["fx_hi"]-g["fx_lo"])/(g["px_hi"]-g["px_lo"])
            if not (f-.0005<=fx<f+.0005):continue
            for y in range(h):
                rgb=pix[x,y]
                if max(rgb)-min(rgb)<50:continue
                ds=[sum((a-b)**2 for a,b in zip(k,rgb)) for k in palette];ch=ds.index(min(ds))
                if ds[ch]<=96**2:counts[ch].append((g["y0"]-(y+.5)/h)/g["dy_per_unit"])
        table.append([(len(v),quant(v,.95),quant(v,.05)) if len(v)>=3 else (len(v),None,None) for v in counts])
    return table,palette,sha(raw)
def solve(A,b):
    c=[list(r)+[v] for r,v in zip(A,b)]
    for j in range(len(c)):
        p=max(range(j,len(c)),key=lambda i:abs(c[i][j]));c[j],c[p]=c[p],c[j]
        h=c[j][j];assert abs(h)>1e-11;c[j]=[v/h for v in c[j]]
        for i in range(len(c)):
            if i!=j:
                h=c[i][j];c[i]=[v-h*k for v,k in zip(c[i],c[j])]
    return [r[-1] for r in c]
train,_,_=stripes("development");data=[(i,u,v) for i,row in enumerate(train) for n,u,v in row if u is not None]
def slope(d):
    return math.fsum(u*v for _,u,v in d)/math.fsum(u*u for _,u,v in d)
pool=slope(data);m=statistics.fmean(u for _,u,v in data)
def poly(n):
    G=[[math.fsum((u/m)**(i+j) for _,u,v in data) for j in range(n+1)] for i in range(n+1)]
    rhs=[math.fsum((u/m)**i*v for _,u,v in data) for i in range(n+1)]
    return solve(G,rhs)
p1,p2=poly(1),poly(2);held,palette,imsha=stripes("held");mx=0.;metric=0.;avail=[];dec=[];tails=[]
for ch,(ql,qr) in enumerate(zip(lock["rows"],result["rows"]),1):
    f=ql["fill"];r=reg["ratios"][f];z=min(r,1/r);oth=reg["ratios"][".67" if f==".5" else ".5"];errors=[];ids=[]
    assert ql["upper"]["palette"]==palette and ql["upper"]["image_sha"]==imsha
    for i,(pred,case) in enumerate(zip(ql["forecast"],qr["cases"])):
        n,u,l=held[i][ch];assert n==case["colored_pixels"]==ql["upper"]["counts"][i]
        if u is None:
            assert case["upper"] is None and case["lower"] is None and all(a is None for a in pred);continue
        mx=max(mx,abs(u-case["upper"]),abs(l-case["lower"]),abs(u-ql["upper"]["values"][i]))
        local=[v for v in data if abs(v[0]-i)<=3];d=slope(local) if local and any(v[1] for v in local) else pool
        cp=lambda c:sum(v*(u/m)**j for j,v in enumerate(c))
        forecasts=[z*u,u,0,pool*u,cp(p1),cp(p2),d*u,(1-(1-pool)/(1-reg["ratios"][".3"])*(1-z))*u,min(oth,1/oth)*u,r*u]
        forecasts=[min(u,max(0,a)) for a in forecasts]
        mx=max(mx,max(abs(a-b) for a,b in zip(forecasts,pred)));ids.append(i);errors.append([a-l for a in forecasts])
    rm=[math.sqrt(statistics.fmean(v*v for v in a)) for a in zip(*errors)]
    ma=[statistics.fmean(abs(v) for v in a) for a in zip(*errors)]
    metric=max(metric,max(abs(x-y) for x,y in zip(rm+ma,qr["rmse"]+qr["mae"])))
    worst=[ids[max(range(len(ids)),key=lambda i:abs(errors[i][k]))] for k in range(10)]
    assert worst==qr["each_worst_bin"]
    passed=len(ids)==41 and all(rm[0]<rm[k] for k in (1,2,3,4,5,6,8))
    assert passed==qr["gate"];dec.append(passed);avail.append(len(ids));tails.append(worst[0])
assert mx<1e-12 and metric<1e-12 and result["gate"]==all(dec)
print(json.dumps({"archive_sha":reg["source"]["pdf_sha256"],"forecast_sha":result["lock_sha"],"training_stripes":len(data),"available_by_held_fill":avail,"held_arms_recounted":sum(avail)*10,"all_82_input_census":True,"primary_worst_bins":tails,"all_20_worst_indices_equal":True,"endpoint_and_forecast_max_diff":mx,"all_40_metric_max_diff":metric,"per_fill_gate":dec,"joint":all(dec)},sort_keys=True))
