"""Conditional second-to-fourth harmonic transfer for the Nakagawa dataset."""
import argparse
import csv
import hashlib
import io
import json
import math
import re
import zipfile
from pathlib import Path

import numpy as np

RAW = "aae5a0a58124b3aac207cfb46699481d354240f61b396cda5300a12ecaf16786"
MATERIALS = ("WTe2", "TaIrTe4")
ARMS = ("smooth_integral", "raw_integral", "unit_integral", "reversed_unit",
        "unconstrained_curvature", "published_quartic", "quartic_sextic",
        "quartic_octic", "validation_power", "constant_prefix", "quartic_plus_curvature",
        "paired_published_quartic")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def roster(arc):
    text = arc.read("data/raw/README.txt").decode("utf-8")
    members = set(arc.namelist())
    result = []
    for material, section in zip(MATERIALS, text.split("# WTe2", 1)[1].split("# TaIrTe4", 1)):
        for group in re.split(r"(?m)^% ", section)[1:]:
            match = re.search(r"^(NLS|NLMT|NLN) configuration heater([12])\s+Temp\s*=\s*\[([^]]+)\].*?filename\s*=\s*\[([^]]+)\]", group, re.S)
            if not match:
                raise ValueError("unrecognized published grouping")
            geometry, heater, temperatures, files = match.groups()
            temp = list(map(int, re.findall(r"\d+", temperatures)))
            names = re.findall(r"[A-Za-z0-9_-]+/data_\d+|[A-Za-z0-9_-]+\.csv", files)
            if len(names) != len(temp):
                raise ValueError("temperature/file count")
            for t, n in zip(temp, names):
                path = "data/raw/" + (n + ".dat" if material == "WTe2" else "TaIrTe4/" + n)
                result.append(dict(material=material, geometry=geometry, heater=int(heater), bath_K=t,
                                   path=path, present=path in members))
    present = [r for r in result if r["present"]]
    missing = [r for r in result if not r["present"]]
    if (len(result),len(set(r["path"] for r in result)),len(present),len(missing)) != (154,154,142,12):
        raise ValueError("scientific roster")
    if any("Higher_temp/" not in r["path"] for r in missing):
        raise ValueError("unexpected missing file")
    return result


def select(arc, entry, phase, cut=None):
    """Read the drive and only the admitted scientific fields in each phase."""
    w = entry["material"] == "WTe2"
    second = 12 if w else 14
    fourth = 16
    drives, u, y = [], [], []
    with arc.open(entry["path"]) as raw:
        f = io.TextIOWrapper(raw, encoding="utf-8-sig" if not w else "latin1")
        if w:
            data = (line.split() for line in f if line.strip() and not line.startswith("#"))
        else:
            data = csv.reader(line for line in f if line.strip() and not line.startswith("#"))
            header = next(data)
            if (header[0],header[second],header[fourth]) != (
                "LockinOutput (V)","SRS_Lockin3 Y (V)","SRS_Lockin4 Y (V)"):
                raise ValueError("unqualified CSV channels")
        for i,row in enumerate(data):
            drives.append(float(row[0]))
            if phase == "forecast":
                u.append(float(row[second]))
                if i < cut:
                    y.append(float(row[fourth]))
            elif phase == "score" and i >= cut:
                y.append(float(row[fourth]))
    a = np.asarray(drives)
    if len(a) < 30 or not np.isfinite(a).all() or a[0] <= 0 or not np.all(np.diff(a)>0):
        raise ValueError("drive must be a single positive increasing sweep")
    if not np.isfinite(u).all() or not np.isfinite(y).all():
        raise ValueError("nonfinite admitted voltage")
    return a,np.array(u),np.array(y)


def smooth(a, y):
    # All same-sweep second-harmonic inputs are admissible at issuance.
    values = []
    for i,x in enumerate(a):
        start = min(max(i-4,0),len(a)-9)
        sl = slice(start,start+9)
        d = (a[sl]-x)/(a[start+8]-a[start])
        values.append(np.linalg.lstsq(np.column_stack((np.ones(9),d,d*d)), y[sl], rcond=None)[0][0])
    return np.array(values)


