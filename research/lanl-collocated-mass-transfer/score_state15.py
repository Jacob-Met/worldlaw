"""Receive frozen state-15 forecasts, score all ten recorded trials at four floors."""
from hashlib import sha256
import json
from pathlib import Path
import numpy as np
from scipy.io import loadmat
from train_spectra import MAT, FREQ, transforms, estimate


def receive(data_source, forecast_file, expected):
    if sha256(data_source.read_bytes()).hexdigest()!=MAT:
        raise ValueError('data source mismatch')
    if sha256(forecast_file.read_bytes()).hexdigest()!=expected:
        raise ValueError('prediction lock mismatch')
    with np.load(forecast_file,allow_pickle=False) as f:
        if not np.array_equal(f['frequency_hz'],FREQ):raise ValueError('grid')
        predictions={k:f[k] for k in f.files if k not in ('delta','frequency_hz','numerical_scalar')}
    x=loadmat(data_source)
    target_idx=np.flatnonzero(x['states'].ravel()==15)
    if target_idx.tolist()!=list(range(140,150)):raise ValueError("state roster")
    z=transforms(x['dataset'][:,:,target_idx].transpose(2,1,0).astype(float))
    del x
    u=z[:,0];ys=z[:,1:]
    energy=float((abs(ys)**2).sum())
    observed_h,coherence=estimate(z)
    report={}
    for role,h in predictions.items():
        errors=abs(ys-u[:,None]*h[None,:,None])**2
        trial_sse=errors.sum(axis=(1,2,3))
        report[role]={
            'relative_spectral_RMSE':float(np.sqrt(trial_sse.sum()/energy)),
            'ten_trial_squared_errors':trial_sse.tolist(),
            'four_floor_squared_errors':errors.sum(axis=(0,2,3)).tolist(),
            'pooled_H1_relative_RMSE':float(np.linalg.norm(h-observed_h)/np.linalg.norm(observed_h))}
    candidate=predictions['local_impedance']
    power=abs(ys-u[:,None]*candidate[None,:,None])**2
    i,c,w,k=map(int,np.unravel_index(np.argmax(power),power.shape))
    ri=lambda a:[float(a.real),float(a.imag)]
    worst={'trial_index_zero_based':int(target_idx[i]),'floor_channel':c+2,'window':w,
           'frequency_Hz':float(FREQ[k]),'complex_force':ri(u[i,w,k]),'complex_measured_acceleration':ri(ys[i,c,w,k]),
           'complex_predicted_acceleration':ri(u[i,w,k]*candidate[c,k]),'candidate_squared_error':float(power[i,c,w,k])}
    return {'target_state':15,'file_indices':target_idx.tolist(),'roles':report,'worst':worst,
            'total_observed_acceleration_energy':energy,'median_pooled_coherence_per_floor':np.median(coherence,axis=1).tolist()}


if __name__=='__main__':
    import sys
    root=Path('.')
    print(json.dumps(receive(root/'official-port-data3SS.mat',root/'s15-locked-forecasts.npz',sys.argv[1])))
