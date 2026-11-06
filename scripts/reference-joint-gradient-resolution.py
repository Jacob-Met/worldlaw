import sys, json, math, hashlib, struct, decimal, platform
from decimal import Decimal as D, getcontext
raw=sys.stdin.read()
data=json.loads(raw)
def dec(x):
    if isinstance(x,float): return D.from_float(x)
    if isinstance(x,int): return D(x)
    raise TypeError(type(x).__name__)
def sincos(x):
    st=x; ct=D(1); s=st; c=ct; z=-x*x
    stop=D(10)**(-(getcontext().prec+8))
    for n in range(1,401):
        st*=z/D((2*n)*(2*n+1));ct*=z/D((2*n-1)*(2*n))
        s+=st;c+=ct
        if abs(st)<stop and abs(ct)<stop:return s,c
    raise AssertionError("bounded trigonometric series did not finish")
def reference(c,k,A,v,t):
    h=c/2;w2=-k-h*h
    assert w2>0
    w=w2.sqrt();B=(v-h*A)/w
    S,C=sincos(w*t);E=(h*t).exp();F=A*C+B*S;T=-A*S+B*C;G=h*F+w*T
    out=[E*F,E*G]
    for hp,wp in [(D(1)/2,-c/(4*w)),(D(0),-D(1)/(2*w))]:
        Bp=-(A*hp+B*wp)/w
        Fp=Bp*S+t*wp*T;Tp=Bp*C-t*wp*F
        out.extend([E*(t*hp*F+Fp),E*(t*hp*G+hp*F+h*Fp+wp*T+w*Tp)])
    return out
def taylor(c,k,A,v,t):
    q=[A,v];sc=[D(0),D(0)];sk=[D(0),D(0)]
    for n in range(179):
        den=D((n+2)*(n+1))
        q.append((c*(n+1)*q[n+1]+k*q[n])/den)
        sc.append(((n+1)*q[n+1]+c*(n+1)*sc[n+1]+k*sc[n])/den)
        sk.append((q[n]+c*(n+1)*sk[n+1]+k*sk[n])/den)
    def evaluate(a):
        f=D(0);g=D(0)
        for coeff in reversed(a):g=g*t+f;f=f*t+coeff
        return [f,g]
    return evaluate(q)+evaluate(sc)+evaluate(sk)
def norm(a):return sum((x*x for x in a),D(0)).sqrt()
def dot(a,b):return sum((x*y for x,y in zip(a,b)),D(0))
def strn(v,n=70):return format(v,"."+str(n)+"g")
fixture=data["fixture"]
def vector(values):
    c,k=map(dec,values);res=[];cols=[[],[]]
    ps=dec(fixture["options"]["channelScales"]["positionRad"])
    rs=dec(fixture["options"]["channelScales"]["rateRadPerSecond"])
    for run in fixture["runs"]:
        A=dec(run["samples"][0]["position"]);v=dec(run["initialRate"])
        t0=dec(run["samples"][0]["time"])
        for row in run["samples"]:
            q,r,qc,rc,qk,rk=reference(c,k,A,v,dec(row["time"])-t0)
            res.extend([(q-dec(row["position"]))/ps,(r-dec(row["rate"]))/rs])
            cols[0].extend([qc/ps,rc/rs]);cols[1].extend([qk/ps,rk/rs])
    assert len(res)==756 and all(x.is_finite() for x in res)
    return {"residuals":res,"columns":cols,"rms":norm(res)/D(len(res)).sqrt(),"gradients":[dot(col,res) for col in cols]}
def stencil(center,plus,other,g):
    da=dec(g["da"]);db=dec(g["db"]);weight=dec(g["weight"])
    if g["symmetric"]:return [(a-b)/(da-db) for a,b in zip(plus,other)]
    result=[]
    for z,a,b in zip(center,plus,other):
        first=(a-z)/da;second=(b-z)/db
        result.append(first+weight*(second-first))
    return result
