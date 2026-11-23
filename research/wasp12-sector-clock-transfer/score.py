"""Recount all late transits under absolute and offset-invariant timing losses."""
from pathlib import Path
import json
import math
import re
import sys
import numpy as np
from fit import PERIOD, REFERENCE, WONGCAT, table


def score(folder):
    arms = ["constant", "decay", "precession"]
    bank = {a: json.loads((folder / (a + ".json")).read_text()) for a in arms}
    rows = table(WONGCAT, ["Name", "BJD", "e_BJD"])
    assert len(rows) == len({r[0] for r in rows}) == 74
    epochs = np.array([round((math.floor(float(r[1])) + 0.5 - REFERENCE)/PERIOD) for r in rows])
    sectors = np.array([int(re.search(r"20|43|44|45", r[0]).group()) for r in rows])
    assert set(sectors)=={20,43,44,45} and len(set(epochs))==74
    assert min(epochs)>=2027 and max(epochs)<=5000
    y = np.array([(float(r[1])-REFERENCE-PERIOD*e)*86400 for r,e in zip(rows,epochs)])
    sigma = np.array([float(r[2])*86400 for r in rows])
    assert np.all(sigma>0)
    w = sigma**-2
    preds = np.stack([np.asarray(bank[a]["forecasts_seconds"])[epochs-2027] for a in arms])
    residual = preds-y
    mask = [sectors==s for s in (20,43,44,45)]
    def energy(v):
        return np.sum(w*v*v)
    def centered(v):
        out=v.copy()
        for m in mask:
            out[m] -= np.average(v[m],weights=w[m])
        return out
    scores={}
    for a,r in zip(arms,residual):
        p=centered(r)
        scores[a]={"raw_chisq":energy(r),"projected_chisq":energy(p),
                   "sector_raw_chisq":[float(np.sum(w[m]*r[m]**2)) for m in mask],
                   "sector_projected_chisq":[float(np.sum(w[m]*p[m]**2)) for m in mask]}
    tests={}
    for j in (0,2):
        v=preds[1]-preds[j]
        pv=centered(v)
        raw,shape,offset=energy(v),energy(pv),energy(v-pv)
        assert abs(raw-shape-offset)<1e-8*max(1,raw)
        key="decay_vs_"+arms[j]
        tests[key]={"raw_d2":raw,"shape_d2":shape,"offset_d2":offset,
                    "ideal_shape_error":0.5*math.erfc(math.sqrt(shape)/(2*math.sqrt(2)))}
    winners=[scores["decay"]["projected_chisq"]<scores[a]["projected_chisq"] for a in ("constant","precession")]
    per=[all(x<y for x,y in zip(scores["decay"]["sector_projected_chisq"],scores[a]["sector_projected_chisq"])) for a in ("constant","precession")]
    distinguish=[v["ideal_shape_error"]<=.05 for v in tests.values()]
    r=residual[1]
    i=int(np.argmax(np.abs(r/sigma)))
    return dict(scores=scores,separation=tests,gates=dict(pooled=winners,all_sectors=per,conditional_distinguish=distinguish,
        joint=all(winners+per+distinguish)),rows=[dict(name=row[0],epoch=int(e),sector=int(s),bjd=row[1],sigma_days=row[2],
        truth_seconds=float(y[k]),pred_seconds=preds[:,k].tolist()) for k,(row,e,s) in enumerate(zip(rows,epochs,sectors))],
        worst_decay_standardized=dict(index=i,name=rows[i][0],residual_seconds=float(r[i]),sigma_seconds=float(sigma[i]),z=float(r[i]/sigma[i])))


if __name__=="__main__":
    print(json.dumps(score(Path(sys.argv[1])),allow_nan=False,sort_keys=True))
