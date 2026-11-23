"""Fresh raw-pressure reader and 55-digit Haar/score recount, with no forecast/scoring module imports."""
import hashlib,io,json,math,re,urllib.request,urllib.parse,zipfile
from pathlib import Path
from decimal import Decimal as D,getcontext
from xml.etree import ElementTree as ET
getcontext().prec=55
def load(n):
    return json.loads(Path(n).read_bytes(),parse_float=D)
def mean(x):
    v=list(x);return sum(v,D(0))/len(v)
def digit(v):
    return float(v)
def native_sources():
    fname="S2_data_granular flow_stress.xlsx"
    u="https://zenodo.org/records/5764145/files/"+urllib.parse.quote(fname)+"?download=1"
    with urllib.request.urlopen(u,timeout=120) as f:b=f.read(8000000)
    assert len(b)==7829391 and hashlib.sha256(b).hexdigest()==p["pressure_sha256"]
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        ss=["".join(x.text or "" for x in item.iterfind(".//{*}t")) for item in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rel={x.get("Id"):x.get("Target") for x in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        for s in ET.fromstring(z.read("xl/workbook.xml")).find("{*}sheets"):
            page=s.get("name");target=rel[next(v for k,v in s.attrib.items() if k.endswith("}id"))]
            cells={}
            root=ET.fromstring(z.read(target.lstrip("/") if target.startswith("/") else "xl/"+target))
            for c in root.iterfind(".//{*}c"):
                v=c.find("{*}v")
                if v is None or v.text is None:continue
                addr=c.get("r");col,row=re.fullmatch(r"([A-Z]+)([0-9]+)",addr).groups()
                ci=0
                for ch in col:ci=26*ci+ord(ch)-64
                cells[int(row),ci]=ss[int(v.text)] if c.get("t")=="s" else v.text
            for (row,col),name in cells.items():
                if row!=2 or not re.fullmatch(r"g[0-9]+",name):continue
                key=page+":"+name
                n=p["n"][key]
                assert cells[3,col+1]=="σi (Pa)"
                assert max(abs(D(cells[i+4,col])-D(i)/1000) for i in range(n))<D("5e-15")
                yield key,[D(cells[i+4,col+1]) for i in range(n)]
def vectors(x):
    n=len(x);sizes=[64]*(n//64)+[h for h in [32,16,8,4,2,1] if (n%64)&h]
    i=0;sums=[D(0)]*6;counts=[0]*6;L=[D(0)]*6;D2=[D(0)]*6;peaks=[None]*6;dc=D(0)
    for h in sizes:
        block=x[i:i+h];dc+=sum(block)**2/h;nodes=block[:];offset=1
        mu=max(D(0),mean(block))
        while len(nodes)>1:
            idx=offset.bit_length()-1;span=2*offset
            for j in range(0,len(nodes),2):
                delta=nodes[j]-nodes[j+1];power=delta*delta/span
                if peaks[idx] is None or power>peaks[idx][0]:peaks[idx]=(power,i+j*offset,delta/D(span).sqrt())
                sums[idx]+=power;counts[idx]+=1
                L[idx]+=mu;D2[idx]+=mu**2
            nodes=[nodes[k]+nodes[k+1] for k in range(0,len(nodes),2)];offset*=2
        i+=h
    err=abs(dc+sum(sums)-sum(v*v for v in x));assert err<D("1e-30")
    return [[s/n for s,n in zip(y,counts)] for y in [sums,L,D2]],counts,peaks
def cmp(a,b,kind):
    a,b=D(a),D(b)
    d=abs(a-b);q=d/max(D(1),abs(a),abs(b))
    maximum[kind]=max(maximum.get(kind,D(0)),q)
    census[kind]=census.get(kind,0)+1
    assert q<D("3e-12"),(kind,a,b)
if __name__=="__main__":
    p=load("protocol.json");f=load("forecast.json");s=load("score.json");lock=load("forecast-lock.json")
    b=Path("forecast.json").read_bytes();assert len(b)==lock["bytes"] and hashlib.sha256(b).hexdigest()==lock["sha256"]==s["forecast_sha256"]
    te=p["held"];tr=p["development"];roles=p["roles"];Dby={};targs={};peak={};raw={};maximum={};census={}
    for k,x in native_sources():
        (Q,L,D2),counts,peaks=vectors(x);a=f["permitted_inputs_and_development"][k];assert len(x)==a["n"] and counts==a["counts"]
        for actual,expected,id_ in [(L,a["L"],"L"),(D2,a["D2"],"D2")]:
            for v,w in zip(actual,expected):cmp(v,w,id_)
        for v,w in zip(Q,a["Q"] if k in tr else s["target_Q"][k]):cmp(v,w,"raw_energy")
        Dby[k]=Q
        if k in te:
            targs[k]=Q;peak[k]=peaks;raw[k]=x
    assert set(Dby)==set(te+tr) and set(targs)==set(te)
    norms={g:[mean(Dby[k][l] for k in tr if k[6]==g) for l in range(6)] for g in "12345"}
    rs={};gs={};tot={}
    for r in roles:
        rs[r]={};a_w=[];n_w=[]
        for k in te:
            ae=[abs(a-b) for a,b in zip(f["predictions"][k][r],targs[k])]
            ne=[a/b for a,b in zip(ae,norms[k[6]])]
            for l in range(6):
                a_w.append((ae[l],k,l));n_w.append((ne[l],k,l))
            v=[mean(x*x for x in ne).sqrt(),mean(ne),mean(x*x for x in ae).sqrt(),mean(ae)]
            for x,y in zip(v,s["run"][r][k]):cmp(x,y,"run_metric")
            rs[r][k]=v
        for a,key in [(a_w,"absolute"),(n_w,"normalized")]:
            m,k,l=max(a,key=lambda t:t[0]);v,idx=s["worsts"][r][key]
            assert idx==[k,l];cmp(m,v,"worst")
        gs[r]={g:[mean(v[q] for k,v in rs[r].items() if k[6]==g) for q in range(4)] for g in norms}
        for g,v in gs[r].items():
            for x,y in zip(v,s["composition"][r][g]):cmp(x,y,"group_metric")
        tot[r]=[mean(row[q] for row in gs[r].values()) for q in range(4)]
        for x,y in zip(tot[r],s["mean"][r]):cmp(x,y,"aggregate")
    c=p["candidate"];wins={r:sum(gs[c][g][0]<gs[r][g][0] for g in norms) for r in roles if r!=c}
    gate=all(tot[c][0]<tot[r][0] and tot[c][1]<tot[r][1] and w>=3 for r,w in wins.items())
    assert gate==s["joint_gate"] and wins==s["candidate_group_wins"]
    for w in s["candidate_worst_details"].values():
        k=w["k"];span=w["scale_ms"];l=span.bit_length()-2;power,i,h=peak[k][l]
        assert i==w["largest_observed_haar"][0]
        cmp(h,w["largest_observed_haar"][1],"worst_haar")
        for x,y in zip(raw[k][i:i+span],w["raw_segment_Pa"]):cmp(x,y,"worst_raw")
        for r in roles:cmp(f["predictions"][k][r][l],w["values_same_endpoint"][r],"worst_aligned_forecast")
    print(json.dumps({"all_samples":sum(p["n"].values()),"all_roles":roles,"cells":len(te)*6*len(roles),
        "forecast_sha256":lock["sha256"],"gate":gate,"wins":wins,"checks":census,"maximum_relative_error":{k:str(v) for k,v in maximum.items()}},sort_keys=True))
