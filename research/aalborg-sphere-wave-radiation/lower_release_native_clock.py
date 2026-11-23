"""Training-only release/clock/polarity intake. No 0.5D member is opened."""
import hashlib
import io
import json
import re
from urllib.request import urlopen
import zipfile
import numpy as np

URL="https://www.oceanenergysystems.org/documents/55575-datafile.zip/"
SHA="04c4d78d6987e4eec6c31d692d3c5cf5adea2580ffcfe50fbbd44e6589c7623f"
GRID=np.arange(3025,dtype=np.float64)/500
R=0.15

def load(archive,name):
    assert re.search(r'/(?:01|03)D_',name), name
    with archive.open(name) as source:
        lines=source.read().decode('utf-8-sig').splitlines()
    first=next(i for i,line in enumerate(lines) if re.match(r'^\s*[+-.0-9]',line))
    delimiter=next((ch for ch in (';',',') if ch in lines[first]), None)
    return np.loadtxt(lines[first:],delimiter=delimiter,ndmin=2)

def emit(**row):
    print(json.dumps(row,allow_nan=False),flush=True)

def read_source(archive):
    panels={}
    for drop in ('01','03'):
        runs=[]
        for rep in range(1,5):
            name=f'Datafile/Experimental results/{drop}D_Measured{rep}_Raw.txt'
            a=load(archive,name)
            assert a.shape[1]==5 and np.isfinite(a).all()
            t=a[:,0]
            assert (np.diff(t)>0).all() and t[0]<=0 and t[-1]>=GRID[-1]
            j=np.searchsorted(t,GRID,side='right')-1
            assert (j>=0).all() and np.array_equal(t[j],GRID)
            x=a[j,1:]
            runs.append(x)
            emit(source=name,rows=len(t),clock=[float(t[0]),float(t[-1])],
                 dt=[float(v) for v in np.quantile(np.diff(t),[0,.5,1])],
                 release_sample=x[0].tolist(),delta_grid_s=0.002)
        panels[drop]=np.array(runs)
    return panels

def pilot(panels):
    low,mid=panels['01'],panels['03']
    source=np.mean(low[:,:,1:],axis=0)
    template=3*source
    e=mid[:,:,1:]-template
    trial,t,g=np.unravel_index(np.abs(e).argmax(),e.shape)
    emit(control="three_times_mean_low_release_matched_clock",rms_m=float(np.sqrt(np.mean(e**2))),
         per_gauge_rms_m=np.sqrt(np.mean(e**2,axis=(0,1))).tolist(),
         worst={'rep':int(trial)+1,'gauge':int(g)+1,'time_s':float(GRID[t]),'measured_m':float(mid[trial,t,g+1]),
                'predicted_m':float(template[t,g]),'signed_error_m':float(e[trial,t,g])},
         raw_episode={'ticks':GRID[max(t-3,0):t+4].tolist(),'observed_height_plus_3_gauges_m':mid[trial,max(t-3,0):t+4].tolist(),
                      'predicted_3_gauges_m':template[max(t-3,0):t+4].tolist()})
    for key,p in panels.items():
        z=p[:,:,0]
        h=np.clip(R-z,0,2*R)
        v=np.pi*h*h*(R-h/3)
        q=np.diff(v,axis=1)/.002
        qlin=-np.pi*R*R*np.diff(z,axis=1)/.002
        emit(drop=key,maximum_abs_motion_over_radius=float(np.abs(z).max()/R),
             geometric_vs_linear_flux_peak_ratio=float(np.abs(q-qlin).max()/np.abs(qlin).max()),
             tied_basis_residual_m3=float(np.abs(v-(2*np.pi*R**3/3-np.pi*R**2*z+np.pi*z**3/3)).max()))

if __name__=='__main__':
    with urlopen(URL,timeout=45) as response:
        data=response.read(17549046)
    assert len(data)==17549045 and hashlib.sha256(data).hexdigest()==SHA
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        pilot(read_source(archive))
    emit(high_release_members_opened=0,train_trials=8,release_clock_seconds=[0,6.048],unit='m')
