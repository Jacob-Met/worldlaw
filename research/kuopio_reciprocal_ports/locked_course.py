"""Generate training-phantom current forecasts and separately score a digest-locked archive."""
import argparse
import hashlib
import io
import json
import struct
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from scipy.io import loadmat

from port_forecast import ROLE_NAMES, predict, source_calibration, split_drives
from training_qualification import ROOT, read

FILES = {
  2:"a286e50e8670e36c96030c7dcf493e05d9a02d30",3:"f6767e5771aaf894e7da258f3dac91444f146f0a",4:"c558b3e0d93775714634b40117742428e9831e95"
}
QCOL = [17,31,32,35,36,47,51,54,55,62,66,70,73,74]
PRIMARY = "reference_reciprocal_gls"
CORE = ["reference_repeat","reference_superposition","reference_reciprocal","reference_reciprocal_gls_wrong_electrode_order"]
STRONG = ["reference_repeat_source_bias","source_blend"]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def fetch(i):
    with urllib.request.urlopen(ROOT+f"data{i}.mat",timeout=40) as f:
        b=f.read(40585)
    assert len(b)==40584 and hashlib.sha1(b"blob 40584\0"+b).hexdigest()==FILES[i]
    return b


def elements(data):
    pos=0
    while pos<len(data):
        tag, size = struct.unpack_from("<II",data,pos)
        if tag>>16:
            typ=tag&65535;size=tag>>16
            assert 0<size<=4
            yield typ,data[pos+4:pos+4+size]
            pos+=8
        else:
            assert pos+8+size<=len(data)
            yield tag,data[pos+8:pos+8+size]
            pos+=(8+size+7)//8*8
    assert pos==len(data)


def voltage_columns(payload, columns):
    source=memoryview(payload)
    assert bytes(source[126:128])==b"IM"
    for typ,matrix in elements(source[128:]):
        assert typ==14,"compressed or unknown MATLAB array, cannot selectively decode"
        parts=list(elements(matrix))
        assert len(parts)==4
        if bytes(parts[2][1])!=b"Uel":
            continue
        assert struct.unpack("<ii",parts[1][1])==(2356,1)
        assert parts[3][0]==9 and len(parts[3][1])==31*76*8
        data=parts[3][1]
        return np.column_stack([np.frombuffer(data[int(i)*248:(int(i)+1)*248],dtype="<f8") for i in columns])
    raise ValueError("Missing Uel")


def sources():
    water=read("ref.mat",19121,"712400865cb405d88730144db2f4774a0dcaac0c",["Injref","Mpat","Uelref"])
    data=read("data1.mat",40584,"1448d1f56ce290b51d9deea6bfc1af8506aeda6b",["Inj","Mpat","Uel"])
    j,b,y0=water["Injref"],water["Mpat"],water["Uelref"].reshape(76,31).T
    y1=data["Uel"].reshape(76,31).T
    assert np.array_equal(data["Inj"],j) and np.array_equal(data["Mpat"],b)
    train,q,d=split_drives(j)
    assert (q+1).tolist()==QCOL and len(train)==62
    return j,b,y0,train,q,source_calibration(j,b,y0,y1)


def entry_name(i,n):
    return f"phantom{i}/{n}.f64le"


def packed(arr):
    return np.ascontiguousarray(arr,dtype="<f8").tobytes()


def run_forecast(path):
    j,b,y0,train,q,config=sources()
    members={}
    for i in FILES:
        raw=fetch(i)
        meta=loadmat(io.BytesIO(raw),variable_names=["Inj","Mpat"])
        assert np.array_equal(meta["Inj"],j) and np.array_equal(meta["Mpat"],b)
        admitted=voltage_columns(raw,train)
        roles=predict(meta["Inj"],meta["Mpat"],y0,admitted,config,j)
        for name,arr in roles.items():
            members[entry_name(i,name)]=packed(arr)
    members["manifest.json"]=(json.dumps({"schema":"ktc.voltages.1","shape":[31,14],"roles":list(ROLE_NAMES),
      "physical_training_phantoms":list(FILES),"columns_one_based":QCOL,"source_blend":config[-1],
      "inputs_git_blobs":FILES,"sha256":{k:sha(v) for k,v in members.items()}},sort_keys=True)+"\n").encode()
    with zipfile.ZipFile(path,"w") as z:
        for k,v in sorted(members.items()):
            info=zipfile.ZipInfo(k,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,v)
    print(json.dumps({"forecast_sha256":sha(path.read_bytes()),"forecast_bytes":path.stat().st_size,"scientific_arrays":33,
                      "values":int(len(ROLE_NAMES)*3*31*14),"query_values_decoded":0}),flush=True)


def run_score(path, expected):
    assert sha(path.read_bytes())==expected
    expected_files={entry_name(i,n) for i in FILES for n in ROLE_NAMES}
    with zipfile.ZipFile(path) as z:
        assert len(z.namelist())==34 and set(z.namelist())==expected_files|{"manifest.json"}
        m=json.loads(z.read("manifest.json"));assert m["roles"]==list(ROLE_NAMES) and m["columns_one_based"]==QCOL
        assert set(m["sha256"])==expected_files
        pred={}
        for k in sorted(expected_files):
            content=z.read(k);assert len(content)==31*14*8 and sha(content)==m["sha256"][k]
            pred[k]=np.frombuffer(content,dtype="<f8").reshape(31,14)
    _,_,_,_,q,config=sources()
    noise_inv=np.linalg.inv(config[0])
    rows={}
    for i in FILES:
        truth=voltage_columns(fetch(i),q)
        assert truth.shape==(31,14) and np.isfinite(truth).all()
        values={}
        for role in ROLE_NAMES:
            y=pred[entry_name(i,role)];res=y-truth
            e,k=np.unravel_index(abs(res).argmax(),res.shape)
            values[role]={"rmse_V":float(np.mean(res**2)**.5),"mae_V":float(np.mean(abs(res))),
              "whitened_rms":float((np.einsum("ik,ij,jk->",res,noise_inv,res)/res.size)**.5),
              "per_pattern_rmse_V":np.mean(res**2,axis=0)**.5,
              "worst":{"edge":int(e+1),"col":int(q[k]+1),"prediction_V":float(y[e,k]),"target_V":float(truth[e,k]),"abs_error_V":float(abs(res[e,k]))}}
            values[role]["per_pattern_rmse_V"]=values[role]["per_pattern_rmse_V"].tolist()
        rows[str(i)]=values
    means={r:float(np.mean([x[r]["rmse_V"] for x in rows.values()])) for r in ROLE_NAMES}
    def passes(controls):
        return all(means[PRIMARY]<means[c] and sum(x[PRIMARY]["rmse_V"]<x[c]["rmse_V"] for x in rows.values())>=2 for c in controls)
    return dict(schema="ktc.training.voltage-receipt.v1",archive_sha256=expected,per_phantom=rows,mean_phantom_rmse_V=means,
                primary_core=passes(CORE),stronger_controls=passes(STRONG),joint=passes(CORE+STRONG),
                held_pattern_cells=1302,official_challenge_phantoms_opened=0,photos_opened=0)


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("action",choices=["forecast","score"]);p.add_argument("archive",type=Path);p.add_argument("--sha")
    a=p.parse_args()
    if a.action=="forecast":run_forecast(a.archive)
    else:print(json.dumps(run_score(a.archive,a.sha),sort_keys=True))
