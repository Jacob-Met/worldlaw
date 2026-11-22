"""Lock carbon predictions from measured optical inputs and nine calibration batches."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from inverse import optical


def save(path, obj):
    payload=(json.dumps(obj,sort_keys=True,allow_nan=False)+"\n").encode()
    with path.open("xb") as f:
        f.write(payload)
    return hashlib.sha256(payload).hexdigest()


def chemical_anchors(train,chem):
    s=np.array([w["salinity"] for w in train])
    ta=np.array([chem[str(w["batch"])]["TA"] for w in train])
    k=float(s@ta/(s@s))
    a=np.linalg.lstsq(np.c_[np.ones(len(s)),s],ta,rcond=None)[0]
    return k,a


def ridge_inputs(w):
    t=np.array(w["temp"]); ph=np.array(w["pH"])
    j=int(np.argmin(abs(t-25.)))
    coeff=np.polyfit((t-25.)/20.,ph,2)
    return [w["salinity"],ph[j],*coeff[:2],w["salinity"]*ph[j]]


def ridge(train,chem,test):
    x=np.array([ridge_inputs(w) for w in train]);xt=np.array([ridge_inputs(w) for w in test])
    y=np.array([[chem[str(w["batch"])][k] for k in ("TA","DIC")] for w in train])
    std=x.std(axis=0);std[std<1e-12]=1.
    xc=(x-x.mean(axis=0))/std
    beta=np.linalg.solve(xc.T@xc+np.eye(xc.shape[1]),xc.T@(y-y.mean(axis=0)))
    return y.mean(axis=0)+(xt-x.mean(axis=0))/std@beta


def run(inputs, calibration, split):
    versions={};waves={}
    for w in inputs:
        i=w["batch"];waves[i]=w
        versions[i]=optical(w["salinity"],w["temp"],w["pH"],w["PO4"],w["Si"])
    out={}
    def fold(train_ids, test_ids):
        train=[waves[i] for i in train_ids];test=[waves[i] for i in test_ids]
        k,coef=chemical_anchors(train,calibration);emp=ridge(train,calibration,test)
        # The slope deviation is estimated on calibration water only. Report a
        # 2 µmol/kg minimum scale explicitly even for identical calibration rows.
        scale=max(2.,float(np.sqrt(np.mean([(calibration[str(w["batch"])]["TA"]-k*w["salinity"])**2 for w in train]))))
        for j,w in enumerate(test):
            i=w["batch"];s=w["salinity"];v=versions[i]; z=np.array(v["z"]);b=np.array(v["buffer"])
            t=np.array(w["temp"]);idx=int(np.argmin(abs(t-25.)))
            p={name:v[name] for name in ("minimax","ols","scaled_ls","endpoint_pair")}
            aa=k*s
            for n,anchor in (("nominal",66.*s),("conservative",aa),("affine",float(coef@[1,s]))):
                d=(anchor-b)/z;p[n+"_one_bath"]=[anchor,float(d[idx])]
                p[n+"_nine_bath"]=[anchor,float(np.median(d))]
            p["ridge"]=emp[j].tolist()
            # Fit one common TA and DIC. Give the whole optical trajectory one
            # block of weight against the independent same-stock TA constraint.
            X=np.column_stack((np.ones_like(z),-z))
            optical_sd=np.array(v["pH_concentration_scale"])*.003*np.sqrt(len(t))
            M=np.vstack((X/optical_sd[:,None],[1./scale,0.]))
            rhs=np.r_[b/optical_sd,aa/scale]
            from scipy.optimize import lsq_linear
            p["anchored_inverse"]=lsq_linear(M,rhs,bounds=(0.,np.inf)).x.tolist()
            out[i]={"predictions":p,"optical":v,"calibration_TA_per_S":k,
                    "calibration_TA_rms_floor2":scale,"closest_bath_C":float(t[idx])}
    cal=split["calibration"]
    for i in cal:
        fold([j for j in cal if j!=i],[i])
    fold(cal,split["held"])
    return out


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("input_directory",type=Path);p.add_argument("output",type=Path);a=p.parse_args()
    def get(n):return json.loads((a.input_directory/n).read_bytes())
    forecast=run(get("optical-inputs.json"),get("calibration-assays.json"),get("split.json"))
    print(save(a.output,forecast))
