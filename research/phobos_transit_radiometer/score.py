"""Score fixed forecast arrays at all registered event timestamps."""
import hashlib
import json
import math
from statistics import fmean


def evaluate(protocol, forecasts, observations):
    result = {}
    for sol, case in forecasts["events"].items():
        truth = observations[sol]["targets"]
        assert case["times"] == [t for t,_ in truth]
        assert set(case["predictions"]) == set(protocol["roles"])
        summary={}
        for role in protocol["roles"]:
            values = case["predictions"][role]
            assert len(values) == len(truth)
            errors = [yhat-y for yhat,(_,y) in zip(values,truth)]
            i=max(range(len(errors)),key=lambda j:abs(errors[j]))
            summary[role]=dict(rmse_K=math.sqrt(fmean(v*v for v in errors)),
                               mae_K=fmean(abs(v) for v in errors),
                               max_abs_K=abs(errors[i]),worst_index=i,
                               worst_offset_s=truth[i][0],actual_K=truth[i][1],prediction_K=values[i])
        result[sol]=dict(targets=truth,scores=summary)
    eval_sols=protocol["evaluation_sols"]
    means={k:fmean(result[s]["scores"][k]["rmse_K"] for s in eval_sols) for k in protocol["roles"]}
    strict=all(means["halfspace"]<v for k,v in means.items() if k!="halfspace")
    within=all(result[s]["scores"]["halfspace"]["rmse_K"]<result[s]["scores"][k]["rmse_K"]
               for s in eval_sols for k in ["zero","instantaneous","integral","exponential_selected","phase_template"])
    return dict(events=result,mean_event_rmse_K=means,strict_aggregate=strict,required_each_case=within,joint_gate=strict and within)


def load_forecasts(directory):
    data=(directory/"forecast.json").read_bytes()
    lock=json.loads((directory/"forecast-lock.json").read_text())
    assert len(data)==lock["bytes"] and hashlib.sha256(data).hexdigest()==lock["sha256"]
    return json.loads(data)
