"""Fit only the three training configurations; serialize predictions before target access."""
import hashlib,json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize_scalar
from train_spectra import packet, estimate, transforms, FREQ


def smooth(v):
    return np.stack([np.convolve(row,np.ones(5),mode="same") for row in np.atleast_2d(v)])


def regression(x,y,prior):
    power=smooth(abs(x)**2)
    # Estimate one coefficient per observed response floor and frequency.
    ridge=0.1*np.median(power,axis=1,keepdims=True)
    return (smooth(np.conj(x)*y)+ridge*prior)/(power+ridge)


def forecast(raw):
    h={s:estimate(transforms(v))[0] for s,v in raw.items()}
    ref,mass,contact=h[1],h[2],h[10]
    def update(delta):
        return contact/(1+delta*contact[0])
    def calibration(theta):
        return np.linalg.norm(ref/(1+theta*ref[0])-mass)/np.linalg.norm(mass)
    k=float(minimize_scalar(calibration,bounds=(0.,30.),method="bounded").x)
    # Linear contact-free perturbation obeys ref - mass = delta * ref_base * mass.
    x=ref[0]*mass
    y=ref-mass
    energy=smooth(np.sum(abs(x)**2,axis=0))[0]
    ridge=0.1*np.median(energy)
    delta=(smooth(np.sum(x.conj()*y,axis=0))[0]+ridge*k)/(energy+ridge)
    # Equally smoothed complex-ratio controls learn each floor separately or only the base.
    ratio=regression(ref,mass,1)
    floor_offset=smooth(mass-ref)/smooth(np.ones_like(mass.real))
    # Source floor-specific relative change times the contact-minus-baseline response.
    # This two-factor decomposition admits arbitrary direct linear transfer per output.
    predictions={
        'zero': np.zeros_like(ref), 'original': ref, 'contact_only': contact,
        'mass_only': mass, 'additive': contact+mass-ref,
        'local_additive': contact+floor_offset, 'local_floor_ratio': contact*ratio,
        'local_base_ratio': contact*ratio[0],
        'nominal_1p2': update(1.2), 'nominal_gscale': update(1.2*9.80665),
        'calibrated_scalar': update(k), 'local_impedance': update(delta)}
    for a in predictions.values():
        if a.shape!=(4,len(FREQ)) or not np.isfinite(a).all():raise ValueError("invalid forecast")
    return predictions,k,delta


if __name__ == '__main__':
    source=Path('official-port-data3SS.mat')
    preds,k,delta=forecast(packet(source))
    path=Path('s15-locked-forecasts.npz')
    np.savez(path,**preds,frequency_hz=FREQ,delta=delta,numerical_scalar=k)
    print(json.dumps({'roles':list(preds),'source_roles':[1,2,10],'target':15,
        'numerical_scalar':k,'frequency_bins':len(FREQ),'forecast_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'min_delta_magnitude':float(abs(delta).min()),'max_delta_magnitude':float(abs(delta).max())}))
