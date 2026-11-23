"""Independent table, complex-vector and system-level error reconstruction."""
import argparse
import cmath
import hashlib
import json
import math
from pathlib import Path
import re
import tarfile

ARMS=("stationary","face_on","edge_on","isotropic","physical_fit","parallax_minus_sigma","parallax_plus_sigma","marginal")
CONTROLS=ARMS[:5]

def close(a,b,tol=1e-9):
    if abs(a-b)>tol:
        raise ValueError(("Different original values",a,b,tol))
    return abs(a-b)

def raw_positions(tar):
    if hashlib.sha256(tar.read_bytes()).hexdigest()!="182cc7b0c35d21ae628e2ca7b645b8d7870ad708ad8d12e51e19a7c431a68439":
        raise ValueError("Author source identity")
    with tarfile.open(tar) as source:
        document=source.extractfile("MN-PIO.tex").read().decode("latin1")
    start=document.index(r"\label{tab:mesPIO}")
    end=document.index(r"\end{tabular}",start)
    output={}
    for line in document[start:end].splitlines():
        group=re.search(r"HIP\s+(\d{5,6})",line)
        if group:
            star=group.group(1);output[star]=[]
        cells=line.split("&")
        if len(cells)!=7 or not re.fullmatch(r"\s*\d{5}\.\d+\s*",cells[0]):
            continue
        stamp,rho,angle=[float(cells[k].replace("$-$","-")) for k in (0,2,3)]
        output[star].append((stamp,rho,angle,"*" in cells[1]))
    return output

def uv(p,t,signs):
    def varied(k,j):
        return p[k]+signs[j]*p[k+"_se"]
    e=varied("e",2)
    M=2*math.pi*((t+.5+.008*signs[4]-varied("epoch",1))/varied("period",0))
    M=math.atan2(math.sin(M),math.cos(M))
    E=M
    for _ in range(25):
        d=(E-e*math.sin(E)-M)/(1-e*math.cos(E))
        if abs(d)<1e-15:break
        E-=d
    return complex(math.cos(E)-e,math.sqrt(1-e*e)*math.sin(E))*cmath.exp(1j*math.radians(varied("omega",3)))

def projections(q0,q1,angle,sep):
    def projected(z):
        return complex(z.real,z.imag*angle)
    p0,p1=projected(q0),projected(q1)
    ratio=p1/p0
    return (sep*abs(ratio),sep*ratio.real,sep*ratio.imag)

def rebuild(p, anchor, sig, n):
    a0=uv(p,anchor[0],sig)
    rho=anchor[1]
    A=(p["a1"]+p["a2"])*p["parallax"]/149.5978707
    ds=math.hypot((p["a1"]+p["a2"])*p["parallax_se"],(p["a1_se"]+p["a2_se"])*p["parallax"])/149.5978707
    grid=[(j+.5)/n for j in range(n)]
    def dist(c):
        return rho*math.sqrt(1-c*c)/abs(complex(a0.real,c*a0.imag))
    weights=[-.5*((dist(c)-A)/ds)**2 for c in grid]
    m=max(weights);weights=[math.exp(w-m) for w in weights];sumw=math.fsum(weights)
    ret=[]
    for epoch in p["epochs"][1:]:
        q=uv(p,epoch["mjd"],sig)
        vals=[projections(a0,q,c,rho) for c in grid]
        def fit(scale):
            c2=(rho*rho-scale*scale*a0.real*a0.real)/(rho*rho+scale*scale*a0.imag*a0.imag)
            return projections(a0,q,math.sqrt(max(0.,c2)),max(rho,scale*abs(a0.real)))
        ret.append({"stationary":(rho,rho,0),"edge_on":projections(a0,q,0.,rho),"face_on":projections(a0,q,1.,rho),
            "physical_fit":fit(A),"parallax_minus_sigma":fit(max(0.,A-ds)),"parallax_plus_sigma":fit(A+ds),
            "marginal":[math.fsum(w*v[j] for w,v in zip(weights,vals))/sumw for j in range(3)],
            "isotropic":[math.fsum(v[j] for v in vals)/n for j in range(3)]})
    return ret

