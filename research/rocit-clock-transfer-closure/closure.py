"""Reconstruct two clock-network contrasts from the authors' campaign tables."""
import argparse
import hashlib
import itertools
import json
import re
import tarfile
from decimal import Decimal as D, localcontext
from fractions import Fraction as F
from pathlib import Path
from math import isqrt

SOURCE_SHA = "d7ec142523b8a443fe52d1ad084883c5291d8a46e869d1a429137b242cde1e0b"
PAIRS = [(6,16),(9,23),(10,28),(11,29),(12,38)]
IDS = [i for p in PAIRS for i in p]
CYCLES = [[1,-1,0,1,0],[0,0,1,-1,1]]
DIFFERENCE = [[int(i==2*j+1)-int(i==2*j) for i in range(10)] for j in range(5)]
THRESHOLDS = {"route_equality":D("11.070497693516351"),"constant_endpoint_offsets":D("5.991464547107982")}

def mul(a,b):
    return [[sum(i*j for i,j in zip(row,col)) for col in zip(*b)] for row in a]

def project(t,s):
    return mul(mul(t,s),list(zip(*t)))

def decimal(q):
    return D(q.numerator)/D(q.denominator)

def load_tables(archive, outcomes):
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==SOURCE_SHA
    with tarfile.open(archive) as t:
        s=t.extractfile("ARXIV.tex").read().decode()
    block=s.split(r"\label{Tab:FrequencyRatios}",1)[1].split(r"\end{table",1)[0]
    rows={}
    for line in block.splitlines():
        cells=[v.strip() for v in line.split("&")]
        if len(cells)!=6 or not cells[0].isdigit():continue
        i=int(cells[0])
        mant,exp=re.fullmatch(r"\$([\d.]+)\s*\\times 10\^\{(-?\d+)\}\$",cells[2]).groups()
        unit=F(10)**(18+int(exp))
        rows[i]={"technique":cells[3],"endpoints":tuple(c.rstrip("\\").strip() for c in cells[4:]),
                 "sigma":F(mant)*unit,"sigma_rounding":F(10)**D(mant).as_tuple().exponent*unit/2}
        if outcomes and i in IDS:
            token=cells[1].replace("~","").strip()
            digits,parenthetical=re.fullmatch(r"(\d+\.\d+)\((\d+)\)",token).groups()
            rows[i].update(ratio=digits,reported_parenthetical=parenthetical)
    assert list(rows)==list(range(1,39))
    parallel=[(i,j) for i in rows for j in rows if rows[i]["technique"]=="Fiber" and
              rows[j]["technique"]=="GNSS" and rows[i]["endpoints"]==rows[j]["endpoints"]]
    assert parallel==PAIRS
    c=s.split(r"\label{Tab:FibreCorr}",1)[1].split(r"\end{longtable}",1)[0]
    corr={(int(i),int(j)):F(v) for i,j,v in re.findall(r'r\(\\text\{(\d+),(\d+)\}\)\$\s*&\s*([-]?\d\.\d{3})',c)}
    assert len(corr)==242 and not any(i<=12<j for i,j in corr)
    return rows,corr

def covariances(rows,corr):
    size=len(IDS)
    nom=[[F(0)]*size for _ in IDS]
    err=[[F(0)]*size for _ in IDS]
    for i,j in itertools.combinations_with_replacement(range(size),2):
        a,b=IDS[i],IDS[j]
        sa,sb=rows[a]["sigma"],rows[b]["sigma"]
        ua,ub=rows[a]["sigma_rounding"],rows[b]["sigma_rounding"]
        key=tuple(sorted((a,b)))
        rho=F(1) if i==j else corr.get(key,F(0))
        rho_err=F(0) if i==j else F(1,100) if key[0]<=12<key[1] else F(1,2000)
        mid=rho*sa*sb
        values=[(sa+x*ua)*(sb+y*ub)*(rho+z*rho_err) for x,y,z in itertools.product((-1,1),repeat=3)]
        nom[i][j]=nom[j][i]=mid
        err[i][j]=err[j][i]=max(abs(v-mid) for v in values)
    return nom,err

def ldlt(v):
    n=len(v)
    l=[[F(i==j) for j in range(n)] for i in range(n)]
    p=[]
    for i in range(n):
        for j in range(i):
            l[i][j]=(v[i][j]-sum(l[i][k]*l[j][k]*p[k] for k in range(j)))/p[j]
        p.append(v[i][i]-sum(l[i][k]**2*p[k] for k in range(i)))
    assert all(x>0 for x in p)
    inv=[[F(i==j) for j in range(n)] for i in range(n)]
    for i in range(n):
        for j in range(i):
            inv[i][j]=-sum(l[i][k]*inv[k][j] for k in range(j,i))
    assert project(inv,v)==[[p[i] if i==j else 0 for j in range(n)] for i in range(n)]
    return inv,p

def robust(t,nom,err):
    v=project(t,nom)
    inv,p=ldlt(v)
    a=mul(inv,t)
    # Account once for each uncertain symmetric input covariance entry.
    e=[[sum(abs(x*y)*err[i][i] for i,(x,y) in enumerate(zip(r,s)))+
        sum(abs(r[i]*s[j]+r[j]*s[i])*err[i][j] for i,j in itertools.combinations(range(len(IDS)),2))
        for s in a] for r in a]
    return a,p,relative_bound(e,p),v

