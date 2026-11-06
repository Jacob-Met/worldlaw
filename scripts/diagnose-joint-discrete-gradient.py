import sys,json,hashlib,struct,platform,decimal,math
from decimal import Decimal as D,getcontext
raw=sys.stdin.read();p=json.loads(raw)
assert hashlib.sha256(raw.encode()).hexdigest()=="3eab939ce04637ffa858521efc568d179f01b36d5b1e851cd1621bf9e098aba3"
assert p["schema"]=="worldlaw.joint-discrete-gradient-study/v1"
def dec(x):
    if isinstance(x,float):return D.from_float(x)
    if isinstance(x,int):return D(x)
    raise TypeError(type(x).__name__)
def fmt(x,n=70):return format(x,"."+str(n)+"g")
I=(D(1),D(0),D(0),D(1));ZERO=(D(0),)*4
BC=(D(0),D(0),D(0),D(1));BK=(D(0),D(0),D(1),D(0))
def add(a,b):return tuple(x+y for x,y in zip(a,b))
def scale(a,s):return tuple(x*s for x in a)
def mm(a,b):return(a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3])
def mv(a,y):return(a[0]*y[0]+a[1]*y[1],a[2]*y[0]+a[3]*y[1])
def transition(c,k,h):
    A=(D(0),D(1),k,c);Z=scale(A,h);zc=scale(BC,h);zk=scale(BK,h)
    P=I;Dc=ZERO;Dk=ZERO;R=I;Rc=ZERO;Rk=ZERO;factorial=1
    for n in range(1,5):
        DcNext=add(mm(zc,P),mm(Z,Dc));DkNext=add(mm(zk,P),mm(Z,Dk))
        P=mm(Z,P);Dc=DcNext;Dk=DkNext;factorial*=n
        R=add(R,scale(P,D(1)/factorial));Rc=add(Rc,scale(Dc,D(1)/factorial));Rk=add(Rk,scale(Dk,D(1)/factorial))
    return R,Rc,Rk
def apply_maps(maps,y,sc,sk):
    R,Rc,Rk=maps
    return mv(R,y),add(mv(R,sc),mv(Rc,y)),add(mv(R,sk),mv(Rk,y))
def stage_tangent(c,k,h,y,sc,sk):
    A=(D(0),D(1),k,c)
    def derivative(state):
        y,sc,sk=state
        return(mv(A,y),add(mv(A,sc),mv(BC,y)),add(mv(A,sk),mv(BK,y)))
    start=(y,sc,sk)
    def shifted(stage,factor):
        return tuple(add(a,scale(b,factor)) for a,b in zip(start,stage))
    a=derivative(start);b=derivative(shifted(a,h/2));cstage=derivative(shifted(b,h/2));d=derivative(shifted(cstage,h))
    return tuple(tuple(state[i]+h*(a[j][i]+2*b[j][i]+2*cstage[j][i]+d[j][i])/6 for i in range(2)) for j,state in enumerate(start))
def stage_positions(c,k,h,y):
    A=(D(0),D(1),k,c)
    a=mv(A,y);yb=add(y,scale(a,h/2));b=mv(A,yb);yc=add(y,scale(b,h/2));cs=mv(A,yc);yd=add(y,scale(cs,h))
    return(y,yb,yc,yd)
def norm(a):return sum((x*x for x in a),D(0)).sqrt()
def dot(a,b):return sum((x*y for x,y in zip(a,b)),D(0))
def stencil(z,a,b,g):
    da=dec(g["da"]);db=dec(g["db"]);weight=dec(g["weight"])
    if g["symmetric"]:return [(x-y)/(da-db) for x,y in zip(a,b)]
    out=[]
    for zero,x,y in zip(z,a,b):
        first=(x-zero)/da;second=(y-zero)/db
        out.append(first+weight*(second-first))
    return out
def digest_values(res,cols):
    text=json.dumps({"residuals":[fmt(x) for x in res],"columns":[[fmt(x) for x in c] for c in cols]},separators=(",",":"))
    return hashlib.sha256(text.encode()).hexdigest()
