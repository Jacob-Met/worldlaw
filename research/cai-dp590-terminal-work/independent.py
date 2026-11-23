"""Cold recount from the two pinned Origin files and the immutable strain-only bank."""
import argparse
import hashlib
import json
import math
import pathlib
import struct
import urllib.request
from fractions import Fraction

ARCHIVES = {
    "biaxial": ("tbdsbrnkj9", "55f314d4eea13adbd8fb2235ec925bebf197ac1e5f677fa7d58e7046f7925a61"),
    "uniaxial": ("62nyx7gdd3", "810e9befa9ce366b8d51005a86f9c53a16361e10116c32d5127bc06092312901"),
}
BOOKS = {"1:4":2,"2:4":3,"3:4":4,"4:4":9,"4:3":8,"4:2":7,"4:1":6}
BASELINES=("axis_blend","hill48","hosford6","mises_terminal_strain","yld2000_m4","yld2000_m6","yld2000_m8","yld6_midarea")
BANK_SHA="7c5d6afc99905d3f50749917507b9e0fd6659740b2edee8b3a277a05e1dc1acd"
SCORE_SHA="4beb7ce859aa181d28be419af39a4f19571aa667cd7509b42be8f70141ba616a"

def digest(data):
    return hashlib.sha256(data).hexdigest()

def download(url):
    req=urllib.request.Request(url,headers={"User-Agent":"WORLDLAW DP590 independent reader"})
    with urllib.request.urlopen(req,timeout=60) as rsp:
        return rsp.read()

def original(kind,root):
    slug,sha=ARCHIVES[kind]
    path=root/(kind+".opj")
    if path.exists():
        raw=path.read_bytes()
    else:
        listed=json.loads(download("https://data.mendeley.com/public-api/datasets/"+slug+"/files?folder_id=root&version=1"))
        assert len(listed)==1 and listed[0]["content_details"]["sha256_hash"]==sha
        raw=download(listed[0]["content_details"]["download_url"])
    assert digest(raw)==sha
    return raw

def column(raw,book,col):
    # Locate data by its unique validated header and record boundaries independently
    # of the sequential Origin record index in the producer.
    tag=f"Book{book}_{col}".encode()+b"\0"
    start=0
    found=[]
    while True:
        pos=raw.find(tag,start)
        if pos<0:break
        start=pos+1
        header=pos-88
        if header<5 or raw[header-1]!=10:continue
        hlen=struct.unpack_from("<I",raw,header-5)[0]
        if not 115<=hlen<=4096 or raw[header+61]!=10:continue
        end=header+hlen
        if raw[end]!=10 or raw[end+5]!=10:continue
        block=struct.unpack_from("<I",raw,end+1)[0]
        if block%10 or block<10000 or end+6+block>=len(raw):continue
        assert raw[end+6+block]==10
        binary=memoryview(raw)[end+6:end+6+block]
        values=[]
        for row,(typ,_,value) in enumerate(struct.iter_unpack("<BBd",binary)):
            if typ==1 or value==-1.23456789e-300 or not math.isfinite(value):continue
            assert row==len(values)
            values.append(value)
        found.append(values)
    assert len(found)==1,(book,col,len(found))
    return found[0]

