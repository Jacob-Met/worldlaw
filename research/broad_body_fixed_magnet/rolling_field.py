"""Causal body-field calibration at 1.001 s decision intervals, using prior samples only."""
import contextlib
import io
import warnings
import numpy as np
from source_field_pilot_v2 import gyro_orientations

ROLES=("raw_vqf","initial_field_then_6d","static60_gyro","rolling_midpoint","rolling_sphere","rolling_ellipsoid","rolling_gyro_sham","rolling_gyro")
LOCAL=ROLES[3:]


def biases(s, A, response, cls, magnitude, sham_rotation, left_m, right_m):
    I=np.eye(3)
    fits={}
    fits["rolling_midpoint"]=((s.min(axis=0)+s.max(axis=0))/2,I)
    design=np.column_stack((2*s,np.ones(len(s))))
    if np.linalg.matrix_rank(design)==4:
        fits["rolling_sphere"]=(np.linalg.lstsq(design,(s*s).sum(axis=1),rcond=1e-12)[0][:3],I)
    try:
        c=cls(magnetic_field_strength=float(magnitude))
        with contextlib.redirect_stdout(io.StringIO()),warnings.catch_warnings():
            warnings.simplefilter('ignore',RuntimeWarning)
            c.calibrate(s)
        if np.max(abs(np.imag(c.b)))==0 and np.isfinite(c.A_1).all() and np.linalg.matrix_rank(c.A_1)==3:
            fits["rolling_ellipsoid"]=(np.real(c.b).ravel(),c.A_1)
    except (ValueError,np.linalg.LinAlgError,FloatingPointError):
        pass
    fits["rolling_gyro"]=(np.linalg.lstsq(A,response,rcond=1e-12)[0],I)
    Ash=(I-sham_rotation).reshape(-1,3)
    ysh=(right_m-np.einsum('nij,nj->ni',sham_rotation,left_m)).ravel()
    fits["rolling_gyro_sham"]=(np.linalg.lstsq(Ash,ysh,rcond=1e-12)[0],I)
    return fits


def correct_series(gyr,mag,dt,cls):
    assert abs(dt-.0035)<1e-10
    n=len(mag);rot,_=gyro_orientations(gyr,dt)
    output={k:mag.copy() for k in LOCAL+("static60_gyro",)}
    ledger=[];lag=140; step=14; update=286; window=3432;validation=1144
    initial=int(np.ceil(20/dt));end60=int(np.ceil(60/dt));F=float(np.median(np.linalg.norm(mag[:initial],axis=1)))
    subs=np.arange(lag,end60,step)
    rel=(rot[subs].inv()*rot[subs-lag]).as_matrix()
    mat=(np.eye(3)-rel).reshape(-1,3);y=(mag[subs]-np.einsum("nij,nj->ni",rel,mag[subs-lag])).ravel()
    c0=np.linalg.lstsq(mat,y,rcond=1e-12)[0]
    output["static60_gyro"][end60:]-=c0
    for begin in range(((initial+update-1)//update)*update,n,update):
        lo=max(0,begin-window); cut=begin-validation
        tr=np.arange(lo+lag,cut,step);cv=np.arange(cut+lag,begin,step)
        assert tr.size>5 and cv.size>5
        rtr=(rot[tr].inv()*rot[tr-lag]).as_matrix()
        A=(np.eye(3)-rtr).reshape(-1,3);sv=np.linalg.svd(A,compute_uv=False)
        record={'at':int(begin),'sigma_min_per_sqrt_pair':float(sv[-1]/np.sqrt(tr.size)),'singular_ratio':float(sv[-1]/max(sv[0],1e-15)),'accepted':[],'parameters':{}}
        ledger.append(record)
        if record['sigma_min_per_sqrt_pair']<.08 or record['singular_ratio']<.15 or np.max(abs(mag[lo:begin]))>=990:continue
        train_y=(mag[tr]-np.einsum('nij,nj->ni',rtr,mag[tr-lag])).ravel()
        sh=np.roll(rtr,len(rtr)//2,axis=0)
        fits=biases(mag[lo:cut:step],A,train_y,cls,F,sh,mag[tr-lag],mag[tr])
        rcv=(rot[cv].inv()*rot[cv-lag]).as_matrix()
        xl=mag[cv-lag];xt=mag[cv]
        e0=float(np.mean(np.sum((np.einsum('nij,nj->ni',rcv,xl)-xt)**2,axis=1)))
        record['raw_cv_vector_rms_uT']=float(np.sqrt(e0))
        for name,(b,S) in fits.items():
            if not np.isfinite(b).all() or np.linalg.norm(b)>1500 or not np.isfinite(S).all() or np.linalg.cond(S)>10:continue
            pred=np.einsum('nij,nj->ni',rcv,(xl-b)@S.T)@np.linalg.inv(S).T+b
            error=float(np.mean(np.sum((pred-xt)**2,axis=1)))
            # A held-back prefix must support the fitted field model. The
            # 0.25 µT absolute margin is below one reported axis noise SD.
            if np.sqrt(e0)-np.sqrt(error)<.25 or error>.95**2*e0:continue
            stop=min(begin+update,n)
            output[name][begin:stop]=(mag[begin:stop]-b)@S.T
            record['accepted'].append(name)
            record['parameters'][name]={'bias_uT':b.tolist(),'matrix':S.tolist(),'validation_vector_rms_uT':float(np.sqrt(error))}
    return output,ledger,c0