assert p["precisions"]==[80,120]
assert sum(g["coarseStepsPerCourse"] for g in p["grids"])==2062
for grid in p["grids"]:
    assert len(grid["intervals"])==125
    assert sum(i["steps"] for i in grid["intervals"])==grid["coarseStepsPerCourse"]
    assert all(i["steps"]>=1 and i["h"]>0 and math.isfinite(i["h"]) for i in grid["intervals"])
per=10*3*sum(g["coarseStepsPerCourse"] for g in p["grids"])+4*3*p["grids"][0]["coarseStepsPerCourse"]
assert per==66108==p["expectedPrimalTransitionsPerPrecision"]
assert 2*per<=p["primalTransitionCap"]
assert 2*3*len(p["uniqueSteps"])*2==p["preflight"]["independentControls"]<=p["controlCap"]
print(json.dumps({"phase":"admitted","python":platform.python_version(),"precisions":p["precisions"],"primalTransitionsPerPrecision":per,"totalPrimalTransitions":2*per,"independentControls":p["preflight"]["independentControls"]}),flush=True)
def calculate(precision):
    getcontext().prec=precision
    cache={};counts={"primalTransitions":0,"tangentTransitions":0,"matrixBuilds":0,"stageStatesChecked":0};maximumStage=D(0)
    bound=dec(p["stateBound"])
    def maps(c,k,h):
        key=(c,k,h)
        if key not in cache:cache[key]=transition(c,k,h);counts["matrixBuilds"]+=1
        return cache[key]
    def vector(values,grid,tangent):
        nonlocal maximumStage
        c,k=map(dec,values);assert -k-c*c/4>0
        residuals=[];columns=[[],[]];run_metrics=[]
        ps=dec(p["fixture"]["options"]["channelScales"]["positionRad"]);rs=dec(p["fixture"]["options"]["channelScales"]["rateRadPerSecond"])
        for run in p["fixture"]["runs"]:
            y=(dec(run["samples"][0]["position"]),dec(run["initialRate"]));sc=(D(0),D(0));sk=(D(0),D(0))
            position_errors=[];rate_errors=[];runmax=max(abs(x) for x in y)
            def append_row(row):
                pe=y[0]-dec(row["position"]);re=y[1]-dec(row["rate"])
                position_errors.append(pe);rate_errors.append(re);residuals.extend([pe/ps,re/rs])
                if tangent:columns[0].extend([sc[0]/ps,sc[1]/rs]);columns[1].extend([sk[0]/ps,sk[1]/rs])
            append_row(run["samples"][0])
            for interval,row in zip(grid["intervals"],run["samples"][1:]):
                h=dec(interval["h"]);m=maps(c,k,h)
                for _ in range(interval["steps"]):
                    stages=stage_positions(c,k,h,y)
                    for state in stages:
                        assert all(x.is_finite() and abs(x)<=bound for x in state)
                        runmax=max(runmax,*(abs(x) for x in state));counts["stageStatesChecked"]+=1
                    old=y;y=mv(m[0],old)
                    if tangent:
                        sc=add(mv(m[0],sc),mv(m[1],old));sk=add(mv(m[0],sk),mv(m[2],old));counts["tangentTransitions"]+=1
                    assert all(x.is_finite() and abs(x)<=bound for x in y)
                    runmax=max(runmax,*(abs(x) for x in y));counts["stageStatesChecked"]+=1
                    counts["primalTransitions"]+=1
                append_row(row)
            maximumStage=max(maximumStage,runmax)
            run_metrics.append({"id":run["id"],"coarseSteps":grid["coarseStepsPerCourse"],"maximumAbsReferenceStageState":runmax,"positionRMSE":norm(position_errors)/D(126).sqrt(),"suppliedRateRMSE":norm(rate_errors)/D(126).sqrt()})
        assert len(residuals)==756
        gradients=[dot(col,residuals) for col in columns] if tangent else []
        parts=[{"position":dot(col[::2],residuals[::2]),"rate":dot(col[1::2],residuals[1::2])} for col in columns] if tangent else []
        return{"residuals":residuals,"columns":columns,"gradients":gradients,"gradientChannels":parts,"rms":norm(residuals)/D(756).sqrt(),"runs":run_metrics}
    cases=[]
    for s in p["snapshots"]:
        for grid in p["grids"]:
            center=vector(s["values"],grid,True)
            nodes=[]
            for g in s["geometry"]:
                nodes.extend([vector(g["a"],grid,False),vector(g["b"],grid,False)])
            columns=[stencil(center["residuals"],nodes[2*j]["residuals"],nodes[2*j+1]["residuals"],s["geometry"][j]) for j in range(2)]
            stencil_grad=[dot(col,center["residuals"]) for col in columns]
            native=next(n for n in s["native"] if n["maxStep"]==grid["maxStep"])
            comparisons=[]
            for j in range(2):
                continuous=D(s["continuous"]["gradients"][j]);ng=dec(native["gradients"][j]);dg=center["gradients"][j];fg=stencil_grad[j]
                components=[ng-fg,fg-dg,dg-continuous]
                total=ng-continuous
                assert abs(sum(components,D(0))-total)<D("1e-65")
                comparisons.append({"parameter":"rate" if j==0 else "spring","native":ng,"continuous":continuous,"discreteAnalytic":dg,"discreteSameNodeStencil":fg,"nativeMinusDiscreteStencil":components[0],"discreteStencilMinusDiscreteAnalytic":components[1],"discreteMinusContinuous":components[2],"nativeMinusContinuous":total})
            cases.append({"snapshot":s["name"],"trial":s["trial"],"maxStep":grid["maxStep"],"center":center,"stencilColumns":columns,"stencilGradients":stencil_grad,"comparisons":comparisons,"probeRMS":[x["rms"] for x in nodes],"probeResiduals":[x["residuals"] for x in nodes],"nativeRMS":native["rmse"],"continuousRMS":s["continuous"]["rms"]})
    accepted=next(c["center"]["rms"] for c in cases if c["trial"]==35 and c["maxStep"]==.02)
    proposals=[]
    for proposal in p["historicalProposals"]:
        out=vector(proposal["values"],p["grids"][0],False);delta=out["rms"]-accepted
        proposals.append({"index":proposal["index"],"values":proposal["values"],"rms":out["rms"],"rmsMinusAccepted":delta,"ordering":"lower" if delta<0 else "higher" if delta>0 else "equal","runs":out["runs"]})
    assert counts["primalTransitions"]==per
    assert counts["tangentTransitions"]==2*3*2062
    control_inputs=[
      ((D(1),dec(.2)),(D(0),D(0)),(D(0),D(0))),
      ((dec(-.7),dec(-.1)),(dec(.3),dec(-.4)),(dec(-.2),dec(.5))),
      ((dec(.5),D(0)),(D(1),D(-2)),(dec(.75),dec(.25)))
    ]
    maximum_control=D(0);controls=0
    for s in p["snapshots"]:
        c,k=map(dec,s["values"])
        for hf in p["uniqueSteps"]:
            h=dec(hf);m=maps(c,k,h)
            for y,sc,sk in control_inputs:
                a=apply_maps(m,y,sc,sk);b=stage_tangent(c,k,h,y,sc,sk)
                maximum_control=max(maximum_control,*(abs(x-z) for ar,br in zip(a,b) for x,z in zip(ar,br)));controls+=1
    assert controls==p["preflight"]["independentControls"]//2
    assert maximum_control<D("1e-65")
    return{"precision":precision,"counts":counts,"maximumReferenceStageState":maximumStage,"cases":cases,"proposals":proposals,"controls":{"cases":controls,"maximumPolynomialVsStageTangentDifference":maximum_control}}
