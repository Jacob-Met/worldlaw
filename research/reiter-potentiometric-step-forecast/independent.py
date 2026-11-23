"""Independent direct saddle-point solve and recurrence checks for the finite-horizon course."""
import numpy as np


def solve(row, scale, noise):
    t=np.array(row["hours"]);surf=np.array(row["surface_C"]);v=np.array(row["voltage_mV"])
    times=np.r_[t,11.75]
    decay=np.exp(-times[:,None]/(scale*2.**np.arange(-1,6)[None,:]))
    K=decay@decay.T
    U=np.c_[np.ones(12),t,surf-surf.mean()]
    x=np.array([1,11.75,np.mean(surf[-4:])-np.mean(surf)])
    mat=np.block([[K[:-1,:-1]+noise*np.eye(12),U],[U.T,np.zeros((3,3))]])
    vec=np.r_[K[:-1,-1],x]
    ans=np.linalg.solve(mat,vec)[:12]
    assert max(abs(U.T@ans-x))<1.e-7
    return float(ans@(v-v[-1])+v[-1]),float(np.linalg.norm(ans,ord=1))


def receive(base,original):
    train,dev=base["train"],base["development"]
    groups=lambda rows:sorted({(r["soc"],r["approach"]) for r in rows})
    def scores(rows,values):
        out=[]
        for soc,app in groups(rows):
            err=[a-r["endpoint_mV"] for r,a in zip(rows,values) if (r["soc"],r["approach"])==(soc,app)]
            out.append(float(np.sqrt(np.mean(np.square(err)))))
        return out
    rebuilt=[]
    for _,sc,no in original["training_grid"]:
        pp=[solve(r,sc,no)[0] for r in train]
        rebuilt.append([float(np.mean(scores(train,pp))),sc,no])
    rebuilt.sort()
    assert [r[1:] for r in rebuilt]==[r[1:] for r in original["training_grid"]]
    assert np.allclose(rebuilt,original["training_grid"],rtol=0,atol=1e-8)
    _,sc,no=rebuilt[0];q=[solve(row,sc,no) for row in dev]
    out=[a for a,_ in q];w=[b for _,b in q]
    assert np.allclose(out,original["predictions"],rtol=0,atol=2e-8)
    assert np.allclose(w,original["l1_weights"],rtol=0,atol=2e-7)
    methods={name:[p[name] for p in base["predictions"]] for name in base["predictions"][0]}
    all_values={**methods,"modal":out}
    all_scores={k:scores(dev,v) for k,v in all_values.items()}
    best=min(methods,key=lambda k:np.mean(all_scores[k]));assert best==original["strongest_control"]=="ridge"
    def worst(vals):return max(abs(y-r["endpoint_mV"]) for y,r in zip(vals,dev))
    gates=[len(dev)==80 and not base["dev_fail"],sum(all_scores["modal"])<=.95*sum(all_scores[best]),
           all(x<=1.05*y for x,y in zip(all_scores["modal"],all_scores[best])),
           worst(out)<=1.10*worst(methods[best])]
    assert gates==[True,False,False,False]
    return {"training_controls":len(rebuilt)*len(train),"development":len(dev),"gates":gates,
            "max_prediction_difference_mV":float(np.max(np.abs(np.array(out)-original["predictions"]))),
            "group_rmse_mV":all_scores,"max_weight_difference":float(np.max(np.abs(np.array(w)-original["l1_weights"])))}
