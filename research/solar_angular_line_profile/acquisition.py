"""Fetch registered source windows and their serialized coordinates; no disk-observation URLs."""
import concurrent.futures
import hashlib
import io
import json
import math
from pathlib import Path
import re
import time
import urllib.request
import numpy as np

BASE = "https://www.astro.physik.uni-goettingen.de/research/solar-lib/data/"
C = 299792.458


def vacuum(air):
    """Invert the conventional Edlen 1966 standard-air index relation."""
    w = np.asarray(air, dtype=float)
    v = w.copy()
    for _ in range(4):
        sigma2=(10000/v)**2
        v=w*(1+1e-8*(8342.13+2406030/(130-sigma2)+15997/(38.9-sigma2)))
    return v


def read_range(url, start, count):
    request = urllib.request.Request(url,headers={"User-Agent":"Public scientific spectroscopy reader",
                                   "Range":f"bytes={start}-{start+count-1}"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                h=response.headers.get("Content-Range","")
                if response.status != 206 or not re.fullmatch(fr"bytes {start}-{start+count-1}/[0-9]+", h):
                    raise ValueError("server did not honor requested range")
                data=response.read(count+1)
            if len(data)!=count: raise IOError("short source read")
            return data
        except OSError:
            if attempt==2:raise
            time.sleep(1+attempt)


def headers(url):
    offset=0
    parts=[]
    while offset<86400:
        block=read_range(url,offset,2880)
        parts.append(block)
        offset+=2880
        if any(block[i:i+8].strip()==b"END" for i in range(0,2880,80)):
            break
    else:raise ValueError("unfinished header")
    return b"".join(parts),offset


def windows(air_lines):
    # Include a one-sample margin beyond all requested velocity coordinates.
    for line in air_lines:
        v=float(vacuum(line))
        i0=math.floor((v*math.exp(-22/C)-4200)*1000)-2
        i1=math.ceil((v*math.exp(22/C)-4200)*1000)+2
        yield i0,i1


def read_mu(mu, indices):
    u=BASE+f"solarspectrum_mu{mu:.2f}.fits"
    header, offset=headers(u)
    assert b"3800001" in header and offset==2880
    spectrum=[]; hashes=[]
    for i,j in indices:
        n=j-i+1
        wave=read_range(u,offset+8*i,8*n)
        flux=read_range(u,offset+8*(3800001+i),8*n)
        x=np.frombuffer(wave,dtype=">f8").astype(float)
        y=np.frombuffer(flux,dtype=">f8").astype(float)
        assert np.max(abs(x-(4200+np.arange(i,j+1)*.001)))<2e-6, ("source coordinate",mu,i)
        if not np.all(np.isfinite(y)):
            raise ValueError(("nonfinite source flux",mu,i,int(np.count_nonzero(~np.isfinite(y)))))
        spectrum.append((x,y));hashes.append(hashlib.sha256(wave+flux).hexdigest())
    return spectrum,{"mu":mu,"header":hashlib.sha256(header).hexdigest(),"slice_sha256":hashes}


def read_published(indices):
    u=BASE+"IAG23_atlas.fits"
    primary,k=headers(u)
    assert k==2880
    ext=read_range(u,k,2880)
    assert b"BINTABLE" in ext and b"Angstrom (in Vacuum)" in ext
    assert any(ext[i:i+8].strip()==b"END" for i in range(0,2880,80))
    offset=k+len(ext)
    spectra=[];hashes=[]
    for i,j in indices:
        # Use extra margin for the packed table's occasionally different first coordinate.
        i-=4;j+=4
        raw=read_range(u,offset+16*i,16*(j-i+1))
        a=np.frombuffer(raw,dtype=">f8").reshape(-1,2).astype(float)
        if not np.all(np.isfinite(a)) or np.max(abs(np.diff(a[:,0])-.001))>2e-6:
            raise ValueError(("published integrated wavelength/flux",i))
        if np.max(abs(a[:,0]-(4200+np.arange(i,j+1)*.001)))>.006:
            raise ValueError(("published coordinate origin",i))
        spectra.append((a[:,0],a[:,1]));hashes.append(hashlib.sha256(raw).hexdigest())
    return spectra,{"source":"IAG23 released integrated atlas","header":hashlib.sha256(primary+ext).hexdigest(),"slice_sha256":hashes}


def acquire(proto):
    inds=list(windows(proto["lines_air_angstrom"]))
    angles=proto["source"]["angles"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures=[pool.submit(read_mu,mu,inds) for mu in angles]
        published=pool.submit(read_published,inds)
        source=[f.result() for f in futures]
        integrated=published.result()
    return [v[0] for v in source],integrated[0],[v[1] for v in source]+[integrated[1]]
