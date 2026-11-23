"""Independently verify all frozen metrics and raw largest errors with scalar arithmetic."""
import json
import math
from pathlib import Path

FREQ=(1840,2760,3670,3680,3690,4600,5520)
STRESS=(2,3,4)
LAYOUT=("original","relocated","equal_aperture_optimal")
def direct_projection(source,speaker):
    import hashlib
    import h5py
    import numpy as np
    expected={2:"264b0567785e98de0c14f11c8da443215a7c2e3fb20000244af0dc8e9df88705",
              4:"e3dcd2bc4f1dff5dfc3401477e05365ac05f26b9f7d3d67f8177a26a78d8d73b"}
    with open(source,"rb") as stream:
        d=hashlib.sha256()
        while piece:=stream.read(2**20):d.update(piece)
    assert d.hexdigest()==expected[speaker]
    phase=[np.asarray([complex(math.cos(2*math.pi*f*n/48000),-math.sin(2*math.pi*f*n/48000))
                       for n in range(4800)]) for f in FREQ]
    def evaluate(values):
        row=np.asarray(values,dtype=float)
        return [[float(np.dot(row,p.real)),float(np.dot(row,p.imag))] for p in phase]
    with h5py.File(source) as archive:
        positions=archive["grid"][:]
        ids={}
        for ix,(x,y,z) in enumerate(positions.T):
            ids[tuple(round(float(v)*50) for v in (x,y,z))]=ix
        assert len(ids)==63648
        import itertools
        ctr=list(itertools.product(range(5,42,9),range(7,44,9),(8,17)))
        centers=[evaluate(archive["rir"][ids[xyz],:]) for xyz in ctr]
    return centers

def independent(bank,result,direct):
    b=json.loads(Path(bank).read_bytes());s=json.loads(Path(result).read_bytes())
    import hashlib
    assert hashlib.sha256(Path(bank).read_bytes()).hexdigest()==s["forecast_sha256"]
    errs=[];components=[];groups={};report={}
    for sn in ("2","4"):
        y=[[complex(*x) for x in row] for row in direct[sn]]
        assert len(y)==50 and all(len(r)==7 for r in y)
        components += [abs(v-complex(*s["truth"][sn][i][j])) for i,row in enumerate(y) for j,v in enumerate(row)]
        for l in LAYOUT:
            key=sn+"/"+l
            for m,stack in b["forecasts"][key].items():
                p=[[complex(*v) for v in row] for row in stack]
                vs=[math.sqrt(math.fsum(abs(row[j]-yy[j])**2 for row,yy in zip(p,y))/
                              math.fsum(abs(yy[j])**2 for yy in y)) for j in range(7)]
                means=math.fsum(vs[j] for j in STRESS)/3
                groups[key,m]=means
                tar=s["metrics"][key][m]
                errs.extend(abs(x-z) for x,z in zip(vs,tar["per_frequency"]))
                errs.extend((abs(means-tar["stress_mean"]),abs(math.fsum(vs)/7-tar["all_mean"])))
                _,i,j=max((abs(p[i][j]-y[i][j]),-i,-j) for i in range(50) for j in STRESS)
                i,j=-i,-j
                witness=s["worst_stress_rows"][key+"/"+m]
                assert witness["row"]==i and witness["hz"]==FREQ[j] and witness["center"]==b["centers"][i]
                components.extend([abs(p[i][j]-complex(*witness["predicted"])),abs(y[i][j]-complex(*witness["measured"])),
                                   abs(abs(p[i][j]-y[i][j])-witness["absolute"])])
                if m in ("selected","author_directional"):report[key+"/"+m]=[means,vs]
    gates={sn+"/"+m+"/vs_"+l:groups[sn+"/relocated",m]<groups[sn+"/"+l,m]
           for sn in ("2","4") for m in ("selected","author_directional") for l in ("original","equal_aperture_optimal")}
    assert gates==s["gates"] and all(gates.values())==s["joint"]
    assert max(errs)<1e-8 and max(components)<1e-8
    return dict(held_coefficients=700,metric_comparisons=len(errs),vector_and_worst_comparisons=len(components),
                largest_metric_error=max(errs),largest_component_error=max(components),gates=gates,joint=s["joint"],primary=report)