def relative_bound(e,p):
    m=[[x/p[i] for x in row] for i,row in enumerate(e)]
    # Any strictly positive weight gives a certificate. Select one from covariance alone.
    u=[D(1)]*len(p)
    for _ in range(60):
        u=[sum(decimal(c)*x for c,x in zip(row,u)) for row in m]
        u=[x/max(u) for x in u]
    weights=[F(x.quantize(D("1e-22"))) for x in u]
    assert min(weights)>0
    bound=max(sum(c*x for c,x in zip(row,weights))/wi for row,wi in zip(m,weights))
    return bound

def structured(a,p,nom,rows,corr):
    sigma=[rows[i]["sigma"] for i in IDS]
    delta=[rows[i]["sigma_rounding"] for i in IDS]
    high=[x+d for x,d in zip(sigma,delta)]
    n=len(IDS)
    R=[[nom[i][j]/(sigma[i]*sigma[j]) for j in range(n)] for i in range(n)]
    # This principal published correlation block must actually be positive definite.
    ldlt(R)
    dr=[[F(0) if i==j else F(1,100) if (IDS[i]<=12)!=(IDS[j]<=12) else F(1,2000)
         for j in range(n)] for i in range(n)]
    ab=[[abs(x) for x in row] for row in a]
    def envelope(amp,matrix):
        terms=[[amp[i]*abs(matrix[i][j])*amp[j] for j in range(n)] for i in range(n)]
        return relative_bound(project(ab,terms),p)
    gamma2=envelope(delta,R)
    beta=envelope(high,dr)
    # Exact rational upper bound on the positive square root after scale.
    scale=10**22
    g=F(1+isqrt(gamma2.numerator*scale*scale//gamma2.denominator),scale)
    assert g*g>=gamma2
    return max(F(0),1-g)**2-beta,(1+g)**2+beta,g,beta

def detail(t,nom,err,rows,corr,read,reference):
    a,p,rho,v=robust(t,nom,err)
    out={"df":len(t),"critical":str(reference),"nominal_covariance":[[str(decimal(x)) for x in row] for row in v],
         "positive_nominal_ldl_pivots":[str(decimal(x)) for x in p],
         "relative_covariance_box_bound":str(decimal(rho)),"box_certifies_positive_definite":rho<1}
    lo,hi,g,beta=structured(a,p,nom,rows,corr)
    lo=max(lo,1-rho);hi=min(hi,1+rho)
    out.update(structured_sigma_operator_bound=str(decimal(g)),structured_correlation_perturbation=str(decimal(beta)),
               lower_covariance_factor=str(decimal(lo)),upper_covariance_factor=str(decimal(hi)),
               certifies_positive_definite=lo>0)
    if not read:return out
    y=[];e=[]
    for i in IDS:
        r=D(rows[i]["ratio"]);h=D(5).scaleb(r.as_tuple().exponent-1)
        y.append(r.ln()*D(10)**18)
        e.append(-(1-h/r).ln()*D(10)**18)
    b=[sum(decimal(q)*x for q,x in zip(row,y)) for row in a]
    c=[sum(decimal(abs(q))*x for q,x in zip(row,e)) for row in a]
    norm=sum(x*x/decimal(d) for x,d in zip(b,p)).sqrt()
    eps=sum(x*x/decimal(d) for x,d in zip(c,p)).sqrt()
    lower=max(D(0),norm-eps)**2/decimal(hi)
    upper=(norm+eps)**2/decimal(lo) if lo>0 else None
    out.update(nominal_q=str(norm**2),quantization_whitened_norm_bound=str(eps),
               q_lower=str(lower),q_upper=None if upper is None else str(upper),
               threshold_status=("uncertified_rank" if lo<=0 else "above" if lower>reference else "below" if upper<reference else "straddles"),
               coordinates=[])
    for j,row in enumerate(t):
        val=sum(decimal(F(c))*x for c,x in zip(row,y))
        out["coordinates"].append({"signed_value_e_minus18":str(val),"sigma_e_minus18":str(decimal(v[j][j]).sqrt()),
                                   "signed_standardized":str(val/decimal(v[j][j]).sqrt())})
    return out

def run(archive,outcomes=False):
    with localcontext() as ctx:
        ctx.prec=85
        rows,corr=load_tables(archive,outcomes)
        nom,err=covariances(rows,corr)
        combined=mul(CYCLES,DIFFERENCE)
        tests={"route_equality":DIFFERENCE,"constant_endpoint_offsets":combined}
        result={"mode":"measured" if outcomes else "uncertainty_design_only","source_sha256":SOURCE_SHA,
                "rows":IDS,"rounding":"nearest printed last digit; cross-technique correlations bounded by 0.01",
                "tests":{k:detail(t,nom,err,rows,corr,outcomes,THRESHOLDS[k]) for k,t in tests.items()}}
        if outcomes:
            result["reported"]={str(i):{k:str(v) for k,v in rows[i].items()} for i in IDS}
        return result

if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("archive",type=Path);ap.add_argument("--read-ten-measurements",action="store_true")
    args=ap.parse_args();print(json.dumps(run(args.archive,args.read_ten_measurements),indent=2))
