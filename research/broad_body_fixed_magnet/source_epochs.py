import hashlib
import io
import json
import importlib.util
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.spatial.transform import Rotation
from native_vqf import load_native, estimate, PIN
from source_field_pilot_v2 import gyro_orientations


def native_gate():
    with tempfile.TemporaryDirectory() as d:
        lib=load_native(d)
        url=f'https://raw.githubusercontent.com/dlaidig/vqf/{PIN}/vqf/pyvqf.py'
        code=urllib.request.urlopen(url,timeout=30).read()
        assert hashlib.sha1(b'blob '+str(len(code)).encode()+bytes([0])+code).hexdigest()=='5084f77e7871f97e3fca7adc45ce9a94b24a2dd5'
        p=Path(d)/'pyvqf_tagged.py';p.write_bytes(code)
        spec=importlib.util.spec_from_file_location('pyvqf_tagged',p);module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
        t=np.arange(2200)*.0035
        g=np.column_stack((.2*np.sin(2*t),.3*np.cos(3*t),.1*np.sin(t)))
        a=np.column_stack((.3*np.sin(t),-.2*np.cos(t),9.81+.1*np.sin(3*t)))
        m=np.column_stack((5+np.cos(t),22+np.sin(t),-43+.5*np.cos(2*t)));m[(t>3)&(t<4),0]+=40
        qc,bad=estimate(lib,.0035,g,a,m);result=module.PyVQF(.0035).updateBatch(g,a,m)
        qp=result['quat9D']; sign=np.sign((qc*qp).sum(axis=1));err=abs(qc-sign[:,None]*qp).max()
        assert err<2e-9 and np.array_equal(bad.astype(bool),result['magDistDetected'])
        return dict(synthetic_samples=len(t),max_antipodal_component_difference=float(err),same_disturbance_flags=True)


def source_windows(g,m,a,dt):
    r,gb=gyro_orientations(g,dt);t=np.arange(len(m))*dt
    edges=np.arange(0,t[-1]+30,30);rows=[]
    for lo,hi in zip(edges[:-1],edges[1:]):
        ix=np.flatnonzero((t>=lo)&(t<hi))
        if len(ix)<=140:continue
        i=ix[:-140:14];j=i+140
        q=(r[j].inv()*r[i]).as_matrix()
        design=(np.eye(3)-q).reshape(-1,3)
        y=(m[j]-np.einsum("nij,nj->ni",q,m[i])).reshape(-1)
        s=np.linalg.svd(design,compute_uv=False); b=np.linalg.lstsq(design,y,rcond=1e-12)[0]
        raw=float(np.mean(y**2)**.5*np.sqrt(3));res=(design@b-y).reshape(-1,3)
        row=dict(start_s=lo,end_s=min(hi,t[-1]),n_pairs=len(i),smallest_design_rms=float(s[-1]/np.sqrt(len(i))),
                design_ratio=float(s[-1]/s[0]),b_uT=b.tolist(),mag_norm_median_uT=float(np.median(np.linalg.norm(m[ix],axis=1))),
                raw_vector_rms_uT=raw,fitted_in_window_vector_rms_uT=float(np.mean(np.linalg.norm(res,axis=1)**2)**.5),
                median_gyro_rad_s=float(np.median(np.linalg.norm(g[ix]-gb,axis=1))))
        rows.append(row)
    n=int(10/dt)
    return dict(windows=rows,rest_early_mag=m[:n].mean(0).tolist(),rest_late_mag=m[-n:].mean(0).tolist(),
                rest_early_acc=a[:n].mean(0).tolist(),rest_late_acc=a[-n:].mean(0).tolist())


def main():
    p=json.loads(Path('source-input-boundary.json').read_text());out={}
    print(json.dumps({'native_vqf':native_gate()}),flush=True)
    for name,size,blob in p['files']:
        i=int(name.split('/')[-1].split('_')[0])
        if i not in p['input_only_source_cases']:continue
        raw=urllib.request.urlopen('https://raw.githubusercontent.com/dlaidig/broad/'+p['data_commit']+'/'+name,timeout=40).read()
        assert len(raw)==size and hashlib.sha1(b'blob '+str(size).encode()+bytes([0])+raw).hexdigest()==blob
        d=loadmat(io.BytesIO(raw),variable_names=['imu_gyr','imu_mag','imu_acc','sampling_rate'])
        out[str(i)]=source_windows(d['imu_gyr'],d['imu_mag'],d['imu_acc'],1/d['sampling_rate'].item())
    print(json.dumps({'source_windows':out,'optical_arrays_read':0,'held_trials_read':0},sort_keys=True))


if __name__=='__main__':main()
