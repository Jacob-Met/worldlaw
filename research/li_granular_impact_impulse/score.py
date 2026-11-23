"""Require exact prediction bytes/census before recomputing same-run held observations."""
import hashlib, json, math
from pathlib import Path
from measurements import extract,contract
def mean(x):
    x=list(x);return math.fsum(x)/len(x)
def score(p,original,features,targets):
    a=original["predictions"];dims=p["scales_ms"];roles=p["roles"];te=p["held"]
    assert set(te)==set(targets) and features==original["permitted_inputs_and_development"]
    scales={g:[mean(features[k]["Q"][l] for k in p["development"] if k[6]==g) for l in range(6)] for g in "12345"}
    cells={k:targets[k]["Q"] for k in te}
    runs={};composition={};summaries={};worsts={}
    for r in roles:
        absworst=(-1.,None);scaledworst=(-1.,None);results={}
        for k in te:
            err=[v-u for v,u in zip(a[k][r],cells[k])]
            norm=[abs(e)/v for e,v in zip(err,scales[k[6]])]
            results[k]=[math.sqrt(mean(x*x for x in norm)),mean(norm),math.sqrt(mean(x*x for x in err)),mean(abs(x) for x in err)]
            for i,e in enumerate(err):
                if abs(e)>absworst[0]:absworst=(abs(e),(k,i))
                if norm[i]>scaledworst[0]:scaledworst=(norm[i],(k,i))
        runs[r]=results
        composition[r]={g:[mean(results[k][i] for k in te if k[6]==g) for i in range(4)] for g in scales}
        summaries[r]=[mean(v[i] for v in composition[r].values()) for i in range(4)]
        worsts[r]={"absolute":absworst,"normalized":scaledworst}
    c=p["candidate"];w={}
    for name,(magnitude,(k,i)) in worsts[c].items():
        t=targets[k];start,h=t["maximum_coeff"][i];s=dims[i]
        w[name]={"k":k,"scale_ms":s,"abs_residual":magnitude,"Q_Pa2":cells[k][i],"values_same_endpoint":{r:a[k][r][i] for r in roles},"largest_observed_haar":[start,h],"raw_segment_Pa":t["raw"][start:start+s]}
    wins={r:sum(composition[c][g][0]<composition[r][g][0] for g in scales) for r in roles if r!=c}
    gate=all(summaries[c][0]<summaries[r][0] and summaries[c][1]<summaries[r][1] and wins[r]>=3 for r in wins)
    return {"target_Q":cells,"metric_order":["normalized_rmse","normalized_mae","rmse_Pa2","mae_Pa2"],"normalization":scales,"run":runs,"composition":composition,"mean":summaries,"candidate_group_wins":wins,"worsts":worsts,"candidate_worst_details":w,"joint_gate":gate}
if __name__=="__main__":
    protocol=contract()
    b=Path("forecast.json").read_bytes()
    index=json.loads(Path("forecast-lock.json").read_bytes())
    assert hashlib.sha256(b).hexdigest()==index["sha256"] and len(b)==index["bytes"]
    p=json.loads(b)
    assert p["protocol_sha256"]==hashlib.sha256(Path("protocol.json").read_bytes()).hexdigest()
    assert p["roles"]==protocol["roles"] and p["scales_ms"]==protocol["scales_ms"] and set(p["predictions"])==set(protocol["held"])
    assert all(set(d)==set(protocol["roles"]) and all(len(v)==6 and all(isinstance(a,(int,float)) and math.isfinite(a) for a in v) for v in d.values()) for d in p["predictions"].values())
    features,targets=extract(True)
    result=score(protocol,p,features,targets)
    result["forecast_sha256"]=index["sha256"]
    print(json.dumps(result,allow_nan=False,sort_keys=True,separators=(",",":")))