def at_precision(precision):
    getcontext().prec=precision
    rows=[];controlmax=D(0);controlcount=0
    states=[[-.2,-4]]+[s["values"] for s in data["snapshots"]]
    for values in states:
        c,k=map(dec,values)
        for run in fixture["runs"]:
            A=dec(run["samples"][0]["position"]);v=dec(run["initialRate"])
            for t in map(dec,[0,.04,1,5]):
                a=reference(c,k,A,v,t);b=taylor(c,k,A,v,t)
                controlmax=max(controlmax,*(abs(x-y) for x,y in zip(a,b)));controlcount+=1
                if t==0:
                    assert a[0]==A
                    assert abs(a[1]-v)<D("1e-65")
                    assert max(abs(x) for x in a[2:])<D("1e-65")
    assert controlmax<D("1e-65")
    for s in data["snapshots"]:
        center=vector(s["values"])
        nodes=[vector(p["values"]) for p in s["probes"]]
        sc=[stencil(center["residuals"],nodes[2*j]["residuals"],nodes[2*j+1]["residuals"],s["geometry"][j]) for j in range(2)]
        rows.append({"name":s["name"],"values":s["values"],**center,"stencilColumns":sc,"stencilGradients":[dot(c,center["residuals"]) for c in sc]})
    best=rows[1]["rms"]
    proposals=[]
    for p in data["lastProposals"]:
        r=vector(p["values"])
        delta=r["rms"]-best
        proposals.append({"index":p["index"],"values":p["values"],"rms":r["rms"],"rmsMinusBest":delta,"ordering":"lower" if delta<0 else "higher" if delta>0 else "equal"})
    return {"precision":precision,"snapshots":rows,"lastProposals":proposals,"controls":{"cases":controlcount,"maximumClosedFormVsTaylorDifference":controlmax,"taylorTerms":181}}
lo=at_precision(80);hi=at_precision(120)
getcontext().prec=140
differences=[]
for a,b in zip(lo["snapshots"],hi["snapshots"]):
    differences.extend(abs(x-y) for x,y in zip(a["residuals"],b["residuals"]))
    for key in ["columns","stencilColumns"]:
        for ca,cb in zip(a[key],b[key]):differences.extend(abs(x-y) for x,y in zip(ca,cb))
    differences.extend(abs(a[key]-b[key]) for key in ["rms"])
    for key in ["gradients","stencilGradients"]:differences.extend(abs(x-y) for x,y in zip(a[key],b[key]))
for a,b in zip(lo["lastProposals"],hi["lastProposals"]):
    differences.extend([abs(a["rms"]-b["rms"]),abs(a["rmsMinusBest"]-b["rmsMinusBest"])])
    assert a["ordering"]==b["ordering"]
maxdiff=max(differences)
assert maxdiff<D("1e-65")
assert data["lastProposals"][0]["values"]==data["lastProposals"][1]["values"]
assert hi["lastProposals"][0]["rms"]==hi["lastProposals"][1]["rms"]
def pack_snapshot(r):
    return {
      "name":r["name"],"values":r["values"],
      "rms":strn(r["rms"]),
      "gradients":[strn(x) for x in r["gradients"]],
      "stencilGradients":[strn(x) for x in r["stencilGradients"]],
      "residuals":[strn(x,40) for x in r["residuals"]],
      "columns":[[strn(x,40) for x in col] for col in r["columns"]],
      "stencilColumns":[[strn(x,40) for x in col] for col in r["stencilColumns"]]
    }
def proposal_rows(r):
    return [{**p,"rms":strn(p["rms"]),"rmsMinusBest":strn(p["rmsMinusBest"])} for p in r["lastProposals"]]
numeric=[]
for r in fixture["runs"]:
    numeric.append(r["initialRate"])
    for row in r["samples"]:numeric.extend([row["time"],row["position"],row["rate"]])
numeric_digest=hashlib.sha256(b"".join(struct.pack(">d",float(x)) for x in numeric)).hexdigest()
out={
"experiment":"closed-form-joint-sensitivity-reference",
"python":platform.python_version(),"decimalVersion":decimal.__version__,
"inputSHA256":hashlib.sha256(raw.encode()).hexdigest(),
"binary64OriginalNumericSHA256":numeric_digest,
"arithmetic":"Decimal.from_float of the unchanged binary64 input; 80 and120 decimal digits; closed-form analytic sensitivities, not numerical finite differences",
"workingPrecisions":[80,120],"maximumPrecisionDifference":strn(maxdiff),
"controls":[{**r["controls"],"precision":r["precision"],"maximumClosedFormVsTaylorDifference":strn(r["controls"]["maximumClosedFormVsTaylorDifference"])} for r in [lo,hi]],
"snapshots":[pack_snapshot(r) for r in hi["snapshots"]],
"lastProposals80":proposal_rows(lo),"lastProposals120":proposal_rows(hi),
"duplicateProposal40And41Retained":True,
"limits":"Authored underdamped continuous system with fixed original binary64 observations and starts. Precision convergence plus independent181-term ODE Taylor controls; not interval-certified error bounds, physical evidence, optimization or universal stencil validity."
}
print(json.dumps(out,separators=(",",":")))
