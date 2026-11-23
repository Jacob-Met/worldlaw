"""Receive the canonical PDS temperatures and re-evaluate every locked prediction."""
import datetime as dt
import hashlib
import json
from decimal import Decimal, localcontext
from pathlib import Path
from urllib.request import Request, urlopen


def verify(folder, restore_source=True):
    meta=json.loads((folder/"protocol.json").read_text())
    lock=json.loads((folder/"forecast-lock.json").read_text())
    encoded=(folder/"forecast.json").read_bytes()
    assert hashlib.sha256(encoded).hexdigest()==lock["sha256"] and len(encoded)==lock["bytes"]
    predictions=json.loads(encoded,parse_float=Decimal)
    recorded=json.loads((folder/"score.json").read_text(),parse_float=Decimal)
    source=meta["radiometer"]
    if restore_source:
        with urlopen(Request(source["uri"],headers={"User-Agent":"Independent HP3 archived-temperature receiver"}),timeout=60) as r:
            original=r.read()
        assert hashlib.sha256(original).hexdigest()==source["sha256"]
        rows=original.splitlines()
        assert len(rows)>=source["rows"]
    max_delta=Decimal(0)
    residuals=0
    count=0
    with localcontext() as ctx:
        ctx.prec=55
        for ev in meta["events"]:
            sol=ev["sol"]
            case=predictions["events"][sol]
            targets=recorded["events"][sol]["targets"]
            assert case["times"]==[t for t,y in targets] and len(targets)==len(set(case["times"]))
            if restore_source:
                center=dt.datetime.fromisoformat(ev["utc"])
                acquired=[]
                for row in rows:
                    s=row[:25].decode().strip().strip('"').rstrip("Z")
                    try: t=dt.datetime.fromisoformat(s)
                    except ValueError: continue
                    delta=t-center
                    offset=Decimal(delta.days*86400+delta.seconds)+Decimal(delta.microseconds)/1000000
                    if -Decimal(ev["width"])/2<=offset<=60:
                        acquired.append([offset,Decimal(row[158:166].strip().decode())])
                assert targets==acquired,sol
            assert set(case["predictions"])==set(meta["roles"])
            for role,ys in case["predictions"].items():
                errors=[yy-y for yy,(t,y) in zip(ys,targets,strict=True)]
                residuals+=len(errors)
                i=max(range(len(errors)),key=lambda j:abs(errors[j]))
                val=recorded["events"][sol]["scores"][role]
                assert val["worst_index"]==i and val["actual_K"]==targets[i][1]
                assert val["prediction_K"]==ys[i] and val["worst_offset_s"]==targets[i][0]
                metrics=dict(rmse_K=(sum(e*e for e in errors)/len(errors)).sqrt(),
                             mae_K=sum(abs(e) for e in errors)/len(errors),max_abs_K=abs(errors[i]))
                max_delta=max(max_delta,*(abs(val[k]-v) for k,v in metrics.items()))
                count+=len(metrics)
        for role,mean in recorded["mean_event_rmse_K"].items():
            check=sum(recorded["events"][s]["scores"][role]["rmse_K"] for s in meta["evaluation_sols"])/2
            max_delta=max(max_delta,abs(mean-check))
    assert max_delta<Decimal('1e-12') and recorded["joint_gate"] is False
    return dict(records=sum(len(e["targets"]) for e in recorded["events"].values()),residuals=residuals,
                role_metrics=count,aggregate_means=len(meta["roles"]),max_metric_delta_K=str(max_delta),
                independently_read_PDS=restore_source,joint_gate=recorded["joint_gate"])
