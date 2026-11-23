"""Independently receive the published SPFIT measurements and recompute every registered score."""
from collections import defaultdict
from decimal import Decimal as D, localcontext
from fractions import Fraction
import argparse
import hashlib
import json
from pathlib import Path

LIN="553a6748da40346710438c10aa2a07cf2fcfd12dcbfd443ebba7e1d920842b27"
POINT=("zero","sulfur_only","silicon_only","diagonal","coupled","flex_diagonal","flex_coupled","spcat")
FAMILY="flex_diagonal_oracle"

def receive(source,bank,report):
    if hashlib.sha256(source).hexdigest()!=LIN:
        raise ValueError("SPFIT source identity")
    lines=source.decode("latin1").splitlines()
    check=defaultdict(list)
    def compare(kind,actual,reference,tol):
        diff=abs(actual-reference)
        check[kind].append(diff)
        if diff>D(tol):
            raise ValueError((kind,str(diff),str(actual),str(reference)))
    with localcontext() as ctx:
        ctx.prec=70
        errors={}
        truth={}
        for label,pred in sorted(bank["features"].items()):
            v,j=map(int,label.split("/"))
            target=report["groups"][label]
            if set(pred["centered_kHz"])!=set(POINT):
                raise ValueError("Forecast roster")
            raw=[]
            for ids in pred["ids"]:
                samples=[]
                for i in ids:
                    l=lines[i-1]
                    u,st,p,f,lo,st2,h,g=(int(l[z:z+3]) for z in range(0,24,3))
                    if (u,st,lo,st2)!=(j,160+v,j-1,160+v):
                        raise ValueError("SPFIT branch join")
                    fields=l[36:].split()
                    if D(fields[1])!=D(".002"):
                        raise ValueError("SPFIT measured uncertainty")
                    samples.append(D(fields[0]))
                if len(set(samples))!=1:
                    raise ValueError("Observed unresolved feature")
                raw.append(samples[0])
            for x,y in zip(raw,target["observations_MHz"]):
                compare("raw_MHz",x,y,"0.00000000001")
            t=[(x-sum(raw)/len(raw))*1000 for x in raw]
            truth[label]=t
            errors[label]={arm:[a-b for a,b in zip(pred["centered_kHz"][arm],t)] for arm in POINT}
            for actual,stored in zip(t,target["centered_kHz"]):
                compare("centered_kHz",actual,stored,"0.00000002")
            if label=="1/2":
                ids=pred["ids"]
                # The exact free column changes all J=2 levels except the
                # reference F1=1/2. Original catalog fields round F1 up.
                up=[]
                for group in ids:
                    numerator=D(0);denominator=D(0)
                    for i in group:
                        l=lines[i-1]
                        fields=l[36:].split()
                        try:
                            wt=D(fields[2]) if len(fields)>2 else D(1)
                        except ArithmeticError:
                            wt=D(1)
                        wflag=int(l[6:9])!=1
                        numerator+=wt*D(wflag);denominator+=wt
                    up.append(-numerator/denominator/28)
                d=[x-sum(up)/len(up) for x in up]
                z=errors[label]["flex_diagonal"]
                opt=-sum(a*b for a,b in zip(d,z))/sum(t*t for t in d)
                compare("oracle_t",opt,report["family_oracle_t_kHz"],".00001")
            frombank=bank["calibration"]["exact_donor_kernel"]["target_image"][label]
            for k,val in enumerate(frombank):
                a,b=Fraction(val).as_integer_ratio()
                compare("null_image",D(a)/D(b),d[k] if label=="1/2" else D(0),"1e-65")
        metrics={}
        raw_worst=None
        for lab,arms in errors.items():
            armerrors=arms["flex_diagonal"]
            zz=d if lab=="1/2" else [D(0)]*len(armerrors)
            arms[FAMILY]=[a+opt*b for a,b in zip(armerrors,zz)]
            for arm,vec in arms.items():
                saved=report["groups"][lab]["arms"][arm]
                for e,r in zip(vec,saved["residuals_kHz"]):
                    compare("residual_kHz",e,r,"0.00000003")
                rms=(sum(x*x for x in vec)/len(vec)).sqrt()
                compare("group_rms",rms,saved["rms_kHz"],"0.00000003")
                metrics.setdefault(arm,[]).append(rms)
                if arm=="coupled":
                    for i,e in enumerate(vec):
                        if raw_worst is None or abs(e)>abs(raw_worst[0]):
                            raw_worst=(e,lab,bank["features"][lab]["ids"][i],truth[lab][i],bank["features"][lab]["centered_kHz"][arm][i])
        stats={arm:{"mean_group_RMS_kHz":sum(values)/len(values),"worst_group_RMS_kHz":max(values)} for arm,values in metrics.items()}
        for arm,scores in stats.items():
            for k,val in scores.items():
                compare("aggregate",val,report["aggregate"][arm][k],"0.00000003")
        relative={arm+"/"+k:stats["coupled"][k]<stats[arm][k] for arm in ("diagonal","sulfur_only",FAMILY) for k in stats["coupled"]}
        absolute={"mean_within_2kHz":stats["coupled"]["mean_group_RMS_kHz"]<=2,"worst_within_4kHz":stats["coupled"]["worst_group_RMS_kHz"]<=4}
        assert relative==report["relative"] and absolute==report["absolute"]
        joint=all(relative.values()) and all(absolute.values())
        assert report["joint"]==joint
        return {"comparisons":{k:[len(v),str(max(v))] for k,v in check.items()},"fits":len(metrics),"measured_features":sum(map(len,truth.values())),
                "raw_worst_kHz":[str(x) for x in raw_worst],"gates":[*relative.values(),*absolute.values()],"joint":joint}

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    for arg in ("lin","bank","score"):
        ap.add_argument(arg,type=Path)
    a=ap.parse_args()
    read=lambda p:json.loads(p.read_bytes(),parse_float=D,parse_int=int)
    if hashlib.sha256(a.bank.read_bytes()).hexdigest()!=read(a.score)["input_sha256"]:
        raise ValueError("Forecast custody")
    print(json.dumps(receive(a.lin.read_bytes(),read(a.bank),read(a.score)),sort_keys=True))
