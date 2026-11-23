"""Read original WTe2 tables and reconstruct primary projections without NumPy."""
import argparse
import gzip
import hashlib
import json
import math
import zipfile
from pathlib import Path
from statistics import fmean

SOURCE="aae5a0a58124b3aac207cfb46699481d354240f61b396cda5300a12ecaf16786"
ARMS=("smooth_integral","raw_integral","unit_integral","reversed_unit",
      "unconstrained_curvature","published_quartic","quartic_sextic","quartic_octic",
      "validation_power","constant_prefix","quartic_plus_curvature","paired_published_quartic")


def dot(left,right):
    return math.fsum(a*b for a,b in zip(left,right))


def solve(columns,target):
    # Direct normal equations, with each column scaled before pivoting.
    norms=[math.sqrt(dot(x,x)) for x in columns]
    if not all(norms):raise ValueError("singular predictor")
    x=[[t/n for t in col] for n,col in zip(norms,columns)]
    aug=[[dot(a,b) for b in x]+[dot(a,target)] for a in x]
    for i in range(len(x)):
        j=max(range(i,len(x)),key=lambda k:abs(aug[k][i]))
        aug[i],aug[j]=aug[j],aug[i]
        pivot=aug[i][i]
        if abs(pivot)<1e-13:raise ValueError("unresolved small pivot")
        aug[i]=[v/pivot for v in aug[i]]
        for j in range(len(x)):
            if j!=i:
                m=aug[j][i];aug[j]=[z-m*w for z,w in zip(aug[j],aug[i])]
    return [row[-1]/s for row,s in zip(aug,norms)]


def reconstruct(amps,seconds,prefix):
    a=[(v/amps[-1])**2 for v in amps];n=len(a);k=len(prefix)
    local=[]
    for i,z in enumerate(a):
        lo=max(0,min(i-4,n-9));xs=a[lo:lo+9];ds=[(x-z)/(xs[-1]-xs[0]) for x in xs]
        local.append(solve([[1.]*9,ds,[v*v for v in ds]],seconds[lo:lo+9])[0])
    intercept,slope=solve([[1.]*n,a],local)
    v=[y-intercept-slope*t for t,y in zip(a,local)]
    # Simpson's rule is exact on each interval for t times a linear interpolant.
    areas=[(b-x)*(x*u + (x+b)*(u+w) + b*w)/6 for x,b,u,w in zip(a,a[1:],v,v[1:])]
    feat=[3*math.fsum(areas[:i])/z**2-v[i] for i,z in enumerate(a)]
    r=[(a[0]/z)**2 for z in a]
    b,c,g=solve([[1.]*k,r[:k],feat[:k]],prefix)
    return [b+c*x+g*p for x,p in zip(r[k:],feat[k:])]


def raw_json(path):
    b=path.read_bytes()
    if b.startswith(b'\x1f\x8b'):b=gzip.decompress(b)
    return b


def main():
    p=argparse.ArgumentParser()
    for name in ("raw","bank","score"):p.add_argument(name,type=Path)
    p.add_argument("bank_sha");p.add_argument("score_sha");args=p.parse_args()
    b=raw_json(args.bank);s=raw_json(args.score)
    if [hashlib.sha256(z).hexdigest() for z in (args.raw.read_bytes(),b,s)]!=[SOURCE,args.bank_sha,args.score_sha]:
        raise ValueError("archive/forecast/score identity")
    bank=json.loads(b);score=json.loads(s)
    if bank["material"]!="WTe2" or score["material"]!="WTe2":raise ValueError("physical material")
    errs={arm:{} for arm in ARMS};nrow=0;gap=0.;primary_max=0.;worst=None;checks=0
    with zipfile.ZipFile(args.raw) as z:
        for path,case in bank["cases"].items():
            tab=[x.split() for x in z.read(path).splitlines() if x.strip() and not x.lstrip().startswith(b'#')]
            amps=[float(x[0]) for x in tab];u=[float(x[12]) for x in tab];y=[float(x[16]) for x in tab]
            cut=sum(x<=.65*max(amps) for x in amps)
            if case["cut"]!=cut or case["drive"]!=amps or case["seconds_V"]!=u or case["prefix4_V"]!=y[:cut]:
                raise ValueError("input/drive/prefix identity")
            held=y[cut:];nrow+=len(held)
            if score["truth_V"][path]!=held:raise ValueError("raw held truth")
            primary=reconstruct(amps,u,y[:cut])
            for pred,want in zip(primary,case["forecasts_V"]["smooth_integral"]):
                primary_max=max(primary_max,abs(pred-want))
                if not math.isclose(pred,want,rel_tol=1e-7,abs_tol=5e-13):
                    raise ValueError(("primary numeric mismatch",path,pred,want))
            for arm in ARMS:
                pred=case["forecasts_V"][arm]
                if len(pred)!=len(held):raise ValueError("forecast count")
                e=[t-v for t,v in zip(pred,held)]
                value=fmean(map(abs,e))*1e6
                errs[arm][path]=value;gap=max(gap,abs(value-score["per_sweep_MAE_uV"][arm][path]));checks+=1
                if arm==ARMS[0]:
                    for i,v in enumerate(e):
                        if worst is None or abs(v)>abs(worst["error_V"]):
                            worst={"path":path,"raw_row":cut+i,"error_V":v,"truth_V":held[i],
                                   "drive":amps[cut+i],"V2_V":u[cut+i],"forecasts_V":{a:case["forecasts_V"][a][i] for a in ARMS}}
    metrics={}
    for arm,d in errs.items():
        metrics[arm]={}
        for geom in ("all","NLS","NLN","NLMT"):
            a=[v for p,v in d.items() if geom=="all" or bank["cases"][p]["entry"]["geometry"]==geom]
            for suffix,v in (("mean",fmean(a)),("worst",max(a))):
                g=geom+"_"+suffix;metrics[arm][g]=v;gap=max(gap,abs(v-score["metrics_uV"][arm][g]));checks+=1
    gates={g:all(v<metrics[m][g] for m in ARMS[1:]) for g,v in metrics[ARMS[0]].items()}
    if gates!=score['gates'] or worst['path']!=score['worst']['path'] or worst['raw_row']!=score['worst']['row']:
        raise ValueError('verdict or worst changed')
    if gap>1e-8:raise ValueError(('absolute score difference in microvolts',gap))
    print(json.dumps({"sweeps":len(bank["cases"]),"held_rows":nrow,"forecast_errors":len(ARMS)*nrow,
        "scalar_score_checks":checks,"max_score_difference_uV":gap,"max_primary_difference_V":primary_max,
        "gates":gates,"worst":worst},sort_keys=True))


if __name__=="__main__":
    main()
