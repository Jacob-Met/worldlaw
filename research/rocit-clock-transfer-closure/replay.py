"""Verify the ten campaign cells, all published correlations, and both joint statistics."""
import argparse
import hashlib
import json
import re
import subprocess
import urllib.request
from decimal import Decimal, localcontext
from pathlib import Path

import closure

HERE = Path(__file__).resolve().parent
FILES = {
    "author-source.tar.gz": ("https://arxiv.org/src/2505.06763v1", closure.SOURCE_SHA),
    "paper.pdf": ("https://iris.polito.it/retrieve/f1c44dd2-8845-4c23-a4ab-f3d315314b4e/optica-12-6-843.pdf",
                  "566658779f8537b106b9a301ffc40f3e964a4c9746d3096ef6917624cbdc1f0f"),
    "supplement.pdf": (None, "1f3dafee39a3cff247db496d15834a21a1e3267c862ca3f613614b5fe02bb706"),
}

def read_url(url):
    req=urllib.request.Request(url,headers={"User-Agent":"WORLDLAW-research/1.0"})
    with urllib.request.urlopen(req,timeout=90) as f:return f.read()

def sources(directory):
    directory.mkdir(parents=True,exist_ok=True)
    for filename,(url,digest) in FILES.items():
        path=directory/filename
        if not path.exists():
            if url is None:
                meta=json.loads(read_url("https://api.figshare.com/v2/articles/29041466/versions/3"))
                assert meta["doi"]=="10.6084/m9.figshare.29041466.v3" and len(meta["files"])==1
                url=meta["files"][0]["download_url"]
            data=read_url(url)
            assert hashlib.sha256(data).hexdigest()==digest
            path.write_bytes(data)
        assert hashlib.sha256(path.read_bytes()).hexdigest()==digest

def extract_pdf(directory):
    def layout(name):
        return subprocess.check_output(["pdftotext","-layout",str(directory/name),"-"]).decode().replace("−","-")
    table=layout("paper.pdf").split("Table 2. Summary of the Frequency Ratios",1)[1]
    rows={}
    for line in table.splitlines():
        index=re.match(r"^\s*(\d+)\s+",line)
        if not index or int(index[1]) not in closure.IDS:continue
        match=re.match(r"^\s*(\d+)\s+(\d+\.(?:[\d ]*\d))\((\d+)\)\s+([\d.]+)\s+×\s+10(-\d+)\s+(Fiber|GNSS)\s+(.+?)\s{2,}(.+?)\s*$",line)
        if match is None:continue
        i,ratio,parent,std,exp,method,a,b=match.groups()
        assert int(i) not in rows
        rows[int(i)]=(ratio.replace(" ",""),parent,Decimal(std).scaleb(18+int(exp)),method,a,b)
    assert set(rows)==set(closure.IDS)
    section=layout("supplement.pdf").split("Table S3. Correlation coefficients",1)[1]
    entries=re.findall(r"r\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*=\s*(-?\d\.\d{3})",section)
    rho={(int(i),int(j)):Decimal(x) for i,j,x in entries}
    assert len(entries)==len(rho)==242
    return rows,rho

def dot(a,b):
    return sum(x*y for x,y in zip(a,b))

def solve(a,b):
    aug=[list(map(Decimal,row))+[Decimal(z)] for row,z in zip(a,b)]
    for p in range(len(b)):
        q=max(range(p,len(b)),key=lambda i:abs(aug[i][p]))
        aug[q],aug[p]=aug[p],aug[q]
        inv=1/aug[p][p];aug[p]=[x*inv for x in aug[p]]
        for i in range(len(b)):
            if i!=p:
                w=aug[i][p];aug[i]=[x-w*y for x,y in zip(aug[i],aug[p])]
    return [r[-1] for r in aug]

def verify(directory):
    sources(directory)
    original=json.loads((HERE/"measured.json").read_text())
    reported=closure.run(directory/"author-source.tar.gz",True)
    assert original==reported
    data,corr=extract_pdf(directory)
    tex,texcorr=closure.load_tables(directory/"author-source.tar.gz",True)
    assert {k:closure.F(v) for k,v in corr.items()}==texcorr
    for i,(ratio,paren,std,method,a,b) in data.items():
        row=tex[i]
        canon=lambda name:name.replace("$","").replace("^","").replace(" ","")
        assert (ratio,paren,closure.F(std),method)==(row["ratio"],row["reported_parenthetical"],row["sigma"],row["technique"])
        assert (canon(a),canon(b))==tuple(canon(x) for x in row["endpoints"])
    # Independent path: apply the ten printed cells as direct log-ratios and compute
    # each of the 25 physical edge covariances from four signed covariance terms.
    pairs=[(6,16),(9,23),(10,28),(11,29),(12,38)]
    sub=[(Decimal(data[g][0])/Decimal(data[f][0])).ln()*Decimal(10)**18 for f,g in pairs]
    def cov(i,j):
        coef=Decimal(1) if i==j else corr.get(tuple(sorted((i,j))),Decimal(0))
        return data[i][2]*data[j][2]*coef
    v=[[cov(g,h)+cov(f,k)-cov(g,k)-cov(f,h) for k,h in pairs] for f,g in pairs]
    cycles=[(1,-1,0,1,0),(0,0,1,-1,1)]
    cs=[dot(row,sub) for row in cycles]
    cv=[[sum(a*b*v[i][j] for i,a in enumerate(r) for j,b in enumerate(s))
         for s in cycles] for r in cycles]
    output={}
    for name,y,s in (("route_equality",sub,v),("constant_endpoint_offsets",cs,cv)):
        ref=original["tests"][name];q=dot(y,solve(s,y))
        assert abs(q-Decimal(ref["nominal_q"]))<Decimal("1e-55")
        assert dot([-x for x in y],solve(s,[-x for x in y]))==q
        for j,(x,row) in enumerate(zip(y,ref["coordinates"])):
            assert abs(x-Decimal(row["signed_value_e_minus18"]))<Decimal("1e-55")
            assert abs(s[j][j].sqrt()-Decimal(row["sigma_e_minus18"]))<Decimal("1e-55")
        assert all(abs(s[i][j]-Decimal(ref["nominal_covariance"][i][j]))<Decimal("1e-55")
                   for i in range(len(y)) for j in range(len(y)))
        output[name]=str(q)
    # Independent endpoint assignment and topology fault. A change confined to B-D
    # appears with opposite signs in the two cycles. Reversing all ratios negates both.
    va,vb,vc,vd=map(Decimal,(13,71,-29,100))
    gradient=[va-vb,va-vd,vb-vc,vb-vd,vc-vd]
    assert [dot(c,gradient) for c in cycles]==[0,0]
    gradient[3]+=7
    assert [dot(c,gradient) for c in cycles]==[7,-7]
    assert [dot(c,[-x for x in gradient]) for c in cycles]==[-7,7]
    print(json.dumps({"pdf_measurements":len(data),"pdf_correlations":len(corr),"independent_joint_Q":output,
                      "thresholds":{k:v["threshold_status"] for k,v in original["tests"].items()},
                      "fault_cycle_shifts":[7,-7]},indent=2))

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("source_cache",type=Path)
    with localcontext() as ctx:
        ctx.prec=85
        verify(parser.parse_args().source_cache)
