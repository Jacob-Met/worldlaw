"""Inspect only time columns, column counts, nonnumeric headers and official documentation."""
import collections
import hashlib
import json
import re
import urllib.request
from datetime import datetime
EAM="https://rz-vm480.gfz.de/files/ESMGFZ/EAM/operational_{}/ESMGFZ_{}_{}_{}_{}.asc"
C04="https://datacenter.iers.org/data/234/eopc04_20.1962-now.txt"
def address(kind,year):
    v,step=("v1.0","03h") if kind in ("AAM","OAM") else ("v1.2","24h")
    return EAM.format(kind,kind,v,step,year)
def download(url, cap):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Public IERS/GFZ timebase and product provenance audit"}),timeout=55) as r:
        b=r.read(cap+1)
    if len(b)>cap:raise ValueError("declared bound")
    return b
def inventory(name,url):
    blob=download(url,7000000)
    header=[];epochs=[];counts=collections.Counter()
    for line in blob.splitlines():
        q=line.split()
        if not q:continue
        # The first four fields are Gregorian year, month, day, hour; fifth field is MJD.
        if q[0].isdigit() and len(q[0])==4:
            yyyy,mm,dd,hh=map(int,q[:4]);mjd=float(q[4])
            ref=(datetime(yyyy,mm,dd,hh)-datetime(1858,11,17)).total_seconds()/86400
            if abs(mjd-ref)>1e-6:raise ValueError(("clock",name,[yyyy,mm,dd,hh,mjd]))
            counts[len(q)]+=1;epochs.append(mjd)
        else:
            if len(header)<50:header.append(line.decode("ascii",errors="replace")[:220])
    if not epochs:raise ValueError(("clock/parser",name,header[:2]))
    delta=collections.Counter(round(b-a,8) for a,b in zip(epochs,epochs[1:]))
    return dict(name=name,url=url,bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest(),
                count=len(epochs),first=epochs[0],last=epochs[-1],field_counts=counts,
                steps=delta,header=header)
def main():
    from concurrent.futures import ThreadPoolExecutor
    targets=[(k,address(k,y)) for k in ("AAM","OAM","HAM","SLAM") for y in (2003,2014,2015,2024)]+[("C04",C04)]
    def safe(k):
        try:return inventory(*k)
        except Exception as e:return dict(refusal=[k[0],k[1],type(e).__name__,str(e)])
    with ThreadPoolExecutor(3) as p:
        for row in p.map(safe,targets):print("CLOCK",json.dumps(row,sort_keys=True),flush=True)
    print("Signal columns parsed: zero")
if __name__=="__main__":main()
