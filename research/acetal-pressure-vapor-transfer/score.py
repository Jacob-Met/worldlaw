"""Receive all independently chromatographed fractions after the forecast lock."""
import json,sys
from pathlib import Path
import numpy as np
import xml.etree.ElementTree as ET
from project import kids,get

def score(xml,bank):
    root=ET.parse(xml).getroot()
    groups={int(get(z,"nPureOrMixtureDataNumber")):z for z in kids(root,"PureOrMixtureData")}
    res={};gates=[];allrows=[]
    for a,b in [(2,3),(4,5),(8,9)]:
        f=bank[str(a)]
        ds=groups[b]
        assert get(ds,'eMethodName')=='Chromatography' and get(ds,'ePropPhase')=='Gas'
        truth=[];keys=[]
        for row in kids(ds,"NumValues"):
            truth.append(float(get(kids(row,"PropertyValue")[0],"nPropValue")))
            vv={int(get(q,'nVarNumber')):float(get(q,'nVarValue')) for q in kids(row,'VariableValue')}
            keys.append((vv[1],vv[2]))
        assert list(zip(f["x"],f["t"]))==keys and len(truth)==len(f["p"])
        y=np.array(truth);interior=np.array([0<x<1 for x,t in keys])
        bounds=np.array(f["outer"]["bounds"]);width=bounds[:,1]-bounds[:,0]
        covered=(y>=bounds[:,0]-1e-12)&(y<=bounds[:,1]+1e-12)
        mae={k:float(np.mean(abs(np.array(v)[interior]-y[interior]))) for k,v in f["pred"].items()}
        worst={k:float(np.max(abs(np.array(v)[interior]-y[interior]))) for k,v in f["pred"].items()}
        ok=[bool(np.mean(covered[interior])>=.9),bool(np.median(width[interior])<=.05),
            all(mae["outer_midpoint"]<v for k,v in mae.items() if k!="outer_midpoint"),
            all(worst["outer_midpoint"]<v for k,v in worst.items() if k!="outer_midpoint")]
        res[str(a)]=dict(rows=len(y),interiors=int(interior.sum()),covered=int(covered[interior].sum()),
                         median_width=float(np.median(width[interior])),mae=mae,worst=worst,gates=ok)
        gates.extend(ok)
        for i,v in enumerate(y):
            allrows.append(dict(group=a,index=i,x=keys[i][0],t=keys[i][1],pressure=f["p"][i],
                truth=float(v),bounds=bounds[i].tolist(),pred={k:val[i] for k,val in f["pred"].items()}))
    worst=max((r for r in allrows if 0<r["x"]<1),key=lambda r:abs(r["truth"]-r["pred"]["outer_midpoint"]))
    return dict(groups=res,gates=gates,joint=all(gates),rows=allrows,worst_midpoint=worst)
if __name__=="__main__":
    result=score(sys.argv[1],json.loads(Path(sys.argv[2]).read_text()));Path(sys.argv[3]).write_text(json.dumps(result,sort_keys=True,allow_nan=False)+"\n")