runs=[calculate(x) for x in p["precisions"]]
getcontext().prec=140
diff=[]
for a,b in zip(runs[0]["cases"],runs[1]["cases"]):
    diff.extend(abs(x-y) for x,y in zip(a["center"]["residuals"],b["center"]["residuals"]))
    for key in ["columns"]:
        for aa,bb in zip(a["center"][key],b["center"][key]):diff.extend(abs(x-y) for x,y in zip(aa,bb))
    for key in ["stencilColumns","probeResiduals"]:
        for aa,bb in zip(a[key],b[key]):diff.extend(abs(x-y) for x,y in zip(aa,bb))
    for key in ["gradients"]:
        diff.extend(abs(x-y) for x,y in zip(a["center"][key],b["center"][key]))
    diff.extend(abs(x-y) for x,y in zip(a["stencilGradients"],b["stencilGradients"]))
    diff.append(abs(a["center"]["rms"]-b["center"]["rms"]))
for a,b in zip(runs[0]["proposals"],runs[1]["proposals"]):
    diff.extend([abs(a["rms"]-b["rms"]),abs(a["rmsMinusAccepted"]-b["rmsMinusAccepted"])])
    assert a["ordering"]==b["ordering"]
maxdiff=max(diff);assert maxdiff<D("1e-65")
assert runs[1]["proposals"][0]["rms"]==runs[1]["proposals"][1]["rms"]
def pack_run_metric(r):return{**r,**{k:fmt(r[k]) for k in ["maximumAbsReferenceStageState","positionRMSE","suppliedRateRMSE"]}}
def pack_case(c):
    center=c["center"]
    return{
      "snapshot":c["snapshot"],"trial":c["trial"],"maxStep":c["maxStep"],
      "discreteRMS":fmt(center["rms"]),"nativeRMS":c["nativeRMS"],"continuousRMS":c["continuousRMS"],
      "nativeMinusDiscreteRMS":fmt(dec(c["nativeRMS"])-center["rms"]),
      "discreteMinusContinuousRMS":fmt(center["rms"]-D(c["continuousRMS"])),
      "discreteGradients":[fmt(x) for x in center["gradients"]],
      "discreteSameNodeStencilGradients":[fmt(x) for x in c["stencilGradients"]],
      "gradientChannels":[{k:fmt(v) for k,v in d.items()} for d in center["gradientChannels"]],
      "gradientDecomposition":[{k:fmt(v) if isinstance(v,D) else v for k,v in d.items()} for d in c["comparisons"]],
      "probeRMS":[fmt(x) for x in c["probeRMS"]],
      "runs":[pack_run_metric(r) for r in center["runs"]],
      "referenceResidualAndColumnsSHA256":digest_values(center["residuals"],center["columns"])
    }
