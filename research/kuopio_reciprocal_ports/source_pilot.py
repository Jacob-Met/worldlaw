import json
import numpy as np
from scipy.linalg import block_diag
from port_forecast import frame, regress, split_drives, source_calibration, predict
from training_qualification import read


def check_dense():
    rng=np.random.default_rng(730)
    p=3; edges=6; m=11
    k=rng.normal(size=(p,m)); kq=rng.normal(size=(p,4)); c=rng.normal(size=(edges,p))
    noise0=rng.normal(size=(edges,edges)); noise=noise0@noise0.T+np.eye(edges)
    ev,vec=np.linalg.eigh(k@k.T)
    h=(vec*(1/ev))@vec.T; gi=(vec*np.sqrt(ev))@vec.T
    y=rng.normal(size=(edges,m))
    _,obtained=regress(y,(c,k,kq,h,gi),noise)
    parameters=[]
    for index in range(edges*p):
        x=np.zeros((edges,p));x.flat[index]=1
        parameters.append(x)
    design=np.array([(x@k).ravel() for x in parameters]).T
    constraints=np.array([[(c.T@x)[i,j]-(c.T@x)[j,i] for i in range(p) for j in range(i)] for x in parameters]).T
    weight=np.kron(np.linalg.inv(noise),np.eye(m))
    matrix=np.block([[design.T@weight@design,constraints.T],[constraints,np.zeros((len(constraints),len(constraints)))]])
    rhs=np.concatenate((design.T@weight@y.ravel(),np.zeros(len(constraints))))
    solution=np.linalg.solve(matrix,rhs)[:edges*p].reshape(edges,p)
    err=float(abs(solution@kq-obtained).max())
    assert err<1e-10
    return err


def main():
    ref=read("ref.mat",19121,"712400865cb405d88730144db2f4774a0dcaac0c",["Injref","Mpat","Uelref"])
    data=read("data1.mat",40584,"1448d1f56ce290b51d9deea6bfc1af8506aeda6b",["Inj","Mpat","Uel"])
    j,b=ref["Injref"],ref["Mpat"]; v0=ref["Uelref"].reshape(76,31).T;v1=data["Uel"].reshape(76,31).T
    assert np.array_equal(j,data["Inj"]) and np.array_equal(b,data["Mpat"])
    tr,q,d=split_drives(j)
    config=source_calibration(j,b,v0,v1)
    roles=predict(j,b,v0,v1[:,tr],config,j)
    results={}
    for name,values in roles.items():
        delta=values-v1[:,q]
        e,c=np.unravel_index(abs(delta).argmax(),delta.shape)
        results[name]={"rmse_V":float(np.mean(delta**2)**.5),"max_abs_V":float(abs(delta[e,c])),
                       "measurement_edge_one_based":int(e+1),"acquisition_column_one_based":int(q[c]+1),
                       "predicted_V":float(values[e,c]),"recorded_V":float(v1[e,q[c]])}
    print(json.dumps({"separate_dense_constrained_error":check_dense(),"source_blend":config[-1],"noise_eigenvalue_range_V2":np.linalg.eigvalsh(config[0])[[0,-1]].tolist(),"source_case":"training phantom 1, includes source-calibrated weights/bias; diagnostic only",
                      "input_columns":(tr+1).tolist(),"target_columns":(q+1).tolist(),"roles":results},sort_keys=True))


if __name__=="__main__":
    main()
