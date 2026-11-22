"""Form the registered positive cyclic-spectrum surface from one voltage/acceleration trace."""
import numpy as np
from scipy.interpolate import RegularGridInterpolator
from fastsc_receiver import fast_spectral_correlation

FS = 64000.
WINDOW = 512
ALPHA_LIMIT = 640.
FREQ = np.arange(WINDOW//2 + 1) * (FS/WINDOW)
ORDER = np.arange(1281)/64.
# The validity area includes every symmetric one-sided pair for every speed up to 30 Hz.
COMMON = (FREQ[:,None] - 15.*ORDER[None,:] >= 0) & (FREQ[:,None] + 15.*ORDER[None,:] <= FS/2)
COMMON[:,0] = False


def surface(acceleration, rpm):
    acceleration = np.asarray(acceleration, float).reshape(-1)
    rpm = np.asarray(rpm, float).reshape(-1)
    if not np.all(np.isfinite(acceleration)) or not np.all(np.isfinite(rpm)):
        raise ValueError('Nonfinite measurement')
    if not (240000 <= len(acceleration) <= 272000 and 15000 <= len(rpm) <= 17000):
        raise ValueError('Unexpected native clock or length')
    turns = float(rpm.mean()/60.)
    if not (0 < turns <= 30):
        raise ValueError('Mean shaft speed outside the numerical registration domain')
    original, alpha, lower = fast_spectral_correlation(acceleration-acceleration.mean(), FS, WINDOW, ALPHA_LIMIT)
    np.testing.assert_array_equal(lower, FREQ)
    points = np.broadcast_arrays(FREQ[:,None] - ORDER[None,:]*turns/2, ORDER[None,:]*turns)
    # Interpolation is applied to magnitudes; separately initiated records have arbitrary phases.
    mapper=RegularGridInterpolator((lower,alpha),np.abs(original),bounds_error=False,fill_value=0.)
    registered=mapper(tuple(points))
    return registered, np.real(original[:,0]), turns


def baseline_roles(source, high_healthy, low_healthy, high_psd, low_psd, source_hz):
    low_hz=15.
    ratio=source_hz/low_hz
    center,orders=np.broadcast_arrays(FREQ[:,None],ORDER[None,:])
    interpolate=RegularGridInterpolator((FREQ,ORDER),source,bounds_error=False,fill_value=np.nan)
    def sample(f,k):
        m=interpolate((f,k))
        return np.where(np.isfinite(m),m,low_healthy)
    shifted=sample(center+orders*(source_hz-low_hz)/2,orders)
    unchanged_hz=sample(center,orders/ratio)
    rescaled=sample(center*ratio,orders)
    power_floor=1e-6*high_psd.mean()
    if not power_floor>0:
        raise ValueError('Healthy source spectrum has no positive mean power')
    def power(freq,ref):
        return np.maximum(np.interp(freq,FREQ,ref),power_floor)
    alpha_hi=orders*source_hz
    alpha_lo=orders*low_hz
    half_up=power(center+alpha_lo/2,low_psd)/power(center+alpha_hi/2,high_psd)
    half_down=power(center-alpha_lo/2,low_psd)/power(center-alpha_hi/2,high_psd)
    gain=np.sqrt(half_up*half_down)
    scalar=low_psd.mean()/high_psd.mean()
    carrier=power(center,low_psd)/power(center,high_psd)
    return {'mixed_center':source,'mixed_same_reported_row':shifted,'unchanged_hz':unchanged_hz,
            'uniform_order':rescaled,'uniform_order_density':np.where(center*ratio<=FREQ[-1],ratio*rescaled,low_healthy),
            'healthy_low':low_healthy,'additive_healthy':np.maximum(0,source+(low_healthy-high_healthy)),
            'scalar_gain':source*scalar,'carrier_gain':source*carrier,'sideband_gain':source*gain,
            'inverse_sideband':source/gain}


def per_bearing_loss(prediction,truth,high_source,mask=COMMON):
    scale=np.mean(high_source[mask]**2)
    if not (scale>0 and np.all(np.isfinite(prediction[mask])) and np.all(np.isfinite(truth[mask]))):
        raise ValueError('Undefined source scale or measured/predicted surface')
    return float(np.mean((prediction[mask]-truth[mask])**2)/scale)
