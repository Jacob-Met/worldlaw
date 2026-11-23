"""Independent Decimal recount of measurements and archived clocks."""
from decimal import Decimal as D, localcontext, ROUND_FLOOR
import math
import re
import json
import pathlib
import sys
from urllib.parse import urlencode
from urllib.request import urlopen


def main(folder, published=False):
    if published:
        scored=json.loads((folder/"comparison.json").read_text())
        frozen=[[r["name"],r["bjd"],r["sigma_days"]] for r in scored["rows"]]
    elif (folder/"truth.json").exists():
        frozen=json.loads((folder/"truth.json").read_text())["rows"]
    else:
        raise ValueError("archived original measurement input is required")
    if not published:
        query = urlencode({"-source":"J/AJ/163/175/tablea1","-out":"Name,BJD,e_BJD","-out.max":"unlimited","-out.meta":"h"})
        try:
            data = urlopen("https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?"+query,timeout=25).read().decode()
            fresh = [tuple(row.split(chr(9))) for row in data.splitlines() if row.strip().startswith("S")]
            fresh = [tuple(v.strip() for v in row) for row in fresh if len(row)==3]
            if len(fresh)==74:
                assert {tuple(row) for row in frozen}==set(fresh)
                print("FRESH_PRIMARY_74_MATCH",flush=True)
            else:
                print("FRESH_PRIMARY_UNAVAILABLE",len(fresh),flush=True)
        except OSError as exc:
            print("FRESH_PRIMARY_UNAVAILABLE",repr(exc),flush=True)
    obs = {}
    for fields in frozen:
        if len(fields)!=3 or not re.fullmatch(r"S(?:20|43|44|45)-[0-9]+",fields[0]):
            continue
        try:
            t,err=D(fields[1]),D(fields[2])
        except ArithmeticError:
            continue
        assert fields[0] not in obs
        obs[fields[0]]=(t,err)
    assert len(obs)==74
    if not published:
        scored=json.loads((folder/"score.json").read_text())
    keys=["constant","decay","precession"]
    banks=None if published else [json.loads((folder/(a+".json")).read_text(),parse_float=D)["forecasts_seconds"] for a in keys]
    groups={s:[] for s in (20,43,44,45)}
    seen=set()
    for row in scored["rows"]:
        name=row["name"]
        assert name not in seen and name in obs
        seen.add(name)
        t,sigma=obs[name]
        epoch=int(((t.to_integral_value(rounding=ROUND_FLOOR)+D(".5")-D("2456305.4555"))/D("1.09142")).to_integral_value())
        sec=int(name.split("-")[0][1:])
        assert epoch==row['epoch'] and sec==row['sector']
        y=(t-D("2456305.4555")-D("1.09142")*epoch)*86400
        assert abs(float(y)-row["truth_seconds"])<.00005
        values=[D(str(v)) for v in row["pred_seconds"]]
        if banks is not None:
            assert all(float(bank[epoch-2027])==v for bank,v in zip(banks,row["pred_seconds"]))
            values=[bank[epoch-2027] for bank in banks]
        groups[sec].append((values,y,1/(sigma*86400)**2))
    def sums(a,other=None):
        raw=[]; projected=[]
        for rows in groups.values():
            vv=[(v[a]-(y if other is None else v[other]),w) for v,y,w in rows]
            weight=sum(w for _,w in vv)
            weighted=sum(w*x for x,w in vv)
            first=sum(w*x*x for x,w in vv)
            raw.append(first)
            projected.append(first-weighted*weighted/weight)
        return raw,projected
    def close(x,y):
        assert abs(float(x)-float(y))<=max(1e-5,abs(float(y))*3e-6),(x,y)
    check=[]
    for j,a in enumerate(keys):
        ra,pr=sums(j);g=scored["scores"][a]
        for n,v in enumerate(ra):close(v,g["sector_raw_chisq"][n])
        for n,v in enumerate(pr):close(v,g["sector_projected_chisq"][n])
        close(sum(ra),g["raw_chisq"]);close(sum(pr),g["projected_chisq"]);check.append(pr)
    plausible=[]
    for j in (0,2):
        ra,pr=sums(1,j);g=scored["separation"]["decay_vs_"+keys[j]]
        close(sum(ra),g["raw_d2"]);close(sum(pr),g["shape_d2"]);close(sum(ra)-sum(pr),g["offset_d2"])
        risk=.5*math.erfc(math.sqrt(float(sum(pr)))/(2*math.sqrt(2)))
        close(risk,g["ideal_shape_error"]);plausible.append(risk<=.05)
    pooled=[sum(check[1])<sum(check[j]) for j in (0,2)]
    sector=[all(a<b for a,b in zip(check[1],check[j])) for j in (0,2)]
    assert scored["gates"]==dict(pooled=pooled,all_sectors=sector,conditional_distinguish=plausible,joint=all(pooled+sector+plausible))
    worst=max(scored["rows"],key=lambda z:abs((z["pred_seconds"][1]-z["truth_seconds"])/float(z["sigma_days"])))
    assert worst["name"]==scored["worst_decay_standardized"]["name"]
    print("WORST",json.dumps(worst))
    print("ALL_SECTOR_COUNTS",[(k,len(v)) for k,v in groups.items()])
    print("INDEPENDENT_VERIFIED",len(seen),3*len(seen),[len(v) for v in groups.values()],scored["gates"],worst["name"])


if __name__=="__main__":
    with localcontext() as ctx:
        ctx.prec=60
        main(pathlib.Path(sys.argv[1]), "--published" in sys.argv[2:])