def transform(a,u):
    # Subtracting an affine input contributes only a constant and a^{-2},
    # already represented as nuisance terms in the output equation.
    affine = np.column_stack((np.ones(len(a)),a))
    residual = u-affine@np.linalg.lstsq(affine,u,rcond=None)[0]
    # Exact integral of x times the linear interpolant on every mesh edge.
    x,y = a[:-1],a[1:]
    pieces = (y-x)*((2*x+y)*residual[:-1]+(x+2*y)*residual[1:])/6
    integral = np.r_[0.,np.cumsum(pieces)]
    return -residual+3*integral/(a*a),residual


def fit(design,y,n):
    # Normalize each nonconstant physical feature and keep the returned scale.
    center=design[:n].mean(axis=0)
    denom=design[:n].std(axis=0)
    denom[denom==0]=1
    scaled=np.column_stack((np.ones(len(design)),(design-center)/denom))
    coef,_,rank,sing=np.linalg.lstsq(scaled[:n],y[:n],rcond=1e-12)
    return scaled@coef, dict(coefficients=coef.tolist(),center=center.tolist(),scale=denom.tolist(),
                             rank=int(rank),singular_values=sing.tolist())


def project(drive,u,y):
    n=len(y)
    if n<15 or len(drive)-n<6:
        raise ValueError("source split support")
    a=(drive/drive[-1])**2
    r=(a[0]/a)**2
    raw,_=transform(a,u)
    z,residual=transform(a,smooth(a,u))
    bank={}
    info={}
    def add(name, features, offset=None):
        offset=np.zeros(len(a)) if offset is None else offset
        p,detail=fit(np.column_stack(features),y-offset[:n],n)
        bank[name]=(p[n:]+offset[n:]).tolist()
        info[name]=detail
    add("smooth_integral",[r,z]);add("raw_integral",[r,raw])
    add("unit_integral",[r],z);add("reversed_unit",[r],-z)
    add("unconstrained_curvature",[r,residual]);add("quartic_plus_curvature",[r,residual,a*a])
    add("published_quartic",[a**2]);add("quartic_sextic",[a**2,a**3])
    add("quartic_octic",[a**2,a**4])
    exps=(1.,1.5,2.,2.5,3.,3.5,4.)
    k=max(6,int(0.70*n))
    losses=[]
    for power in exps:
        p,_=fit(np.column_stack([a**power]),y,k)
        losses.append(np.mean(np.abs(p[k:n]-y[k:n])))
    picked=exps[int(np.argmin(losses))]
    add("validation_power",[a**picked])
    info["validation_power"]["power"]=picked
    bank["constant_prefix"]=[float(np.mean(y))]*(len(a)-n)
    if set(bank)!=set(ARMS)-{"paired_published_quartic"} or any(not np.isfinite(v).all() for v in bank.values()):
        raise ValueError("nonfinite or incomplete bank")
    return bank,info,dict(G_V=z[n:].tolist(),U_V=u[n:].tolist(),affine_residual_V=residual[n:].tolist())


def paired_quartic(output):
    # P3_NLS uses 200 common points in rescaled heater-current squared, then
    # fits the sum and difference at equal weights. Reconstruct the raw outputs.
    groups={}
    for c in output.values():
        e=c["entry"]
        groups.setdefault((e["geometry"],e["bath_K"]),{})[e["heater"]]=c
    for group, pair in groups.items():
        if set(pair)!={1,2}:raise ValueError(("unpaired heater",group))
        ca,cb=pair[1],pair[2]
        aa,ab=(np.asarray(c["drive"])**2 for c in (ca,cb))
        def input_slope(a,c):
            k=c["cut"]
            return np.linalg.lstsq(np.column_stack((np.ones(k),a[:k])),np.array(c["seconds_V"][:k]),rcond=None)[0][1]
        s1,s2=input_slope(aa,ca),input_slope(ab,cb)
        ratio=abs(s1/s2) if s2!=0 else 0.
        xa,xb=aa*ratio,ab
        ka,kb=ca["cut"],cb["cut"]
        lo,hi=max(xa[0],xb[0]),min(xa[ka-1],xb[kb-1])
        if not np.isfinite(ratio) or not hi>lo:
            for c in (ca,cb):
                c["forecasts_V"]["paired_published_quartic"]=c["forecasts_V"]["published_quartic"]
                c["fit"]["paired_published_quartic"]={"fallback":"no common positive-width calibration support"}
            continue
        common=np.linspace(lo,hi,200)
        ys=[np.interp(common,x[:c["cut"]],c["prefix4_V"]) for x,c in ((xa,ca),(xb,cb))]
        z=np.column_stack((np.ones(200),(common/hi)**2))
        even=np.linalg.lstsq(z,(ys[0]+ys[1])/2,rcond=None)[0]
        odd=np.linalg.lstsq(z,(ys[0]-ys[1])/2,rcond=None)[0]
        for sign,x,c in [(1,xa,ca),(-1,xb,cb)]:
            v=x[c["cut"]:]
            pred=np.column_stack((np.ones(len(v)),(v/hi)**2))@(even+sign*odd)
            c["forecasts_V"]["paired_published_quartic"]=pred.tolist()
            c["fit"]["paired_published_quartic"]={"input_slope_ratio":ratio,"common_support":[lo,hi],"common_points":200}


