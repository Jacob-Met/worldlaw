import hashlib,json,os,re,subprocess,tempfile,urllib.request
import numpy as np
from figure_reader import fig,readaxes,numbers,names
url="https://par.nsf.gov/servlets/purl/10378224"
pdf=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"WORLDLAW R-only panel registration"}),timeout=90).read()
assert hashlib.sha256(pdf).hexdigest()=="733c2b5298a2c663ddbb5c3835704ca7def1a28b0f1ba01a984c423fd861d831"
open("article.pdf","wb").write(pdf)
subprocess.run(["pdftoppm","-f","3","-l","3","-r","720","-x","3300","-y","870","-W","1450","-H","850","-singlefile","article.pdf","only_R"],check=True)
raw=open("only_R.ppm","rb").read();m=re.match(br"P6\s+1450\s+850\s+255\s",raw);assert m
a=np.frombuffer(raw[m.end():],dtype=np.uint8).reshape(850,1450,3).astype(float)
# A complete electrical-only crop. All yielded points are above the panel bottom;
# no coordinates or rendered pixels from either temperature plot are consumed.
curves=[]
for labels,lines in readaxes(fig("Fig2_b_top_middle.fig",names["Fig2_b_top_middle.fig"])):
    if not any(isinstance(s,str) and "R_{bridge}" in s for s in labels):continue
    for rgb,x,y in lines:curves.append((tuple(rgb),np.array(x),np.array(numbers(y))))
curves.sort(key=lambda row:row[0]);assert [len(c[1]) for c in curves]==[211,121,121]
palette=np.array([[0,114,189],[237,177,32],[217,83,25]],float)
distance=np.stack([np.sum((a-p)**2,axis=2) for p in palette],axis=0)
near=np.argmin(distance,axis=0);close=np.min(distance,axis=0)<90**2
records=[]
for j,p in enumerate(palette):
    yy,xx=np.where(close&(near==j)&((a.max(axis=2)-a.min(axis=2))>65))
    # One printed y median at each occupied electrical column.
    pts=np.array([(s,float(np.median(yy[xx==s]))) for s in np.unique(xx)],float)
    if len(pts)<50:
        records.append({"color":j,"ncol":len(pts)});continue
    g=((330+(pts[:,0]+.5)/10)-413.18)/11.11
    obs=87+(pts[:,1]+.5)/10
    errors=[]
    for color,x,r in curves:
        sel=(g>=x.min())&(g<=x.max())
        pred=176.97-18.685*np.interp(g[sel],x,r)
        errors.append(float(np.sqrt(np.mean((obs[sel]-pred)**2))))
    records.append({"color":j,"ncol":len(pts),"rms_points":errors})
print("REGISTRATION",json.dumps(records))
if all("rms_points" in r for r in records):
    e=np.array([r["rms_points"] for r in records]);direct=e[1,1]+e[2,2];flip=e[1,2]+e[2,1]
    print("GEOMETRIC_STRENGTH",float(e[0,0]),float(direct),float(flip))
    print("DIAGNOSTIC",("dark20" if direct<flip else "light20") if e[0,0]<1.25 and min(direct,flip)<.5*max(direct,flip) and ((e[1,1]<e[1,2])==(e[2,2]<e[2,1])) else "ambiguous")
print("Both R permutations remain compulsory. Only measured electrical resistance was decoded; held temperature signals were not opened.")
