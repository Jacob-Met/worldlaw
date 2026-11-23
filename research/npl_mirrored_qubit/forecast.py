"""Fit the preregistered idle-prefix models. No held count dictionaries are parsed."""
import ast
import csv
import hashlib
import io
import itertools
import json
import math
import re
import sys
import urllib.request
from collections import defaultdict

import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln

CSV_SHA = "3917448673855c2e6a7276c078f8f53de5450e9ffb2bef90f2d129b5b72d31a7"
BASES = "XYZ"
EPS = 1e-9
ROLES = ["single", "static", "dynamic", "single_spam", "static_spam", "dynamic_spam",
         "free_static_spam", "constant", "last", "var1", "var2"]


def design():
    meta = json.load(urllib.request.urlopen("https://zenodo.org/api/records/8363718", timeout=40))
    f = next(f for f in meta["files"] if f["size"] == 832470)
    raw = urllib.request.urlopen(f["links"].get("content",f["links"]["self"]), timeout=40).read()
    assert hashlib.sha256(raw).hexdigest() == CSV_SHA
    groups = defaultdict(list)
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        groups[row["job_id"]].append(row)
    jobs = []
    for job, rows in groups.items():
        if all(float(row["theta_full"]) == 0 for row in rows):
            assert len(rows)==6 and len(set(row["completion_date"] for row in rows))==1
            basis = {b:[r for r in rows if r["measurement_basis"]==b] for b in BASES}
            assert all(len(v)==2 for v in basis.values())
            assert all([int(n) for n in row["n"].strip()[1:-1].split()]==list(range(0,151,10)) for row in rows)
            jobs.append((rows[0]["completion_date"], job, basis))
    assert len(groups)==288 and len(jobs)==18
    return sorted(jobs, key=lambda x:(x[0],x[1]))


def count0(text):
    row = ast.literal_eval(text)
    assert isinstance(row,dict) and all(isinstance(v,int) and v>=0 for v in row.values())
    parsed = {}
    for k,v in row.items():
        key = int(str(k),16) if str(k).lower().startswith("0x") else int(k)
        assert key in (0,1) and key not in parsed
        parsed[key]=v
    assert sum(parsed.values()) == 1024
    return parsed.get(0, 0)


def prefix(basis):
    out = np.empty((10,3,2),dtype=int)
    for bi,b in enumerate(BASES):
        for rep,row in enumerate(basis[b]):
            # The regex iterator stops at the tenth dictionary; suffix dictionaries are never converted.
            chunks = list(itertools.islice(re.finditer(r"\{[^{}]*\}",row["counts"]),10))
            assert len(chunks)==10
            out[:,bi,rep] = [count0(v.group()) for v in chunks]
    return out


def oscillation(t, nu, lam):
    root = np.sqrt(complex(lam*lam-nu*nu))
    u = root*t
    with np.errstate(divide="ignore",invalid="ignore"):
        sinhc = np.where(np.abs(u)<1e-5, 1+u*u/6+u**4/120, np.sinh(u)/u)
    return (np.exp(-lam*t)*(np.cosh(u)+lam*t*sinhc)).real


def probabilities(role, pars, t):
    t = np.asarray(t,dtype=float)
    r, d, omega = pars[:3]
    j=3
    nu=0.0; lam=0.0; eta=0.0
    if role.startswith(("static","dynamic","free")):
        nu=pars[j];j+=1
    if role.startswith("dynamic"):
        lam=pars[j];j+=1
    if role.startswith("free"):
        eta=pars[j];j+=1
    env=oscillation(t,nu,lam)
    if role.startswith("free"):
        env=env+1j*eta*np.sin(nu*t)
    trans=np.exp((-(r/2+2*d)+1j*omega)*t)*env
    q=(1+np.column_stack((trans.real,trans.imag,1-np.exp(-r*t))))/2
    if role.endswith("_spam"):
        e0=np.asarray(pars[j:j+3]);e1=np.asarray(pars[j+3:j+6])
        q=e1+(1-e0-e1)*q
    return np.clip(q,EPS,1-EPS)


