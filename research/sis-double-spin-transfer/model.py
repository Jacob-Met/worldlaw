"""Fit the one-spin calibration operators and forecast doubly substituted SiS features."""
from collections import defaultdict
import math
from pathlib import Path
import subprocess
import tempfile
import numpy as np
from recoupling import projection,recouple
from source import branches,grouped_targets

ARMS=("coupled","diagonal","sulfur_only","silicon_only","flex_diagonal","flex_coupled","spcat","zero")
SLOTS=[(j,p) for j in (1,2) for p in range(abs(2*j-3)+2,2*j+4,2)]

def expansion(v,m,target):
    # Linear vibrational and reciprocal nominal partner-mass response and interaction.
    d=target/m-1.
    return np.array([1.,v,d,v*d])

def angular(j,p,twice_i):
    i=twice_i/2
    f=p/2
    a=(f*(f+1)-j*(j+1)-i*(i+1))/2
    q=0. if twice_i==1 else -(3*a*a+1.5*a-i*(i+1)*j*(j+1))/(9*(2*j-1)*(2*j+3))
    return np.array([q,a])

def design(state,is_s,flex):
    j,p,_=state
    if is_s and flex:return np.array([float((j,p)==k) for k in SLOTS])
    vector=angular(j,p,3 if is_s else 1)
    return vector if is_s else vector[1:]

def calibrate(directory):
    rows=branches(directory,"training")
    # Coalesce author-assigned blended branches and duplicate observations within
    # their laboratory isotope/v/J group. Give each observed feature one residual.
    groups=defaultdict(lambda:defaultdict(list))
    for s in rows:groups[(s.si,s.sulfur,s.v,s.j)][s.frequency].append(s)
    output={}
    for mode,is_s,flex in (("sulfur",True,False),("silicon",False,False),("flex",True,True)):
        X=[];Y=[]
        for (si,sulfur,v,j),features in groups.items():
            if (sulfur==33)!=is_s:continue
            feat=[];obs=[];unc=[]
            for y,records in features.items():
                d=np.average([design(s.upper,is_s,flex)-design(s.lower,is_s,flex) for s in records],axis=0,weights=[s.weight for s in records])
                feat.append(np.outer(d,expansion(v,si if is_s else sulfur,29 if is_s else 33)).ravel())
                obs.append(y);unc.append(max(s.sigma for s in records))
            x=np.asarray(feat);y=np.asarray(obs);u=np.asarray(unc)
            x=(x-np.average(x,axis=0,weights=u**-2))/u[:,None]
            y=(y-np.average(y,weights=u**-2))/u
            X.extend(x);Y.extend(y)
        X=np.asarray(X);Y=np.asarray(Y)
        coef,_,rank,sv=np.linalg.lstsq(X,Y,rcond=1e-12)
        if rank<X.shape[1]:raise ValueError(("Unidentified source fit",mode,rank,X.shape[1]))
        output[mode]={"coef":coef.reshape(-1,4).tolist(),"rank":int(rank),"singular_values":sv.tolist(),
                      "feature_count":len(Y),"weighted_sse":float(np.sum((X@coef-Y)**2))}
    # Source-only rotor scale for the authentic full-J calculation. Nominal integer
    # isotope masses are used consistently. The target observed band center is unavailable.
    B={}
    for v in range(4):
        vals=[]
        for (si,s,vv,j),features in groups.items():
            if j!=1 or vv!=v:continue
            mu=si*s/(si+s);target=29*33/(29+33)
            vals.append(float(np.mean(list(features)))*mu/(2*target*1000))
        B[str(v)]=float(np.median(vals))
    output["B_MHz"]=B
    output["training_observations"]=sum(map(len,groups.values()))
    return output

def strengths(fits,v):
    t=expansion(v,29,29)
    q,c=np.array(fits["sulfur"]["coef"])@t
    a=float((np.array(fits["silicon"]["coef"])@t)[0])
    flex=dict(zip(SLOTS,np.array(fits["flex"]["coef"])@t))
    return float(q),float(c),a,flex

def level(state,fits,v,arm):
    j,p,f=state
    q,c,si,flex=strengths(fits,v)
    states,_,_=projection(j,f)
    if p not in states:raise ValueError(("Coupling convention",state))
    if arm.startswith("flex"):
        s={a:float(flex.get((j,a),0.)) for a in states}
    else:s={a:float(angular(j,a,3)@np.array([q,c])) for a in states}
    if arm=="sulfur_only":return s[p]
    if arm=="zero":return 0.
    if arm=="silicon_only":return recouple(j,f,{a:0. for a in states},si,"diagonal")[p]
    method="coupled" if arm in ("coupled","flex_coupled") else "diagonal"
    return recouple(j,f,s,si,method)[p]

def calculated_catalog(fits,v,program):
    q,c,si,_=strengths(fits,v)
    b=fits["B_MHz"][str(v)]
    with tempfile.TemporaryDirectory() as d:
        root=Path(d)
        pars=[(100,b),(110010000,q/1000),(10000000,c/1000),(20000000,si/1000)]
        var="Train-only coupled SiS\n4 200 3 0 0 1e6 1 1\ns 24 1 0 0 0 1 1 1 0 0 0\n"
        (root/"held.var").write_text(var+"".join(f"{op} {val:.17g} 1e-20\n" for op,val in pars))
        (root/"held.int").write_text("Train-only\n0 61000 1 0 5 -20 -20 100 30\n001 1.0\n")
        subprocess.run([str(Path(program).resolve()),"held"],cwd=root,input=b"\n",
                       stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=30,check=True)
        cat={}
        def state(block):
            j,_,_,half,total=(int(block[i:i+2]) for i in range(0,10,2))
            return j,2*half-1,total
        for line in (root/"held.cat").read_text().splitlines():
            u=state(line[55:67]);l=state(line[67:79])
            if u[0] in (1,2) and u[0]-l[0]==1:
                key=(u,l)
                if key in cat:raise ValueError(("Duplicate catalog branch",key))
                cat[key]=float(line[:13])*1000
        return cat

def forecast(directory,fits,program):
    groups=grouped_targets(directory,"predict")
    banks={};changes=[]
    for (v,j),features in groups.items():
        catalog=calculated_catalog(fits,v,program)
        pred={arm:[] for arm in ARMS}
        for records in features:
            for arm in ARMS:
                if arm=="spcat":p=[catalog[s.upper,s.lower] for s in records]
                else:p=[level(s.upper,fits,v,arm)-level(s.lower,fits,v,arm) for s in records]
                pred[arm].append(float(np.average(p,weights=[s.weight for s in records])))
        for arm,vec in pred.items():
            avg=math.fsum(vec)/len(vec)
            pred[arm]=[val-avg for val in vec]
        changes.extend(abs(a-b) for a,b in zip(pred["coupled"],pred["diagonal"]))
        banks[f"{v}/{j}"]={"ids":[[s.index for s in group] for group in features],"centered_kHz":pred}
    return {"calibration":fits,"features":banks,"max_centered_coupling_effect_kHz":max(changes)}