def check(source, frozen, report):
    coords=raw_positions(source)
    cases=[];systems={};max_delta=0.;nstress=0;hits=0
    for s,epochs in coords.items():
        source_input=frozen["source_inputs"][s]
        preds=rebuild(source_input,epochs[0],(0,0,0,0,0),4096)
        for experiment in frozen["stress"][s]:
            generated=rebuild(source_input,epochs[0],experiment["signs"],2048)
            for p,expected in zip(generated,experiment["rows"],strict=True):
                for name in expected:
                    for a,b in zip(p[name],expected[name],strict=True):
                        max_delta=max(max_delta,close(a,b));nstress+=1
        moments={k:[[],[],[],[]] for k in ARMS}
        for (t,rho,angle,fixed),sim,locked in zip(epochs[1:],preds,frozen["nominal"][s]["rows"],strict=True):
            actual=next(r for r in report["rows"] if r["star"]==s and r["mjd"]==t)
            if actual["rho"]!=rho or actual["pa"]!=angle or actual["fixed_flux"]!=fixed:
                raise ValueError("Held original row")
            rel=rho*cmath.exp(1j*math.radians(angle))/cmath.exp(1j*math.radians(epochs[0][2]))
            target=(rho,rel.real,rel.imag)
            for j in range(3):close(actual["truth"][j],target[j])
            for k in ARMS:
                for j,v in enumerate(sim[k]):
                    max_delta=max(max_delta,close(v,locked["forecast"][k][j]))
                    close(v-target[j],actual["error"][k][j])
                radius,along,cross=sim[k]
                for out,val in zip(moments[k],((radius-rho)**2,(along-rel.real)**2,
                         (along-rel.real)**2+(-cross-rel.imag)**2,(along-rel.real)**2+(cross-rel.imag)**2)):
                    out.append(val)
            lower,upper=sorted((sim["face_on"][0],sim["edge_on"][0]))
            enclosed=lower<=rho<=upper
            if enclosed!=actual["in_distance_free_interval"]:raise ValueError("Radial envelope")
            hits+=enclosed
            cases.append((s,t,rho,angle,fixed,abs(actual["error"]["marginal"][0]),abs(actual["error"]["marginal"][1])))
        for k,arrays in moments.items():
            values=[math.sqrt(math.fsum(a)/len(a)) for a in arrays]
            for a,b in zip(values,report["systems"][s][k]["rmse"]+report["systems"][s][k]["global_mirror_rmse"]):close(a,b)
            systems[s,k]=values
    metrics={}
    for arm in ARMS:
        table={}
        for j,k in enumerate(("radius","parallel")):
            rms=[systems[s,arm][j] for s in coords]
            for f,x in (("mean_",sum(rms)/3),("worst_",max(rms))):
                table[f+k]=x;close(x,report["metrics"][arm][f+k])
        metrics[arm]=table
    gates={k:v<min(metrics[a][k] for a in CONTROLS) for k,v in metrics["marginal"].items()}
    if gates!=report["gates"] or all(gates.values())!=report["joint"] or hits!=report["range_hits"]:
        raise ValueError("Decision")
    for j,k in enumerate(("radius","parallel"),5):
        row=max(cases,key=lambda c:c[j])
        if (row[0],row[1])!=(report["worst"][k]["star"],report["worst"][k]["mjd"]):
            raise ValueError("Raw-worst identity")
    return {"epochs":len(cases),"sys":len(coords),"nominal_components":len(cases)*len(ARMS)*3,
            "perturbed_components":nstress,"range_hits":hits,"gates":gates,"joint":all(gates.values()),
            "max_forecast_component_difference_mas":max_delta,
            "raw_worst":{k:report["worst"][k] for k in ("radius","parallel")}}
if __name__=="__main__":
    parser=argparse.ArgumentParser()
    for k in ("archive","forecast","result","output"):parser.add_argument(k,type=Path)
    args=parser.parse_args()
    got=check(args.archive,json.loads(args.forecast.read_bytes()),json.loads(args.result.read_bytes()))
    args.output.write_text(json.dumps(got,sort_keys=True,separators=(",",":"))+"\n")
    print("INDEPENDENT",json.dumps({k:v for k,v in got.items() if k!="raw_worst"},sort_keys=True))
