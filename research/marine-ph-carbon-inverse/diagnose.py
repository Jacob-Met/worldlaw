"""Describe frozen bath residuals; certify an infeasible stored linear system exactly."""
from fractions import Fraction as F
from itertools import combinations
import json
from pathlib import Path
import sys
import numpy as np
from scipy.optimize import linprog
import PyCO2SYS as co
from inverse import BASE


def dual_certificate(w,temps):
    zl,bl,zh,bh=w
    eq=[]
    for j,t in enumerate(temps):
        eq.append(([-1.,zl[j]],-bl[j],f"TA_lower_bath_{j+1}"))
        eq.append(([1.,-zh[j]],bh[j],f"TA_upper_bath_{j+1}"))
    eq.extend((([-1.,0.],0.,"nonnegative_TA"),([0.,-1.],0.,"nonnegative_DIC")))
    X=np.array([v[0] for v in eq]);b=np.array([v[1] for v in eq])
    lp=linprog(b,A_eq=np.vstack([X.T,np.ones(len(b))]),b_eq=[0.,0.,1.],bounds=(0,None),method="highs")
    if not lp.success or lp.fun>=-1e-8:return None
    # Enumerate only if the numerical optimum was degenerate. Each retained
    # certificate is then independently verified on the exact stored doubles.
    first=tuple(np.flatnonzero(lp.x>1e-9))
    trys=[first,*combinations(range(len(b)),3)]
    for idx in trys:
        if len(idx)!=3:continue
        rows=[tuple(F(n) for n in eq[i][0]) for i in idx]
        wt=[rows[(i+1)%3][0]*rows[(i+2)%3][1]-rows[(i+1)%3][1]*rows[(i+2)%3][0] for i in range(3)]
        if all(x<=0 for x in wt):wt=[-x for x in wt]
        if min(wt)<0 or sum(wt)==0:continue
        norm=sum(wt);wt=[v/norm for v in wt]
        if any(sum(v*r[c] for v,r in zip(wt,rows)) for c in (0,1)):raise ArithmeticError("dual equations")
        rhs=sum(v*F(eq[i][1]) for v,i in zip(wt,idx))
        if rhs>=0:continue
        return {"rows":[eq[i][2] for i in idx],"weights":[str(x) for x in wt],
                "combined_left":[0,0],"combined_rhs_rational":str(rhs),"combined_rhs":float(rhs)}
    raise ValueError("no exact certificate")


def run(root):
    opt=json.loads((root/"optical-inputs.json").read_bytes())
    truth=json.loads((root/"all-assays.json").read_bytes());locked=json.loads((root/"locked.json").read_bytes())
    out={}
    for w in opt:
        i=str(w["batch"]);a=truth[i]["TA"];c=truth[i]["DIC"]
        tt=np.array(w["temp"]);s=w["salinity"]
        pred=co.sys(par1=a,par1_type=1,par2=c,par2_type=2,temperature=tt,salinity=s,
                    total_phosphate=w["PO4"],total_silicate=w["Si"],**BASE)["pH_total"]
        dif=pred-np.array(w["pH"]);j=int(np.argmax(abs(dif)));v=locked[i]["optical"]
        cert=dual_certificate(v["pH_strip_coefficients"]["0.003"],tt)
        if (cert is not None)!=(2 in v["engineering_pH_strips"]["0.003"]["status"]):
            raise ValueError("exact infeasibility and recorded statuses disagree")
        out[i]={"bath_T":tt.tolist(),"measured_pH":w["pH"],"lab_assay_forward_pH":pred.tolist(),"forward_error":dif.tolist(),
                "worst_index":j,"worst_signed_forward_error":float(dif[j]),"certificate_at_0.003":cert}
    (root/"bath-diagnostics.json").write_text(json.dumps(out,sort_keys=True,allow_nan=False)+"\n")
    print("HELD_WORST_BATCH_26",json.dumps(out["26"],sort_keys=True))


if __name__=="__main__":
    run(Path(sys.argv[1]))
