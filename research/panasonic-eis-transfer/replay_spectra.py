#!/usr/bin/env python3
"""Rebuild fixed pulse forecasts using EIS and measured current history only."""
import argparse
import csv
import io
import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.optimize import linprog,lsq_linear

from compare_response import read_plan,source_bytes
from passive_envelope import fit_models,predict_point,relaxed_cone,envelope,stack


def extended_models(w,z):
    tau=np.geomspace(1e-8,1e7,256)
    kernel=np.column_stack([np.ones(len(w)),1j*w/max(w),(1+tau)/(1+1j*w[:,None]*tau)])
    # Minimax in absolute rectangular real/imaginary residual units.
    design=stack(kernel)
    a=np.r_[design,-design]
    b=np.r_[stack(z),-stack(z)]
    n=kernel.shape[1]
    mm=linprog(np.r_[np.zeros(n),1.],A_ub=np.c_[a,-np.ones(len(b))],b_ub=b,
               bounds=(0.,None),method="highs")
    if not mm.success:raise ArithmeticError(mm.message)
    x=np.maximum(mm.x[:-1],0.)
    minimax=float(max(abs(design@x-stack(z))))
    # Least-squares point fit normalizes each complex residual by |Z|.
    design=stack(kernel/np.abs(z[:,None]))
    norms=np.linalg.norm(design,axis=0)
    fit=lsq_linear(design/norms,stack(z/np.abs(z)),bounds=(0,np.inf),method="bvls",
                   tol=1e-12,max_iter=1000)
    if not fit.success:raise ArithmeticError(fit.message)
    result={}
    for name,c in [("DRT256-relative-L2",np.maximum(fit.x/norms,0.)),("DRT256-minimax",x)]:
        c=c.copy();c[2:]*=1+tau
        result[name]=(tau,c,None)
    return result,minimax


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir",type=Path,help="Extracted dataset root; otherwise use pinned public files")
    args=parser.parse_args()
    plan=read_plan()
    raw=source_bytes(plan,plan["source_file"],plan["source_sha256"],args.source_dir)
    m=loadmat(io.BytesIO(raw),squeeze_me=True,struct_as_record=False)["meas"]
    clock,current=np.asarray(m.Time),-np.asarray(m.Current)
    del m
    rows=[dict(zip(plan["columns"],row)) for row in plan["rows"]]
    worst_point=0.;worst_interval=0.;witness=[]
    for spec,digest in sorted(plan["eis_sha256"].items()):
        raw=source_bytes(plan,plan["eis_dir"]+"/"+spec,digest,args.source_dir).decode("latin1").splitlines()
        j=next(i for i,line in enumerate(raw) if line.startswith("Time Stamp;"))
        cells=list(csv.DictReader([raw[j]]+[v for v in raw[j+2:] if v.strip()],delimiter=";"))
        w=2*np.pi*np.array([float(r["ActFreq"]) for r in cells])
        z=np.array([complex(float(r["Zreal1"]),float(r["Zimg1"])) for r in cells])
        models=fit_models(w,z)
        tolerance=max(1.,1.25*max(abs(stack(z-models["DRT80"][2]))))
        extra,minimum=extended_models(w,z);models.update(extra);witness.append(minimum)
        if minimum>1.:
            raise ValueError(f"No constructive fixed-band witness for {spec}")
        cones={"strict":relaxed_cone(w,z,1.),"sensitivity":relaxed_cone(w,z,tolerance)}
        for row in (r for r in rows if r["spectrum"]==spec):
            a,k=row["start"],row["target_row"]-row["start"]
            t=clock[a:a+k+1]-clock[a];i=current[a:a+k+1]
            points={n:predict_point(tau,c,i,t,k) for n,(tau,c,_) in models.items()}
            bands={}
            for tag,cone in cones.items():
                for hist,cap in [("zero",0.),("prehistory25A",25.)]:
                    label=hist if tag=="strict" else "sensitivity_"+hist
                    bands[label],_=envelope(cone,t,i,k,row["observed_rest_seconds"],cap,clock[a]-clock[a-1])
            points["strict-zero-midpoint"]=sum(bands["zero"])/2
            worst_point=max(worst_point,max(abs(points[n]-v) for n,v in zip(plan["point_names"],row["point_drop_mV"])))
            worst_interval=max(worst_interval,max(max(abs(np.array(bands[n])-v)) for n,v in zip(plan["interval_names"],row["interval_drop_mV"])))
    summary={"rows":len(rows),"max_point_replay_difference_mV":worst_point,"max_band_replay_difference_mV":worst_interval,
             "max_constructive_EIS_error_mohm":max(witness),"source_mat_decoded_as_whole":True,"poststep_voltage_used_for_predictions":False}
    print(json.dumps(summary,sort_keys=True))
    # Optimizer versions can select different minimax witnesses; compare native
    # dependency-matched runs at the published numerical replay tolerance.
    if worst_point>1e-4 or worst_interval>1e-4:
        raise SystemExit("Native forecast replay tolerance exceeded")


if __name__=="__main__":main()
