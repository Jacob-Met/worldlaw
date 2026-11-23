"""Score sealed predictions using the registered four-coefficient development endpoint."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from forecast import ARMS, INPUTS, TARGETS, read_sheet, require

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path)
    parser.add_argument("predictions",type=Path)
    parser.add_argument("lock_sha256")
    parser.add_argument("output",type=Path)
    args=parser.parse_args()
    raw=args.predictions.read_bytes()
    require(hashlib.sha256(raw).hexdigest()==args.lock_sha256,"sealed forecast digest differs")
    lock=json.loads(raw)
    require(tuple(lock["arm_order"])==ARMS and set(lock["answers"])==set(ARMS)
            and lock["query_ids"]==[401,660] and lock["target_ids_opened"]==[1,400],"invalid phase")
    preds={m:np.asarray(lock["answers"][m]["predictions"],float) for m in ARMS}
    require(all(a.shape==(260,4) and np.isfinite(a).all() for a in preds.values()),"incomplete forecast roster")
    X,Y=read_sheet(args.archive,range(1,661),660)
    scale=Y[:400].std(axis=0)
    require(np.array_equal(scale,lock["training_scales"]),"training scale differs")
    truth=Y[400:]
    scores={}
    for m,v in preds.items():
        d=v-truth
        standardized=(d/scale)**2
        per_row=np.sqrt(standardized.mean(axis=1))
        j=int(per_row.argmax())
        scores[m]={"scaled_RMSE":float(np.sqrt(standardized.mean())),
                   "RMSE_by_channel":np.sqrt((d**2).mean(axis=0)).tolist(),
                   "scaled_row_RMS_p95":float(np.quantile(per_row,.95)),
                   "three_block_scaled_RMSE":[float(np.sqrt(chunk.mean())) for chunk in np.array_split(standardized,3)],
                   "worst":{"id":401+j,"inputs":X[400+j].tolist(),"target":truth[j].tolist(),
                           "prediction":v[j].tolist(),"scaled_row_RMS":float(per_row[j])}}
    best=min(ARMS[1:],key=lambda k:scores[k]["scaled_RMSE"])
    ours,ref=scores["orbit"],scores[best]
    gates={"all_method_gain":all(ours["scaled_RMSE"]<=.95*scores[m]["scaled_RMSE"] for m in ARMS[1:]),
           "per_channel_guard":all(a<=1.05*b for a,b in zip(ours["RMSE_by_channel"],ref["RMSE_by_channel"])),
           "tail_guard":ours["scaled_row_RMS_p95"]<=ref["scaled_row_RMS_p95"]}
    repeats=[]
    recipes={}
    for i,x in enumerate(X[:80]):
        recipes.setdefault(tuple(x[[0,1,2,3,5]]),{}).update({int(x[4]):i})
    require(len(recipes)==16,"corner design differs")
    for points in recipes.values():
        require(set(points)=={0,90,180,270,360},"corner phases differ")
        original=[points[t] for t in [0,90,180,270,360]]
        repeats.append({"ids":[1+i for i in original],"outputs":Y[original].tolist(),
                        "difference_360_minus_0":(Y[points[360]]-Y[points[0]]).tolist(),
                        "four_quadrant_differences":np.diff(Y[original],axis=0).tolist()})
    report={"schema":"p1.deng.development-recount.v1","forecast_sha256":args.lock_sha256,
            "input_columns":INPUTS,"target_columns":TARGETS,"ids":list(range(401,661)),
            "development_inputs":X[400:].tolist(),"development_coefficients":truth.tolist(),
            "training_scales":scale.tolist(),"scores":scores,"best_control":best,"gates":gates,
            "promotion":all(gates.values()),"reserve_opened":False,"paired_corner_rows":repeats}
    with args.output.open("xb") as f:f.write((json.dumps(report,sort_keys=True,allow_nan=False)+"\n").encode())
    print(json.dumps({"gates":gates,"best_control":best,"scores":scores,"sha256":hashlib.sha256(args.output.read_bytes()).hexdigest()},sort_keys=True))
if __name__=="__main__":main()
