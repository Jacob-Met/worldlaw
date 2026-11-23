"""Open later physical curves only after every forecast hash and shape checks out."""
import gzip
import hashlib
import json
import pathlib
import sys

import numpy as np

from acquisition import read_array

ROLES=sorted(["raw_reference","reference","ridge","translation","free_affine","zinc_minus","zinc_plus",
              "constant_minus","constant_plus","gain_minus","gain_plus","zinc","constant","gain"])
COMPARE=["reference","translation","free_affine","constant","gain","ridge"]


def validate(raw,sha):
    assert hashlib.sha256(raw).hexdigest()==sha
    f=json.loads(raw); assert f["known_biased_group"]==7 and f["held_mass_used"] is False
    t=np.linspace(40.,850.,1000);t=t[t>=320]
    assert np.array_equal(f["T"],t) and set(f["groups"])=={"1","6","7"}
    for group,pack in f["groups"].items():
        assert sorted(pack["mass"])==ROLES and set(pack["geometry"]["chosen"])=={"gain","zinc","constant"}
        for role,v in pack["mass"].items():assert np.isfinite(v).all() and len(v)==len(t)
        for fam,choice in pack["geometry"]["chosen"].items():assert pack["mass"][fam]==pack["mass"][choice]
    return f,t


def evaluate(f,t):
    grid,raw,source=read_array();assert source["sha256"]==f["source"]["sha256"]
    later=grid>=320; windows={"whole":np.ones(len(t),dtype=bool),"second":t<560,"third":t>=560}
    report={}
    for group in [1,6,7]:
        # The only opened target masses are the last 10 specimens and later grid cells of each registered group.
        truth=raw[5:15,:,group-1][:,later].copy()
        assert np.isfinite(truth).all() and truth.shape==(10,len(t))
        curves=f["groups"][str(group)]["mass"]
        rmse={};mae={};per={}
        for w,mask in windows.items():
            rmse[w]={};mae[w]={};per[w]={}
            for role in ROLES:
                err=truth[:,mask]-np.array(curves[role])[None,mask]
                per[w][role]=np.sqrt(np.mean(err**2,axis=1)).tolist()
                rmse[w][role]=float(np.mean(per[w][role]))
                mae[w][role]=float(np.mean(np.abs(err)))
        index=np.unravel_index(np.argmax(abs(truth-np.array(curves["zinc"]))),truth.shape)
        spec,k=map(int,index)
        worst=dict(specimen=spec+6,temp_C=t[k],grid_index=int(np.flatnonzero(later)[k]),truth=truth[spec,k],
            all_at_cell={r:curves[r][k] for r in ROLES},all10=np.array(truth[:,k]).tolist(),
            neighborhood=[dict(T=t[i],measured=truth[spec,i],zinc=curves["zinc"][i],ridge=curves["ridge"][i],translation=curves["translation"][i])
                          for i in range(max(0,k-4),min(len(t),k+5))])
        gates={r:rmse["whole"]["zinc"]<rmse["whole"][r] for r in COMPARE}
        gates.update({w+"_translation":rmse[w]["zinc"]<rmse[w]["translation"] for w in ["second","third"]})
        wins=sum(a<b for a,b in zip(per["whole"]["zinc"],per["whole"]["ridge"]))
        report[str(group)]=dict(rmse=rmse,mae=mae,per=per,worst=worst,ridge_wins=wins,gates=gates,
                           passed=all(gates.values()) and wins>=6,truth=truth.tolist())
    return dict(source=source,groups=report,later_count=len(t),second_count=int((t<560).sum()),primary=report["7"]["passed"])


if __name__=="__main__":
    f,t=validate(pathlib.Path(sys.argv[1]).read_bytes(),sys.argv[2])
    data=evaluate(f,t)
    pathlib.Path(sys.argv[3]).write_text(json.dumps(data,sort_keys=True,allow_nan=False,separators=(",",":")))