def nll(counts,q):
    n=1024
    return -(counts*np.log(q)+(n-counts)*np.log1p(-q)
             + gammaln(n+1)-gammaln(counts+1)-gammaln(n-counts+1))


def fit(role,c):
    t=np.arange(10)
    total=c.sum(axis=2)
    starts=[]; bounds=[(0,1),(0,1),(-math.pi,math.pi)]
    multi=role.startswith(("static","dynamic","free"))
    switching=role.startswith("dynamic")
    if multi: bounds.append((0,math.pi))
    if switching: bounds.append((0,2))
    if role.startswith("free"): bounds.append((-.98,.98))
    if role.endswith("_spam"): bounds.extend([(0,.15)]*6)
    def loss(x):
        q=probabilities(role,x,t)
        return -np.mean(total*np.log(q)+(2048-total)*np.log1p(-q))/2048
    best=None; evaluations=converged=0
    for w,nu,lam in itertools.product([-1.8,-.45,0,.45,1.8],[.25,1,2] if multi else [0],[0,.2] if switching else [0]):
        x=[.035,.015,w]+([nu] if multi else [])+([lam] if switching else [])
        if role.startswith("free"):x.append(0)
        if role.endswith("_spam"):x.extend([.025]*6)
        starts.append(x)
        res=minimize(loss,x,bounds=bounds,method="L-BFGS-B",options={"maxiter":250,"ftol":2e-11,"gtol":2e-7,"maxls":24})
        evaluations+=int(res.nfev);converged+=int(res.success)
        for val,params in ((loss(x),x),(res.fun,res.x)):
            if np.isfinite(val) and (best is None or val<best[0]):best=(float(val),list(map(float,params)))
    assert best is not None
    q=probabilities(role,best[1],np.arange(16))
    return q,dict(params=best[1],starts=len(starts),evaluations=evaluations,converged=converged,
                  train_binomial_nll=float(nll(c,q[:10,:,None]).sum()))


def simple(role,c):
    if role == "constant":
        return np.tile((c.sum(axis=(0,2))+.5)/(20480+1),(6,1))
    if role == "last":
        return np.tile((c[-1].sum(axis=1)+.5)/(2048+1),(6,1))
    lag=int(role[-1])
    v=list(2*c.mean(axis=2)/1024-1)
    def row(history):
        return np.r_[1.,np.concatenate([history[-1-d] for d in range(lag)])]
    a=np.array([row(v[:k]) for k in range(lag,10)])
    penalty=.01*np.eye(a.shape[1]);penalty[0,0]=0
    coef=np.linalg.solve(a.T@a+penalty,a.T@np.array(v[lag:]))
    for _ in range(6):
        v.append(np.clip(row(v)@coef,-1+2*EPS,1-2*EPS))
    return (1+np.array(v[10:]))/2


def produce(ordinal):
    date,job,basis=design()[ordinal]
    c=prefix(basis)
    result={"ordinal":ordinal,"date":date,"job_id":job,"csv_sha256":CSV_SHA,
            "prefix_counts":c.tolist(),"prefix_double_full_agreement":(c[:,:,0]==c[:,:,1]).all(axis=0).tolist(),
            "probabilities":{},"fit":{}}
    for role in ROLES:
        if role in ("constant","last","var1","var2"):
            q=simple(role,c)
        else:
            whole,receipt=fit(role,c)
            q=whole[10:]
            result["fit"][role]=receipt
        assert q.shape==(6,3) and np.all((q>0)&(q<1))
        result["probabilities"][role]=q.tolist()
    return result


if __name__ == "__main__":
    print(json.dumps(produce(int(sys.argv[1])),sort_keys=True,allow_nan=False))
