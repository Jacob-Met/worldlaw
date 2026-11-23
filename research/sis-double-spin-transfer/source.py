"""Read only declared assignment fields and the explicitly requested frequency class."""
from collections import defaultdict
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import urllib.request

PINS={"SiS.lin":"553a6748da40346710438c10aa2a07cf2fcfd12dcbfd443ebba7e1d920842b27",
      "SiS_supplementary_material.txt":"334e22d70f0b01c68fbe40bff6ee20e2454865c30b0b0fa9c2da551ef15d41de"}
BASE="https://cdms.astro.uni-koeln.de/classic/predictions/daten/SiS/"
RANGES=((60,91,29,32),(140,156,28,33),(160,163,29,33),(165,167,30,33),
        (210,220,29,34),(250,250,29,36))
DOUBLE=(29,33)

def source_file(directory,name):
    directory=Path(directory)
    path=directory/name
    if path.is_file():data=path.read_bytes()
    else:
        with urllib.request.urlopen(BASE+name,timeout=60) as r:data=r.read()
        if hashlib.sha256(data).hexdigest()!=PINS[name]:raise ValueError("Original download identity")
        directory.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)
    if hashlib.sha256(data).hexdigest()!=PINS[name]:raise ValueError("Cached source identity")
    return data

@dataclass(frozen=True)
class Branch:
    index:int
    si:int
    sulfur:int
    v:int
    j:int
    upper:tuple
    lower:tuple
    sigma:float
    weight:float
    frequency:object

def branches(directory,phase):
    if phase not in ("training","predict","score"):raise ValueError("Unknown reading phase")
    data=source_file(directory,"SiS_supplementary_material.txt").decode("latin1")
    out=[]
    for line in data.splitlines():
        fields=line.split()
        if len(fields)<13 or not fields[0].endswith(":") or fields[5]!="-":continue
        if not fields[0][:-1].isdigit():continue
        idx=int(fields[0][:-1])
        j,st,u1,uf=map(int,fields[1:5])
        k,ls,l1,lf=map(int,fields[6:10])
        if st!=ls or j not in (1,2) or k!=j-1:continue
        for a,b,si,sulfur in RANGES:
            if a<=st<=b:break
        else:continue
        hold=(si,sulfur)==DOUBLE
        if phase=="training" and hold:continue
        if phase in ("predict","score") and not hold:continue
        # The source preamble defines column 13 as a weight below one or a
        # literature reference. Integer references such as 22 carry unit weight.
        wt=1.
        if len(fields)>13:
            token=fields[13]
            if token.isdecimal():
                if int(token)<1:raise ValueError(("Invalid reference",idx,token))
            else:
                try:wt=float(token)
                except ValueError as exc:raise ValueError(("Unknown annotation",idx,token)) from exc
                if not 0<wt<1:raise ValueError(("Blend weight",idx,wt))
        # Columns 11/12 are kHz uncertainty and jointly fitted residual.
        # The residual is never used. Frequencies in column 10 are MHz.
        y=None if phase=="predict" else float(fields[10])*1000
        out.append(Branch(idx,si,sulfur,st-a,j,(j,2*u1-1,uf),(k,2*l1-1,lf),
                          float(fields[11]),wt,y))
    if len(out)!=(299 if phase=="training" else 47):raise ValueError(("Source roster",len(out)))
    return out

def grouped_targets(directory,phase):
    rows={s.index:s for s in branches(directory,phase)}
    registry=json.loads((Path(__file__).resolve().parent/"feature-groups.json").read_text())
    out=defaultdict(list)
    for g in registry:
        group=[rows.pop(i) for i in g["ids"]]
        assert len({(s.v,s.j) for s in group})==1
        if abs(sum(s.weight for s in group)-1)>.0002:raise ValueError("Weights do not close")
        if phase=="score" and len({s.frequency for s in group})!=1:raise ValueError("Blend observation mismatch")
        out[(group[0].v,group[0].j)].append(group)
    if rows or sorted(map(len,out.values()))!=[2,5,6,6,9,13]:raise ValueError("Feature census")
    return out
