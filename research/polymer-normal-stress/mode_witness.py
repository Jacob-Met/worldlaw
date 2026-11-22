"""Reconstruct the frozen input-only optimizer and resolve its physical-mode contributions."""
import json
from pathlib import Path
import sys
import numpy as np
from scipy.optimize import linprog


def witness(data, frozen):
    receipt = {}
    for k, forecast in sorted(frozen.items()):
        material, t=k.split("/")
        tables=data[material]["dynamic"]
        lower, upper=("20","30") if t=="25" else (t,t)
        w, a, b=np.asarray(tables[lower]).T
        w2, c, d=np.asarray(tables[upper]).T
        assert np.array_equal(w,w2)
        gp,gpp=np.sqrt(a*c),np.sqrt(b*d)
        g=np.asarray(forecast["rates"])
        eta=np.asarray(forecast["torque_input_viscosity"])
        lam=np.repeat(np.geomspace(1e-4,1e3,36),7)
        damp=np.tile([0.,.01,.03,.1,.3,1.,3.],36)
        wl=w[:,None]*lam
        z=g[:,None]*lam
        dec=1+z*damp
        X=np.vstack([np.column_stack([wl**2/(1+wl**2),w*0]),
                     np.column_stack([wl/(1+wl**2),w]),
                     np.column_stack([lam/dec**2,np.ones(len(g))])])
        N=np.column_stack([2*z**2/dec**3,np.zeros(len(g))])
        y=np.r_[gp,gpp,eta]
        d=X/y[:,None];scale=d.max(axis=0);D=d/scale
        B=np.r_[D,-D];rhs=np.r_[np.ones(len(y)),-np.ones(len(y))]
        cc=np.r_[np.zeros(D.shape[1]),1.]
        sol=linprog(cc,A_ub=np.column_stack([B,-np.ones(len(rhs))]),b_ub=rhs,bounds=(0,None),method="highs")
        assert sol.success
        weights=sol.x[:-1]/scale
        saved=np.asarray(forecast["minimax"])
        actual=N@weights
        assert np.allclose(actual,saved,rtol=1e-10,atol=1e-8)
        er=np.abs(X@weights/y-1)
        assert max(er)<=forecast["minimum_relative_input_error"]+1e-9 and np.min(weights)>=-1e-10
        rec={"active_atoms":int(sum(weights[:-1]>0)),"solvent_pa_s":float(weights[-1]),
             "absolute_prediction_reconstruction_max_pa":float(max(abs(saved-actual))),
             "maximum_relative_input_residual":float(max(er)),
             "minimum_weight":float(min(weights))}
        if k=="2490/0":
            j=int(np.where(g==100.)[0][0])
            atoms=[{"lambda_s":float(L),"damping_b":float(B),"modulus_pa":float(W),
                    "normal_pa":float(N[j,i]*W),"viscosity_pa_s":float(X[-1,i]*W)}
                   for i,(L,B,W) in enumerate(zip(lam,damp,weights[:-1])) if W>0]
            rec["100_per_s_atoms"]=sorted(atoms,key=lambda x:-x["normal_pa"])
            rec["all_rate_predictions_pa"]=actual.tolist()
            rec["relative_input_residuals"]={"storage":er[:len(w)].tolist(),"loss":er[len(w):2*len(w)].tolist(),
                                             "viscosity":er[2*len(w):].tolist()}
        receipt[k]=rec
    return receipt


if __name__=="__main__":
    p,q=map(Path,sys.argv[1:]);print(json.dumps(witness(json.loads(p.read_bytes()),json.loads(q.read_bytes())),sort_keys=True))
