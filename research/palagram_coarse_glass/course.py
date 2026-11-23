"""Access immutable PALAGRAM members through the frozen Git objects."""
import hashlib
import io
import json
import math
import os
from pathlib import Path
import subprocess

import h5py
import numpy as np

COURSE = Path(__file__).resolve().parent
DESIGN = json.loads((COURSE/"design.json").read_text())
POLICY = json.loads((COURSE/"protocol.json").read_text())
GRID = np.arange(5.,16.01,.25)
SOURCE = os.environ["PALAGRAM_GIT"]
UPSTREAM = "d7559b7772e59c26358b9cd931f915e218de5dd9"


def member(case, output=False):
    folder = "output_data" if output else "input_data/runs_CYRIL"
    path = f"data/{folder}/{case['id']}"
    blob = case["output_blob" if output else "git_blob"]
    raw = subprocess.check_output(["git","-C",SOURCE,"show",UPSTREAM+":"+path])
    if hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()!=blob:
        raise ValueError(path)
    return h5py.File(io.BytesIO(raw),"r")


def conditions(r,alternate=False):
    rho = 2500. if alternate and r["material"]=="glass beads" else r["rho_p"]
    frac,rf,ra,h,L = [r[k] for k in ("phi","rho_f","rho_a","H0","L0")]
    mix = rf + frac*(rho-rf)
    u0 = math.sqrt(9.81*(mix-ra)/ra*h*math.cos(math.radians(r["alpha"])))
    t0 = L/u0
    Re = u0*h*mix/.001
    ratio, aspect = mix/ra, h/L
    drag = 1+.02*aspect/ratio
    vis = (1-frac/.585)**(-2.5*.585)*500/Re*aspect/ratio
    F = (math.sqrt(vis**2+.45**2*drag*(1+math.tan(math.radians(r["alpha"]))/.25))-vis)/drag
    d = r["d"] or 0.
    stokes = d*d*(rho-rf)*9.81/.018
    lo,hi=0.,stokes
    for _ in range(70):
        m=(lo+hi)/2
        if m*(1+.15*(m*d*rf/.001)**.687)>stokes: hi=m
        else: lo=m
    sn=(lo+hi)/2
    return {"t0":t0,"re":Re,"froude":F,"raw":stokes*t0/h,
            "nohind":sn*t0/h,"eff":sn*(1-frac)**4.65*t0/h}


def observe(r):
    with member(r) as f:
        ds=f["x_front"]
        t=np.asarray(f["t"][:],float).ravel()
        x=np.asarray(ds[:],float).ravel()
        for key in ("missing_value","_FillValue"):
            if key in ds.attrs: x[x==float(ds.attrs[key])]=np.nan
    if not np.all(np.diff(t)>0) or t.shape!=x.shape: raise ValueError(r["id"])
    goal=GRID*conditions(r)["t0"]
    med=np.median(np.diff(t))
    pos=np.full(len(goal),np.nan)
    pairs=[]
    for i,when in enumerate(goal):
        k=int(np.searchsorted(t,when))
        if k<len(t) and t[k]==when and np.isfinite(x[k]):
            pos[i]=x[k]; pairs.append([k,k])
        elif 0<k<len(t) and t[k]-t[k-1]<=1.5*med and np.isfinite(x[k-1:k+1]).all():
            pos[i]=x[k-1]+(x[k]-x[k-1])*(when-t[k-1])/(t[k]-t[k-1]);pairs.append([k-1,k])
        else: pairs.append(None)
    return pos/r["L0"],pairs,t,x