def pack_proposal(p):return{**p,"rms":fmt(p["rms"]),"rmsMinusAccepted":fmt(p["rmsMinusAccepted"]),"runs":[pack_run_metric(r) for r in p["runs"]]}
receipt={
"experiment":"frozen-grid-discrete-rk4-gradient-decomposition",
"python":platform.python_version(),"decimalVersion":decimal.__version__,
"inputSHA256":hashlib.sha256(raw.encode()).hexdigest(),"gridNode":p["nativeGrid"]["node"],
"sourceCommit":p["sourceCommit"],"previousEvidenceCommit":p["previousEvidenceCommit"],
"sourcePins":p["sourcePins"],"historicalInputSHA256":p["historicalInputSHA256"],
"precisions":p["precisions"],"maximumPrecisionDifference":fmt(maxdiff),
"work":[{"precision":r["precision"],**r["counts"],"maximumAbsReferenceStageState":fmt(r["maximumReferenceStageState"]),"controlCases":r["controls"]["cases"],"maximumPolynomialVsStageTangentDifference":fmt(r["controls"]["maximumPolynomialVsStageTangentDifference"])} for r in runs],
"admission":{"primalTransitionCap":p["primalTransitionCap"],"controlCap":p["controlCap"],"stateBound":p["stateBound"],"referenceStatesFiniteAndBounded":True,"nativeScreensReexecuted":False},
"cases":[pack_case(c) for c in runs[1]["cases"]],
"proposalOrdering80":[pack_proposal(x) for x in runs[0]["proposals"]],
"proposalOrdering120":[pack_proposal(x) for x in runs[1]["proposals"]],
"previousNativeProposalOrdering":p["historicalProposals"],
"previousContinuousProposalOrdering":p["continuousProposals"],
"duplicateAttempts40And41Preserved":True,
"meaning":"Analytic parameter sensitivities of exact-real classicalRK4 on Node-reconstructed binary64 h values. Independent matrix-polynomial versus stage-tangent controls. Finite-difference stencil applied at unchanged represented nodes. This is not a derivative of the rounded IEEE program.",
"limits":"No optimizer or native receiver rerun, production change, new screen qualification, physical inference, interval certificate or stopping-policy adoption. Continuous-vs-discrete includes frozen-grid representation effects. Native-vs-high-precision-stencil combines all native evaluation/accumulation effects and is not solely subtraction cancellation. Transition counts do not equate to native screened receiver steps."
}
print(json.dumps({"phase":"complete","receipt":receipt},separators=(",",":")));
