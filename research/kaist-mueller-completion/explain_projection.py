"""Attribute measured absolute-error differences to the frozen completion branches."""
import json
import math
from pathlib import Path
import sys
import numpy as np

from completion import cpspan


def explain(root):
    truth=json.loads((root/"development.json").read_bytes())
    by_material={}
    branch_names=("interval_present","interval_empty","linear_input_unavailable")
    with np.load(root/"development-predictions.npz") as pred:
        for i,meta in truth["materials"].items():
            with np.load(root/i/"linear.npz") as lin:
                a=lin["a"].astype(float); geom=lin["geometry"]
            with np.load(root/i/"circular.npz") as cir:
                y=cir["vv"].astype(float)
            ok=np.isfinite(y)
            scale=math.fsum(abs(a[ok & np.isfinite(a[:,0,0]),0,0]))
            dif=np.abs(y-pred[i+"-candidate"])-np.abs(y-pred[i+"-unprojected_residual"])
            groups={name:[] for name in branch_names}
            j=int(np.nanargmax(np.abs(y-pred[i+"-candidate"])))
            for k in np.flatnonzero(ok):
                m=a[k]
                span=None
                if not np.isfinite(m).all() or m[0,0]<=0:
                    name="linear_input_unavailable"
                else:
                    span=cpspan(m/m[0,0])
                    name="interval_empty" if span is None else "interval_present"
                groups[name].append(dif[k])
                if k==j:
                    worst={"coordinates":geom[k].tolist(),"branch":name,"interval":span}
            contributions={name:math.fsum(v)/scale for name,v in groups.items()}
            expected=meta["errors"]["candidate"]-meta["errors"]["unprojected_residual"]
            if not math.isclose(sum(contributions.values()),expected,rel_tol=1e-10,abs_tol=1e-12):
                raise ValueError("error decomposition disagrees")
            by_material[i]={"counts":{name:len(v) for name,v in groups.items()},
                            "normalized_error_differences":contributions,"worst":worst}
    out={"materials":by_material,"equal_material_error_differences":{
        name:math.fsum(v["normalized_error_differences"][name] for v in by_material.values())/len(by_material)
        for name in branch_names}}
    (root/"projection-branches.json").write_text(json.dumps(out,sort_keys=True,allow_nan=False)+"\n")
    print(json.dumps(out,sort_keys=True,allow_nan=False))


if __name__=="__main__":
    explain(Path(sys.argv[1]))