def minimum(ref,ext):
    # First-excursion piecewise integral, exact through every clipped reference interval.
    cap=Fraction.from_float(float(ext))
    if cap<=0:return 0.
    last=Fraction(0);amount=Fraction(0)
    for (p0,s0),(p1,s1) in zip(ref,ref[1:]):
        if p1<=last:continue
        assert p0<=last<p1
        if cap<=last:break
        nxt=min(cap,p1)
        avg=s0+(s1-s0)*(last+nxt-2*p0)/(2*(p1-p0))
        amount+=avg*(nxt-last)
        last=nxt
        if last==cap:return float(amount)
    raise ValueError("Reference strain not covered")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("directory",type=pathlib.Path)
    ap.add_argument("--archives",type=pathlib.Path,default=pathlib.Path("."))
    a=ap.parse_args()
    raw=original("biaxial",a.archives)
    uni=original("uniaxial",a.archives)
    b=(a.directory/"forecast.json").read_bytes()
    s=(a.directory/"score.json").read_bytes()
    assert digest(b)==BANK_SHA and digest(s)==SCORE_SHA
    bank=json.loads(b);score=json.loads(s)["score"]
    references={k:list(zip(*(list(map(Fraction.from_float,column(uni,book,col))) for col in "AB"))) for k,book in ((0,2),(45,3),(90,4))}
    raw_count=0;steps=0;residuals={};agreement=[];detail={}
    def same(x,y):
        difference=abs(float(x)-float(y))
        agreement.append(difference)
        assert difference<3e-10,(x,y)
    for label,book in BOOKS.items():
        x,sx,y,sy=[column(raw,book,k) for k in "ABCD"]
        ref=bank["predictions"][label];obs=score["observed"][label]
        n=len(x)
        assert n==len(y)==len(sx)==len(sy)==ref["n"]
        assert [x[0],sx[0],y[0],sy[0]]==obs["first"] and [x[-1],sx[-1],y[-1],sy[-1]]==obs["last"]
        assert [x[0],y[0]]==ref["strain_first"] and [x[-1],y[-1]]==ref["strain_last"]
        exact=[];native_sums=[]
        for e,t in ((x,sx),(y,sy)):
            ef=list(map(Fraction.from_float,e));tf=list(map(Fraction.from_float,t))
            terms=[(q-p)*(r+s)/2 for p,q,r,s in zip(ef,ef[1:],tf,tf[1:])]
            exact.append(sum(terms))
            sums=[0.]
            for j in range(1,n):
                sums.append(sums[-1]+.5*(t[j]+t[j-1])*(e[j]-e[j-1]))
            native_sums.append(sums)
        for l,value in enumerate(exact):
            same(value,obs["observed_component_work"][l])
            inc=math.fsum(min(0.,q-p) for p,q in zip(native_sums[l],native_sums[l][1:]))
            same(inc,obs["component_negative_increments"][l])
        totals=[p+q for p,q in zip(*native_sums)]
        assert sum(q<p for p,q in zip(totals,totals[1:]))==obs["nonmonotone_stored_total_steps"]
        same(min(totals),obs["stored_total_work_range"][0]);same(max(totals),obs["stored_total_work_range"][1])
        w=float(sum(exact));same(w,obs["work"])
        lo=[minimum(references[k],v) for k,v in ((0,x[-1]-x[0]),(90,y[-1]-y[0]),(45,(x[-1]-x[0]+y[-1]-y[0])/2))]
        for got,want in zip(lo,ref["uniaxial_lower_by_0_90_45"]):same(got,want)
        lower=max(lo);same(lower,obs["euler_lower_work"])
        assert (w>=lower)==obs["raw_lower_satisfied"]
        assert (w>=(1-bank["compatibility"]["maximum_fractional_shortfall"])*lower)==obs["training_slack_lower_satisfied"]
        p=ref["predicted_work"]
        assert (p["hull_lower"]<=w<=p["tangent_upper"])==obs["conditional_true_ray_bracket_contains"]
        for arm,value in p.items():
            err=math.log(value/w)
            same(err,score["signed_log_residuals"][label][arm])
            residuals.setdefault(arm,[]).append(err)
        detail[label]={"rows":n,"work":w,"components":[float(h) for h in exact],
                       "minimum_by_direction":lo,"candidate":p["support_geomean"],
                       "hill48":p["hill48"],"bracket":[p["hull_lower"],p["tangent_upper"]]}
        raw_count+=n;steps+=2*(n-1)
    metrics={arm:{"mean_abs_log":math.fsum(map(abs,v))/len(v),"worst_abs_log":max(map(abs,v))}
             for arm,v in residuals.items()}
    for arm,row in metrics.items():
        for key,value in row.items():same(value,score["whole_program_scores"][arm][key])
    gates={arm+"/"+k:metrics["support_geomean"][k]<metrics[arm][k] for arm in BASELINES for k in metrics[arm]}
    assert gates==score["gates"] and all(gates.values())==score["joint"]
    print("INDEPENDENT",json.dumps({"source_hashes":{k:v[1] for k,v in ARCHIVES.items()},
       "bank_sha256":BANK_SHA,"score_sha256":SCORE_SHA,"raw_mixed_rows":raw_count,
       "exact_dyadic_component_increments":steps,"checks":len(agreement),"maximum_numeric_difference":max(agreement),
       "unrounded_residuals":sum(map(len,residuals.values())),"gates":gates,"programs":detail},sort_keys=True))

if __name__=="__main__":main()
