"""Calibrate on all development releases and emit the frozen conditional predictions."""
import json, math, hashlib
from pathlib import Path
from measurements import contract,extract

def mean(x):
    x=list(x)
    return math.fsum(x)/len(x)
def solve(a,b):
    aug=[list(row)+[rhs] for row,rhs in zip(a,b)]
    for i in range(3):
        j=max(range(i,3),key=lambda j:abs(aug[j][i]));aug[i],aug[j]=aug[j],aug[i]
        v=aug[i][i];assert abs(v)>1e-12
        aug[i]=[x/v for x in aug[i]]
        for j in range(3):
            if j!=i:
                f=aug[j][i];aug[j]=[x-f*y for x,y in zip(aug[j],aug[i])]
    return [row[-1] for row in aug]
def mass(k):return 4*int(k[5])
def group(k):return int(k[6])
def pred(data,gamma,p):
    tr=p["development"];te=p["held"]
    assert len(gamma)==15 and all(v>0 and math.isfinite(v) for v in gamma.values())
    ans={i:{r:[] for r in p["roles"]} for i in te};factors=[]
    for l in range(6):
        x={};extras={}
        for k,d in data.items():
            g=group(k);m=mass(k);sh=gamma[k.split(":")[0]];L=d["L"][l];D=d["D2"][l]
            assert L>0 and D>0
            ti=1550*(p["d40_mm"][g-1]*.001*sh)**2
            x[k]=[math.log(L),math.log(sh),math.log(m)]
            extras[k]={"shot_shear":L*sh,"shot_load":L,"coherent":D,"paper_mid":D*ti**.74,
                       "paper_low":D*ti**.62,"paper_high":D*ti**.86,"mass_linear":m,
                       "rotated_shear":L*gamma[k[:6]+str(g%5+1)]}
        y={k:math.log(data[k]["Q"][l]) for k in tr}
        groups={g:[k for k in tr if group(k)==g] for g in range(1,6)}
        by={g:([mean(x[k][j] for k in ks) for j in range(3)],mean(y[k] for k in ks)) for g,ks in groups.items()}
        xx=[[x[k][j]-by[group(k)][0][j] for j in range(3)] for k in tr];yy=[y[k]-by[group(k)][1] for k in tr]
        beta=max(-2.,min(4.,math.fsum(z[0]*v for z,v in zip(xx,yy))/math.fsum(z[0]**2 for z in xx)))
        scale=[math.sqrt(mean(z[j]**2 for z in xx)) or 1. for j in range(3)]
        zz=[[u/s for u,s in zip(z,scale)] for z in xx]
        b=solve([[math.fsum(v[i]*v[j] for v in zz)+float(i==j) for j in range(3)] for i in range(3)],
                [math.fsum(z[i]*v for z,v in zip(zz,yy)) for i in range(3)])
        factors.append({"load_exponent":beta,"joint_slopes":[v/s for v,s in zip(b,scale)]})
        for k in data:extras[k]["learned_load"]=data[k]["L"][l]**beta
        for k in te:
            g=group(k);ks=groups[g];base=mean(data[j]["Q"][l] for j in ks)
            for r,value in extras[k].items():ans[k][r].append(base*value/mean(extras[j][r] for j in ks))
            low,hi=[mean(data[j]["Q"][l] for j in ks if mass(j)==m) for m in (4,8)]
            ans[k]["source_mean"].append(base);ans[k]["eight_kg"].append(hi)
            ans[k]["mass_extrapolate"].append(max(0.,2*hi-low))
            ans[k]["joint_log_ridge"].append(math.exp(by[g][1]+math.fsum((a-u)*w/s for a,u,w,s in zip(x[k],by[g][0],b,scale))))
    assert all(set(v)==set(p["roles"]) and all(len(x)==6 and all(map(math.isfinite,x)) for x in v.values()) for v in ans.values())
    return ans,factors
if __name__=="__main__":
    p=contract();data,sealed=extract();assert not sealed
    g=json.loads(Path("optical-inputs.json").read_bytes())["secant_per_s"]
    ans,f=pred(data,g,p)
    print(json.dumps({"protocol_sha256":hashlib.sha256(Path("protocol.json").read_bytes()).hexdigest(),
                      "roles":p["roles"],"scales_ms":p["scales_ms"],"predictions":ans,"source_fits":f,
                      "permitted_inputs_and_development":data},allow_nan=False,separators=(",",":"),sort_keys=True))
