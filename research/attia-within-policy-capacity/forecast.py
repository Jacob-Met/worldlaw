"""Materialize only features and forecasts available at cycle 100, under the author row contract."""
import codecs
import csv
import hashlib
import io
import json
import pickle
import sys
import urllib.request
from pathlib import Path
from urllib.parse import quote

import numpy as np
from scipy.io import loadmat

from early_capacity import correction, representations


AUTHOR = "https://raw.githubusercontent.com/petermattia/battery-parameter-spaces/ec9508f9d2d6098f6e9a46dfaf79a222e65d7491/"
BMS = "https://raw.githubusercontent.com/chueh-ermon/BMS-autoanalysis/c82ab7704211a6aee75bd926714b82d1f95e1a0e/"
PINS = {"Validation/05-Mar-2019_batch9_predictions.csv":"be3e1aa4717e9a4d26f8a620b6d7dc297253c058",
        "Validation/predictions.csv":"cdd31ef6435b9d8cc57000dd849f9df5ceb03f79",
        "Validation/electrochem/Qn.csv":"0a884557d705c9e3bb2a2fa125e728fb77cd3cd7",
        "Validation/electrochem/QV_100_10.csv":"07eb7435dfa4f904912932bd5d1e2a5d19b8775b",
        "data/bounds/4_bounds.pkl":"5d38531f48cc01ecb9b54fe7d2f4487e519d7454",
        "oed_model.mat":"2fa749de6972dcab751efd0686929d8ac87499fa"}


def source(path):
    b=urllib.request.urlopen((BMS if path=="oed_model.mat" else AUTHOR)+quote(path),timeout=45).read()
    if hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()!=PINS[path]:
        raise ValueError(path)
    return b


def table(path):
    return list(csv.reader(io.StringIO(source(path).decode("utf-8-sig"))))


class NumericBounds(pickle.Unpickler):
    def find_class(self,module,name):
        known={("numpy.core.multiarray","_reconstruct"):np.core.multiarray._reconstruct,
               ("numpy","ndarray"):np.ndarray,("numpy","dtype"):np.dtype,
               ("_codecs","encode"):codecs.encode}
        if (module,name) not in known:
            raise ValueError((module,name))
        return known[module,name]


def author_checkpoint(q,delta):
    weights=loadmat(io.BytesIO(source("oed_model.mat")),squeeze_me=True)
    idx=np.asarray(weights["feat_ind"],dtype=int)-1
    if idx.tolist()!=[0,1,7,9,10]:
        raise ValueError("Unexpected feature indices")
    centered=delta-delta.mean(axis=1,keepdims=True)
    skew=np.mean(centered**3,axis=1)/np.mean(centered**2,axis=1)**1.5
    features=np.column_stack((q[:,1],np.nanmax(q,axis=1)-q[:,1],np.log10(np.abs(delta.min(axis=1))),
                              np.log10(delta.var(axis=1,ddof=1)),np.log10(np.abs(skew))))
    x=(features-weights["mu"][idx])/weights["sigma"][idx]
    v=x @ weights["B1"] + weights["y_mu"]
    design=np.column_stack((x,np.ones(len(x))))
    se=weights["t_val"]*np.sqrt(weights["MSE"]*(1+np.sum(design*np.linalg.solve(weights["des_mat"],design.T).T,axis=1)))
    pred=10**v
    widths=10**(v+se)-10**(v-se)
    return pred,widths


