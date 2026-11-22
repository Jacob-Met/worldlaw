"""Native welib MHH/Øye development receiver on checksum-bound CENER source."""
import hashlib
import sys
import urllib.request

import netCDF4
import numpy as np

SOURCE = "dd67c604bd9034991d243820d4f6967c74ca5827"
FILES = {
    "DynamicStall.py": "9b3d5a975c94920afbdcdc5758fa985c6bd139b3",
    "Polar.py": "fa25f290ed889c36ab2703da6ac0aeaf1455f625",
    "polar_file.py": "876568392fdedae734b8d2db05f040a44a3040ab",
}
DATA = {
    "naca64418_pitch.nc": "c4b2d0137fd89e78c30bfb40839401ac",
    "naca64418_steady.nc": "927da7088a8f860ddec1e15864622383",
}
U, CHORD = 30.0, 0.25
DEVELOPMENT = [f"A{mean:02}_10_k0-{rate:03}_F00" for mean in (5,15) for rate in (10,50)]
def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent":"IRPWIND-method-replay/1"})
    return urllib.request.urlopen(req,timeout=75).read()
def setup(directory):
    folder = directory / "welib" / "airfoils"
    folder.mkdir(parents=True)
    for n, sha in FILES.items():
        raw = fetch(f"https://raw.githubusercontent.com/ebranlard/welib/{SOURCE}/welib/airfoils/{n}")
        assert hashlib.sha1(f"blob {len(raw)}\0".encode()+raw).hexdigest()==sha
        (folder / n).write_bytes(raw)
    sys.path.insert(0,str(directory))
    for n, md5 in DATA.items():
        raw = fetch(f"https://zenodo.org/records/1135424/files/{n}?download=1")
        assert hashlib.md5(raw).hexdigest()==md5
        (directory / n).write_bytes(raw)
def select(db,case,fields):
    i=list(db["Case"][:]).index(case)
    result=[]
    for name in fields:
        v=db[name]
        assert v.dimensions in (("Case","index"),("index","Case")), v.dimensions
        arr=v[i,:] if v.dimensions[0]=="Case" else v[:,i]
        result.append(np.ma.filled(arr.astype(float),np.nan))
    stacked=np.stack(result)
    ok=np.isfinite(stacked).all(axis=0)
    assert np.array_equal(np.flatnonzero(ok),np.arange(ok.sum())),(case,fields,ok.sum())
    return stacked[:,ok]
def model_polar(base):
    from welib.airfoils.Polar import Polar
    with netCDF4.Dataset(base/"naca64418_steady.nc") as d:
        a,cl,cd,cm=select(d,"F00",("AoA","Cl","Cdp","Cm"))
    unique, groups, counts=np.unique(a,return_inverse=True,return_counts=True)
    print("STATIC_EXACT_REPEATS",[(float(value),int(count)) for value,count in zip(unique,counts) if count>1],flush=True)
    cl,cd,cm=(np.bincount(groups,weights=v)/counts for v in (cl,cd,cm))
    return Polar(alpha=np.deg2rad(unique), cl=cl,cd=cd,cm=cm, Re=500000.,compute_params=True,radians=True)
def simulate(time,adeg,polar,constants,offset=True,steps=3):
    from welib.airfoils import DynamicStall as ds
    angle=np.deg2rad(adeg)
    rate=np.r_[0., np.diff(angle)/np.diff(time)]
    a34=angle+((0.5*CHORD/U)*rate if offset else 0.)
    p=ds.dynstall_mhh_param_from_polar(polar,CHORD,constants=constants)
    state=np.array(ds.dynstall_mhh_steady_simple(U,a34[0],p))
    result=np.empty(len(angle))
    def output(i):
        return ds.dynstall_mhh_outputs_simple(time[i],state,U,0.,rate[i],a34[i],p)[0]
    result[0]=output(0)
    for i in range(1,len(time)):
        h=(time[i]-time[i-1])/steps
        def deriv(x,f):
            a=a34[i-1]+f*(a34[i]-a34[i-1])
            w=rate[i-1]+f*(rate[i]-rate[i-1])
            return np.asarray(ds.dynstall_mhh_dxdt_simple(0.,x,U,0.,w,a,p))
        for n in range(steps):
            f=n/steps; m=(n+.5)/steps; end=(n+1)/steps
            k1=deriv(state,f);k2=deriv(state+.5*h*k1,m)
            k3=deriv(state+.5*h*k2,m);k4=deriv(state+h*k3,end)
            state=state+h*(k1+2*k2+2*k3+k4)/6
        result[i]=output(i)
    return result
def oye(time,adeg,polar):
    from welib.airfoils import DynamicStall as ds
    a=np.deg2rad(adeg)
    p=ds.dynstall_oye_param_from_polar(polar,tau_chord=CHORD/U)
    tau=p["tau"]
    target=p["F_st"](a)
    x=target[0];result=np.empty_like(a)
    for i in range(len(a)):
        if i:
            dt=time[i]-time[i-1]; decay=np.exp(-dt/tau)
            x=decay*x+(1-decay)*target[i-1]+(target[i]-target[i-1])*(1-(1-decay)*tau/dt)
        result[i]=ds.dynstall_oye_output(i,x,{"alpha":lambda it:a[it]},p)
    return result

def development_streams(directory):
    setup(directory)
    polar=model_polar(directory)
    streams={}
    with netCDF4.Dataset(directory/"naca64418_pitch.nc") as dataset:
        for case in DEVELOPMENT:
            time,angle,observed=select(dataset,case,("Time","AoA","Cl"))
            assert np.allclose(np.diff(time),.008,rtol=0,atol=5e-13)
            predictions={"static":polar.cl_interp(np.deg2rad(angle)),"oye":oye(time,angle,polar)}
            for constant in ("Jones","OpenFAST"):
                for offset in (True,False):
                    name=f"MHH_{constant}_{'quarter_pivot' if offset else 'direct'}"
                    predictions[name]=simulate(time,angle,polar,constant,offset)
            for name,array in {**predictions,"Time":time,"AoA":angle,"Cl":observed}.items():
                streams[case+"_"+name]=array
    return streams
