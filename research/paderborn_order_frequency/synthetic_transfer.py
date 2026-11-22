"""Test finite-record sideband approximations on generated amplitude-modulated noise."""
import json
import numpy as np
from scipy.signal import lfilter
from fastsc_receiver import fast_spectral_correlation


def main():
    fs = 4096.
    length = 256 + 4*511
    cache = []
    for seed in (421, 422, 423, 424):
        rng = np.random.default_rng(seed)
        t = np.arange(length + 2)/fs
        modulation = 1.0 + .55*np.cos(2*np.pi*118*t+.31) + .2*np.sin(2*np.pi*62*t)
        wide = rng.normal(size=t.size) * modulation
        x = wide[2:]
        for name, taps in [('high_pass', [1., -.65]), ('two_delay', [.2, -.7, .55])]:
            y = lfilter(taps, [1.], wide)[2:]
            left, alpha, freq = fast_spectral_correlation(x, fs, 256, 480.)
            right, _, _ = fast_spectral_correlation(y, fs, 256, 480.)
            f = freq[:, None]
            a = alpha[None, :]
            def gain(hz):
                return np.abs(sum(c*np.exp(-2j*np.pi*hz*k/fs) for k,c in enumerate(taps)))
            actual = abs(right[:,1:])
            source = abs(left[:,1:])
            valid = (f + a[:,1:] <= fs/2)
            registered = {'unit':np.ones_like(source),'fixed_row':np.broadcast_to(gain(f)**2,source.shape),
                          'symmetric_at_reported_row':gain(f-a[:,1:]/2)*gain(f+a[:,1:]/2),
                          'lower_upper':gain(f)*gain(f+a[:,1:])}
            entry={'seed':seed,'filter':name,'valid_cells':int(valid.sum()),
                   'total_cells':int(source.size),'nmse':{}}
            for key,factor in registered.items():
                prediction = factor*source
                entry['nmse'][key] = float(np.mean((actual[valid]-prediction[valid])**2)/np.mean(actual[valid]**2))
            cache.append(entry)
    print(json.dumps(cache,sort_keys=True))


if __name__=='__main__':
    main()