def forecast(root,model_hash):
    data=(root/"historical-model.json").read_bytes()
    if hashlib.sha256(data).hexdigest()!=model_hash:
        raise ValueError("Historical weight lock")
    model=json.loads(data)
    rows=table("Validation/05-Mar-2019_batch9_predictions.csv")
    head=rows[0]
    # The author also supplies a Lifetime column. The predictor only selects these four early fields.
    names=("Channel","Barcode","Prediction","Policy")
    ch,bc,e,policy=zip(*[tuple(row[head.index(x)] for x in names) for row in rows[1:]])
    ch=np.asarray(ch,dtype=int);e=np.asarray(e,dtype=float)
    groups=[tuple(map(float,x.split("-")[:3])) for x in policy]
    compact=table("Validation/predictions.csv")
    accept=np.ones(len(ch),dtype=bool)
    for row in compact[1:]:
        members=[i for i,g in enumerate(groups) if g==tuple(map(float,row[:3]))]
        if len(members)!=5:raise ValueError("Expected five per protocol")
        for i,v in zip(members,row[3:],strict=True):
            if not v.strip() or v.strip().lower()=="nan":accept[i]=False
            elif e[i]!=float(v):raise ValueError("Raw/compact identity mismatch")
    assert len(bc)==len(set(bc))==len(set(ch))==45 and ch[~accept].tolist()==[12]
    # Trusted prefix extractor hashes the original release bytes, then selects only columns 0..99.
    # Neither row lengths, post-cycle-100 values nor endpoint-dependent padding enter forecasting.
    rawq=source("Validation/electrochem/Qn.csv")
    q=np.loadtxt(io.BytesIO(rawq),delimiter=",",usecols=range(100))
    delta=np.loadtxt(io.BytesIO(source("Validation/electrochem/QV_100_10.csv")),delimiter=",")
    assert q.shape==(45,100) and delta.shape==(45,1000)
    spans,_,_,centers=NumericBounds(io.BytesIO(source("data/bounds/4_bounds.pkl")),encoding="latin1").load()
    center={tuple(row):float(v) for row,v in zip(spans,np.asarray(centers).reshape(-1),strict=True)}
    clo=np.array([center[g] for g in groups])
    recalculated,width=author_checkpoint(q,delta)
    z=representations(q[accept])
    accepted_idx=np.flatnonzero(accept)
    def center_anchor(raw,shrink):
        out=clo.copy()
        for g in set(groups):
            loc=np.array([groups[i]==g for i in accepted_idx])
            vals=np.asarray(raw)[loc]
            out[accepted_idx[loc]]+=shrink*(vals-vals.mean())
        return out
    def common_fallback(vals):
        out=clo.copy()
        out[accept]=np.asarray(vals)[accept]
        return out
    forecasts={"CLO":clo,"archived_early":common_fallback(e),
               "checkpoint_replay":common_fallback(np.floor(recalculated+0.5)),
               "early_centered":center_anchor(e[accept],1.0),
               "early_shrunk":center_anchor(e[accept],model["shrink"]["early"])}
    for k in ("raw","scalar","shape"):
        forecasts[k]=center_anchor(e[accept]+correction(z[k],model["models"][k]),model["shrink"][k])
    shuffle=z["shape"].copy()
    for g in set(groups):
        loc=np.flatnonzero(np.array([groups[i]==g for i in accepted_idx]))
        order=loc[np.argsort(ch[accepted_idx[loc]])]
        shuffle[order]=z["shape"][np.roll(order,1)]
    forecasts["shape_sham"]=center_anchor(e[accept]+correction(shuffle,model["models"]["shape"]),model["shrink"]["shape"])
    assert all(np.isfinite(v).all() and v[~accept][0]==clo[~accept][0] for v in forecasts.values())
    rec_err=np.abs(recalculated[accept]-e[accept])
    w=accepted_idx[np.argmax(rec_err)]
    output={"source_blobs":PINS,"model_sha256":model_hash,"channel":ch.tolist(),"barcode":list(bc),
            "policy":groups,"accepted":accept.tolist(),"forecasts":{k:v.tolist() for k,v in forecasts.items()},
            "checkpoint":{"max_abs_unrounded_error_vs_archived":float(max(rec_err)),
                          "max_abs_rounded_error_vs_archived":float(max(abs(np.floor(recalculated[accept]+0.5)-e[accept]))),
                          "worst_channel":int(ch[w]),"raw_checkpoint":float(recalculated[w]),"archived":float(e[w]),
                          "interval_flag_channels":ch[width>2000].tolist()},
            "validation_lifetimes_selected":False,"held_suffix_fields_selected":False}
    path=root/"locked-45-forecasts.json"
    path.write_text(json.dumps(output,sort_keys=True,allow_nan=False))
    print(json.dumps({"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size,
                      "roles":list(forecasts),"accepted":int(accept.sum()),"checkpoint":output["checkpoint"]}))


if __name__=="__main__":
    forecast(Path(sys.argv[1]),sys.argv[2])
