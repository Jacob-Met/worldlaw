"""Boundary for the paired PARSEC processed spectra and independent optical inputs."""
import hashlib,io,pathlib,re,urllib.request,zipfile
import xml.etree.ElementTree as ET
import numpy as np
from scipy.io import loadmat
ROOT="https://zenodo.org/records/6757550/files/"
def fetch(name,sha):
    req=urllib.request.Request(ROOT+name+"?download=1",headers={"User-Agent":"scientific reproducibility source reader"})
    with urllib.request.urlopen(req,timeout=80) as x:b=x.read()
    assert hashlib.sha256(b).hexdigest()==sha
    return b
def data(reg,score=False):
    b=fetch("lab_spectra.xlsx",reg["files"]["workbook"])
    ns="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    allowed=("E","G","I","K") if score else ("A","B","C","E","F","I","J")
    cols={k:{} for k in allowed}
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        sheets=[e.get("name") for e in ET.fromstring(z.read("xl/workbook.xml")).find(ns+"sheets")]
        assert sheets==["enstatite","olivine","plagioclase"]
        for _,e in ET.iterparse(z.open("xl/worksheets/sheet3.xml"),events=("end",)):
            if e.tag!=ns+"c":continue
            col,n=re.fullmatch(r"([A-Z]+)([0-9]+)",e.get("r")).groups();n=int(n)
            if col in cols and n>=4:
                value=e.findtext(ns+"v")
                if value is not None:
                    assert e.get("t") not in ("s","str") and n not in cols[col]
                    cols[col][n]=float(value)
            e.clear()
    for c in allowed:assert sorted(cols[c])==list(range(4,572))
    out={k:np.array([v[i] for i in range(4,572)]) for k,v in cols.items()}
    assert all(np.isfinite(v).all() for v in out.values())
    return out
def optics(reg,wave):
    b=fetch("codes.zip",reg["files"]["zip"])
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        p=loadmat(io.BytesIO(z.read("codes/mie_code/optical constants/plag_nk.mat")))
    lam=p["plag_lambda"].ravel();ix=np.argsort(lam);lam=lam[ix]
    assert (np.diff(lam)>0).all() and wave.min()>=min(lam)-.001 and wave.max()<=max(lam)+.001
    return np.asarray([np.interp(wave,lam,p["plag_n"+c].ravel()[ix])+1j*np.interp(wave,lam,p["plag_k"+c].ravel()[ix]) for c in "xyz"])
