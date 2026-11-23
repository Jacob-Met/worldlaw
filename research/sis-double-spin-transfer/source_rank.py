"""Determine the exact donor-design kernel and its image in the registered feature space."""
from collections import defaultdict
from fractions import Fraction as Q
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

SLOTS=[(1,3),(1,5),(2,3),(2,5),(2,7)]
DIGEST="334e22d70f0b01c68fbe40bff6ee20e2454865c30b0b0fa9c2da551ef15d41de"
NAME="SiS_supplementary_material.txt"

def project(data,registry):
    donor=defaultdict(lambda:defaultdict(list))
    targets={}
    for row in data.decode("latin1").splitlines():
        f=row.split()
        if len(f)<13 or not f[0].endswith(":") or not f[0][:-1].isdigit() or f[5]!="-":
            continue
        idx=int(f[0][:-1])
        j,st,fu,_,l,lt,fl,_=map(int,f[1:5]+f[6:10])
        if j not in (1,2) or l!=j-1 or st!=lt:
            continue
        if 140<=st<=156:
            v,m=st-140,28
        elif 165<=st<=167:
            v,m=st-165,30
        elif 160<=st<=163:
            v,m=st-160,29
        else:
            continue
        d=Q(29,m)-1
        vec=[(int(key==(j,2*fu-1))-int(key==(l,2*fl-1)))*e for key in SLOTS for e in (1,Q(v),d,d*v)]
        wt=Q(f[13]) if len(f)>13 and "." in f[13] else Q(1)
        if not 0<wt<=1:
            raise ValueError("Unknown secondary column")
        if m==29:
            targets[idx]=(vec,wt)
        else:
            # Source frequency used only to assign coincident donor features.
            donor[m,v,j][f[10]].append((vec,wt))
    def blend(pairs):
        tot=sum(w for _,w in pairs)
        return [sum(row[i]*w for row,w in pairs)/tot for i in range(20)]
    contrasts=[]
    for features in donor.values():
        vectors=[blend(pairs) for pairs in features.values()]
        for vec in vectors[1:]:
            contrasts.append([a-b for a,b in zip(vec,vectors[0])])
    pivots={}
    for vec in contrasts:
        v=list(vec)
        for p in sorted(pivots):
            if v[p]:
                v=[a-v[p]*b for a,b in zip(v,pivots[p])]
        p=next((i for i,x in enumerate(v) if x),None)
        if p is None:
            continue
        v=[x/v[p] for x in v]
        pivots[p]=v
    free=sorted(set(range(20))-pivots.keys())
    assert len(free)==1
    z=[Q(int(i==free[0])) for i in range(20)]
    for p in sorted(pivots,reverse=True):
        z[p]=-sum(a*b for a,b in zip(pivots[p][p+1:],z[p+1:]))
    assert all(sum(a*b for a,b in zip(vec,z))==0 for vec in contrasts)
    effects=defaultdict(list)
    for features in registry:
        vec=blend([targets[i] for i in features["ids"]])
        effects[f'{features["state"]-160}/{features["j"]}'].append(sum(x*y for x,y in zip(vec,z)))
    centered={k:[str(x-sum(xs)/len(xs)) for x in xs] for k,xs in effects.items()}
    return {"slots":SLOTS,"rank":len(pivots),"pivots":sorted(pivots),"free":free,
            "null":[str(x) for x in z],"donor_contrasts":len(contrasts),"target_image":centered}

if __name__=="__main__":
    path=Path(sys.argv[1]) if len(sys.argv)>1 else Path(NAME)
    if path.is_file():
        data=path.read_bytes()
    else:
        url="https://cdms.astro.uni-koeln.de/classic/predictions/daten/SiS/"+NAME
        with urllib.request.urlopen(url,timeout=30) as response:
            data=response.read()
    if hashlib.sha256(data).hexdigest()!=DIGEST:
        raise ValueError("Source bytes")
    groups=json.loads((Path(__file__).parent/"feature-groups.json").read_text())
    print(json.dumps(project(data,groups),sort_keys=True,separators=(",",":")))