def forecast(arc,material):
    cases=roster(arc)
    output={}
    for e in cases:
        if e["material"]!=material or not e["present"]:continue
        drive,_,_=select(arc,e,"drive")
        cut=int(np.searchsorted(drive,.65*drive[-1],side="right"))
        replay,u,y=select(arc,e,"forecast",cut)
        if not np.array_equal(replay,drive):raise ValueError("drive mismatch")
        forecasts,fitinfo,features=project(drive,u,y)
        output[e["path"]]=dict(entry=e,cut=cut,drive=drive.tolist(),prefix4_V=y.tolist(),seconds_V=u.tolist(),
                               forecasts_V=forecasts,fit=fitinfo,features=features)
    paired_quartic(output)
    expected={"WTe2":62,"TaIrTe4":80}[material]
    if len(output)!=expected:raise ValueError("incomplete material bank")
    return dict(material=material,cases=output,missing=[e for e in cases if not e["present"]])


def score(arc,bank):
    material=bank['material'];errs={a:{} for a in ARMS};truth={};worst=None
    for path,c in bank['cases'].items():
        d,_,y=select(arc,c['entry'],'score',c['cut']);truth[path]=y.tolist()
        if not np.array_equal(d,c['drive']):raise ValueError('row mismatch')
        for a in ARMS:
            e=np.asarray(c['forecasts_V'][a])-y
            errs[a][path]=float(np.mean(abs(e)))*1e6
            if a==ARMS[0]:
                i=int(np.argmax(abs(e)))
                if worst is None or abs(e[i])>abs(worst['signed_V']):
                    worst=dict(path=path,entry=c['entry'],row=c['cut']+i,drive=float(d[c['cut']+i]),observed_V=float(y[i]),
                               signed_V=float(e[i]),forecasts_V={arm:c['forecasts_V'][arm][i] for arm in ARMS})
    metrics={}
    for arm in ARMS:
        metrics[arm]={}
        for g in ('all','NLS','NLN','NLMT'):
            scores=[v for p,v in errs[arm].items() if g=='all' or bank['cases'][p]['entry']['geometry']==g]
            metrics[arm][g+'_mean']=float(np.mean(scores));metrics[arm][g+'_worst']=max(scores)
    gates={g:all(v<metrics[a][g] for a in ARMS[1:]) for g,v in metrics[ARMS[0]].items()}
    return dict(material=material,truth_V=truth,per_sweep_MAE_uV=errs,metrics_uV=metrics,gates=gates,worst=worst)


def main():
    p=argparse.ArgumentParser()
    p.add_argument('mode',choices=['forecast','score']);p.add_argument('raw',type=Path)
    p.add_argument('material',choices=MATERIALS);p.add_argument('out',type=Path)
    p.add_argument('--bank',type=Path);p.add_argument('--bank-sha')
    args=p.parse_args()
    if sha(args.raw)!=RAW:raise ValueError('archive changed')
    with zipfile.ZipFile(args.raw) as arc:
        if args.mode=='forecast': obj=forecast(arc,args.material)
        else:
            if not args.bank or sha(args.bank)!=args.bank_sha:raise ValueError('forecast differs')
            bank=json.loads(args.bank.read_bytes())
            if args.material!=bank['material']:raise ValueError('material differs')
            obj=score(arc,bank)
    with args.out.open('x') as out:json.dump(obj,out,allow_nan=False,sort_keys=True,separators=(',',':'));out.write('\n')
    print(args.mode,args.material,args.out.stat().st_size,sha(args.out),flush=True)


if __name__=='__main__':
    main()
