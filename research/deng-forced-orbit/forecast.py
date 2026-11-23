"""Predict forced-motion coefficients in the Deng ledger from the prescribed design."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import math
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
from scipy.linalg import cho_factor, cho_solve
from scipy.optimize import minimize
from scipy.spatial.distance import cdist, pdist
from sklearn.ensemble import HistGradientBoostingRegressor

N = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
TARGETS = ("Cv1","Ca1","Cv2","Ca2")
INPUTS = ("A1non","f1non","A2non","f2non","Theta","Speed")
ARMS = ("orbit", "displacement", "periodic", "linear_angle", "ard", "boost", "nearest", "mean")
ZIP_SHA = "d0110a8c08d1ed6239e18588cd8d947fef935b789a69559503b6f809fd6e24df"

def require(ok, name):
    if not ok:
        raise ValueError(name)

def read_sheet(path, allowed_ids, last_input):
    archive = path.read_bytes()
    require(hashlib.sha256(archive).hexdigest() == ZIP_SHA,"publisher ZIP mismatch")
    with zipfile.ZipFile(io.BytesIO(archive)) as outer:
        book = outer.read("initial_data.csv")
    xs, ys = {}, {}
    with zipfile.ZipFile(io.BytesIO(book)) as z:
        strings = ["".join(t.text or "" for t in el.iter(N+"t")) for el in
                   ET.fromstring(z.read("xl/sharedStrings.xml")).findall(N+"si")]
        with z.open("xl/worksheets/sheet1.xml") as stream:
            for _, row in ET.iterparse(stream, events=("end",)):
                if row.tag != N+"row":
                    continue
                cells = {c.get("r").rstrip("0123456789"):c for c in row.findall(N+"c")}
                def value(col):
                    c = cells[col]
                    v = c.findtext(N+"v")
                    return strings[int(v)] if c.get("t") == "s" else v
                if row.get("r") == "1":
                    require(tuple(value(k) for k in "HIJKLM") == INPUTS and
                            tuple(value(k) for k in "PQRS") == TARGETS, "headers differ")
                elif "A" in cells and value("A") is not None:
                    i = int(value("A"))
                    if 1 <= i <= last_input:
                        require(i not in xs and int(value("N")) == 1,"invalid forward recipe")
                        xs[i] = [float(value(k)) for k in "HIJKLM"]
                    if i in allowed_ids:
                        ys[i] = [float(value(k)) for k in "PQRS"]
                row.clear()
    require(set(xs)==set(range(1,last_input+1)) and set(ys)==set(allowed_ids),"row coverage differs")
    X=np.array([xs[i] for i in sorted(xs)])
    Y=np.array([ys[i] for i in sorted(ys)])
    require(np.isfinite(X).all() and np.isfinite(Y).all() and np.all(X[:,[0,1,2,3,5]]>0),"nonfinite or invalid source")
    return X,Y

def columns(x, kind):
    a,f,b,g,theta,u=x.T
    ang=np.deg2rad(np.mod(theta,360))
    if kind in ("orbit","displacement"):
        orders=(0,1,2) if kind=="orbit" else (0,)
        return [np.column_stack([a*(2*np.pi*f)**i,b*(2*np.pi*g)**i*np.cos(ang),
                                 b*(2*np.pi*g)**i*np.sin(ang)]) for i in orders]+[np.log(f)[:,None],np.log(u)[:,None]]
    common=[q[:,None] for q in [a,np.log(f),b,np.log(u)]]
    return common+([theta[:,None]] if kind=="linear_angle" else [np.column_stack([np.cos(ang),np.sin(ang)])])

def transform(train,query,kind):
    t,q=[],[]
    for a,b in zip(columns(train,kind),columns(query,kind)):
        center=a.mean(axis=0)
        scale=np.sqrt(np.mean((a-center)**2))
        require(scale>0,"zero feature scale")
        t.append((a-center)/scale)
        q.append((b-center)/scale)
    return np.column_stack(t),np.column_stack(q)

def matern(distance):
    s=np.sqrt(3)*distance
    return (1+s)*np.exp(-s)

def kernel_fit(X,Y,Q,hyp):
    distances=cdist(X,X)
    width=np.median(distances[distances>0])*hyp[0]
    matrix=matern(distances/width)
    matrix.flat[::len(X)+1]+=hyp[1]
    return matern(cdist(Q,X)/width)@cho_solve(cho_factor(matrix,lower=True),Y)

def ard(X,Y,Q):
    n,d=X.shape
    delta=(X[:,None,:]-X[None,:,:])**2
    def objective(log_params, solution=False):
        l=np.exp(log_params[:-1]); noise=np.exp(log_params[-1])
        sq=delta/l**2
        r=np.sqrt(3*sq.sum(axis=2))
        exp=np.exp(-r)
        cov=(1+r)*exp
        cov.flat[::n+1]+=noise
        factor=cho_factor(cov,lower=True)
        alpha=cho_solve(factor,Y)
        if solution:
            return matern(cdist(Q/l,X/l))@alpha
        score=(Y*alpha).sum()/2+Y.shape[1]*np.log(np.diag(factor[0])).sum()
        common=Y.shape[1]*cho_solve(factor,np.eye(n))-alpha@alpha.T
        grad=1.5*np.einsum("ij,ij,ijk->k",common,exp,sq)
        return score,np.r_[grad,.5*noise*np.trace(common)]
    fit=minimize(objective,np.r_[np.zeros(d),np.log(.03)],jac=True,method="L-BFGS-B",
                 bounds=[(np.log(.1),np.log(10))]*d+[(np.log(1e-4),0)],options={"maxiter":80})
    require(np.isfinite(fit.fun) and np.isfinite(fit.x).all(),"nonfinite ARD fit")
    return objective(fit.x,True),{"success":bool(fit.success),"status":int(fit.status),"message":str(fit.message),
                                   "iterations":int(fit.nit),"log_params":fit.x.tolist()}

def predict(X,Y,Q,arm,hyp):
    mean,scale=Y.mean(axis=0),Y.std(axis=0)
    require(np.all(scale>0),"zero calibration response scale")
    y=(Y-mean)/scale
    x,q=transform(X,Q,arm if arm in ARMS[:4] else "periodic")
    info={}
    if arm in ARMS[:4]: answer=kernel_fit(x,y,q,hyp)
    elif arm=="ard": answer,info=ard(x,y,q)
    elif arm=="boost":
        answer=np.column_stack([HistGradientBoostingRegressor(max_iter=250,learning_rate=.06,max_leaf_nodes=hyp,
                            l2_regularization=1,early_stopping=False,random_state=747).fit(x,v).predict(q) for v in y.T])
    elif arm=="nearest":answer=y[np.argmin(cdist(q,x),axis=1)]
    else:answer=np.zeros((len(Q),Y.shape[1]))
    result=answer*scale+mean
    require(np.isfinite(result).all(),"nonfinite forecast")
    return result,info

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path);parser.add_argument("output",type=Path)
    args=parser.parse_args()
    X,Y=read_sheet(args.archive,range(1,401),660)
    out={"schema":"p1.deng.forced-lock.v1","target_ids_opened":[1,400],"query_ids":[401,660],
         "training_scales":Y.std(axis=0).tolist(),"arm_order":ARMS,"answers":{}}
    for arm in ARMS:
        choices=([(w,a) for w in (.35,.7,1.4,2.8) for a in (1e-4,.003,.05,.3)] if arm in ARMS[:4]
                 else [7,15,31] if arm=="boost" else [None])
        losses=[]
        for h in choices:
            terms=[]
            if len(choices)>1:
                for end in (160,240,320):
                    pred,_=predict(X[:end],Y[:end],X[end:end+80],arm,h)
                    terms.append(float(np.mean(((pred-Y[end:end+80])/Y[:end].std(axis=0))**2)))
            losses.append(terms)
        selected=int(np.argmin([np.mean(e) for e in losses])) if len(choices)>1 else 0
        pred,info=predict(X[:400],Y,X[400:],arm,choices[selected])
        out["answers"][arm]={"selected":choices[selected],"options":choices,"tune_MSE":losses,
                             "fit":info,"predictions":pred.tolist()}
        print("locked_arm",arm,choices[selected],info.get("status"),flush=True)
    with args.output.open("xb") as f:f.write((json.dumps(out,sort_keys=True,allow_nan=False)+"\n").encode())
    print("LOCK",args.output,args.output.stat().st_size,hashlib.sha256(args.output.read_bytes()).hexdigest(),flush=True)
if __name__=="__main__":main()
