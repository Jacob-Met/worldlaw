"""Three preregistered development trials: sensor inputs only, with raw future-field residuals."""
import ast
import contextlib
import hashlib
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from scipy import linalg
from scipy.io import loadmat, whosmat
from scipy.spatial.transform import Rotation


def load_calibrator():
    rev="bd96a8973553ed5cad13b5bd7385b2ab0f74fdb4"
    with urllib.request.urlopen(f"https://raw.githubusercontent.com/nliaudat/magnetometer_calibration/{rev}/calibrate.py",timeout=30) as f:
        source=f.read()
    assert hashlib.sha1(b"blob "+str(len(source)).encode()+b"\0"+source).hexdigest()=="e726c0281154ac0f4ae8a05e1e69dc65575a6ebc"
    obj=[x for x in ast.parse(source).body if isinstance(x,ast.ClassDef) and x.name=="MagnetometerCalibrator"]
    ns={"np":np,"linalg":linalg};exec(compile(ast.Module(body=obj,type_ignores=[]),"<published-calibrator>","exec"),ns)
    return ns["MagnetometerCalibrator"]


def gyro_orientations(gyr,dt):
    bias=gyr[:int(np.ceil(20/dt))].mean(axis=0)
    rot=Rotation.from_rotvec((.5*(gyr[1:]+gyr[:-1])-bias)*dt).as_quat()
    quat=np.zeros((len(gyr),4));quat[0,3]=1
    w,x,y,z=1.,0.,0.,0.
    for i,(a,b,c,s) in enumerate(rot,1):
        w,x,y,z=w*s-x*a-y*b-z*c,w*a+x*s+y*c-z*b,w*b-x*c+y*s+z*a,w*c+x*b-y*a+z*s
        quat[i]=(x,y,z,w)
    return Rotation.from_quat(quat),bias


def field_models(m,rot,dt,calclass):
    end=int(np.ceil(60/dt))
    step=14;lag=140
    right=np.arange(lag,end,step);left=right-lag
    rel=(rot[right].inv()*rot[left]).as_matrix()
    A=(np.eye(3)-rel).reshape(-1,3)
    y=(m[right]-np.einsum("nij,nj->ni",rel,m[left])).reshape(-1)
    hard=np.linalg.lstsq(A,y,rcond=1e-12)[0]
    samples=m[:end:step];sphere=np.column_stack((2*samples,np.ones(len(samples))))
    sphere_b=np.linalg.lstsq(sphere,(samples*samples).sum(axis=1),rcond=1e-12)[0][:3]
    midpoint=(samples.min(axis=0)+samples.max(axis=0))/2
    ell=calclass(magnetic_field_strength=50)
    with contextlib.redirect_stdout(io.StringIO()):ell.calibrate(samples)
    ell_imag=float(np.max(np.abs(np.imag(ell.b))))
    ell_b=np.real(ell.b).ravel()
    ell_ok=ell_imag==0 and np.isfinite(ell_b).all() and np.isfinite(ell.A_1).all() and np.linalg.matrix_rank(ell.A_1)==3
    roles={"zero":(np.zeros(3),np.eye(3)),"midpoint":(midpoint,np.eye(3)),"sphere":(sphere_b,np.eye(3)),
           "gyro_transport":(hard,np.eye(3))}
    if ell_ok:
        roles["author_ellipsoid"]=(ell_b,ell.A_1)
    return roles,dict(prefix_end_exclusive=end,lag=lag,step=step,pairs=len(left),design_singular=np.linalg.svd(A,compute_uv=False).tolist(),
         design_ratio=float(np.linalg.svd(A,compute_uv=False)[-1]/np.linalg.svd(A,compute_uv=False)[0]),sphere_rank=int(np.linalg.matrix_rank(sphere)),source_ellipsoid_condition=float(np.linalg.cond(ell.A_1)),ellipsoid_bias_max_imag_uT=ell_imag,ellipsoid_real_vector_gate=bool(ell_ok))


def main():
    prot=json.loads(Path('source-input-boundary.json').read_text());out=[]
    calibrator=load_calibrator()
    for name,size,blob in prot['files']:
        i=int(name.split('/')[-1].split('_')[0])
        if i not in prot['input_only_source_cases']:continue
        with urllib.request.urlopen("https://raw.githubusercontent.com/dlaidig/broad/"+prot['data_commit']+"/"+name,timeout=60) as f:raw=f.read(size+1)
        assert len(raw)==size and hashlib.sha1(b'blob '+str(size).encode()+bytes([0])+raw).hexdigest()==blob
        metadata=whosmat(io.BytesIO(raw));print(json.dumps({"trial":i,"mat_fields":metadata,"file_sha256":hashlib.sha256(raw).hexdigest()}),flush=True)
        data=loadmat(io.BytesIO(raw),variable_names=['imu_gyr','imu_acc','imu_mag','sampling_rate'])
        assert set(data)-{'__header__','__version__','__globals__'}=={'imu_gyr','imu_acc','imu_mag','sampling_rate'}
        g,a,m=(np.asarray(data[k],dtype=float) for k in ('imu_gyr','imu_acc','imu_mag'))
        dt=1/float(data['sampling_rate'].item());assert abs(dt-.0035)<1e-10 and g.shape==m.shape==a.shape and m.shape[1]==3
        assert np.isfinite(g).all() and np.isfinite(m).all() and np.isfinite(a).all()
        rot,bias=gyro_orientations(g,dt)
        roles,fit=field_models(m,rot,dt,calibrator)
        end=fit['prefix_end_exclusive'];left=np.arange(end,len(m)-140,14);right=left+140
        rel=rot[right].inv()*rot[left];rows={}
        for label,(b,A) in roles.items():
            pred=rel.apply((m[left]-b)@A.T)@np.linalg.inv(A).T+b;err=pred-m[right]; norms=np.linalg.norm(err,axis=1);worst=int(np.argmax(norms));lo=left[worst];hi=right[worst]
            rows[label]=dict(b_uT=b.tolist(),calibration_matrix=A.tolist(),vector_rmse_uT=float(np.mean(norms**2)**.5),median_norm_uT=float(np.median(norms)),
                worst=dict(t_s=float(hi*dt),left_mag=m[lo].tolist(),right_mag=m[hi].tolist(),predicted=pred[worst].tolist(),error_norm_uT=float(norms[worst])))
        out.append(dict(trial=i,samples=len(m),duration_s=(len(m)-1)*dt,gyro_rest_mean_rad_s=bias.tolist(),mag_component_range_uT=np.array([m.min(axis=0),m.max(axis=0)]).tolist(),
          n_axis_abs_at_least_990uT=np.sum(abs(m)>=990,axis=0).tolist(),n_axis_abs_at_least_1000uT=np.sum(abs(m)>=1000,axis=0).tolist(),
          prefix_initial_end_axis_mean_uT=np.array([m[:int(10/dt)].mean(axis=0),m[end-int(10/dt):end].mean(axis=0)]).tolist(),fit=fit,roles=rows))
    assert {x['trial'] for x in out}=={19,28,34}
    print(json.dumps({"schema":"p3.broad.source-sensor-only.v1","trials":out,"optical_arrays_decoded":0,"prospective_held_trials_opened":0},sort_keys=True))


if __name__=="__main__":main()
