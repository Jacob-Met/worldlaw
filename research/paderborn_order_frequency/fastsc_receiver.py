"""Single-channel calibrated Fast-SC for a real vibration record.

Antoni, Xin and Hamzaoui, 2017, DOI 10.1016/j.ymssp.2017.01.011.
Uses the released defaults for complex scan summation and window calibration.
"""

import numpy as np
from scipy import fft
from scipy.signal.windows import hann
from numpy.lib.stride_tricks import sliding_window_view


def round_half_away(x):
    return int(np.copysign(np.floor(abs(x) + 0.5), x))


def fast_spectral_correlation(samples, fs, window_length, max_cyclic_hz):
    samples = np.asarray(samples, dtype=np.float64)
    if samples.ndim != 1 or window_length % 2 or not (0 < max_cyclic_hz < fs / 2):
        raise ValueError("Expected a real trace, even window size and a positive sub-Nyquist range")
    hop = max(1, min(int(fs / (2 * max_cyclic_hz)), window_length // 4))
    window = hann(window_length, sym=True)
    blocks = sliding_window_view(samples, window_length)[::hop]
    stft = fft.rfft(blocks * window, axis=1).T
    bins, frames = stft.shape
    cyclic_fs = fs / hop
    alpha = np.arange(frames) * (cyclic_fs / frames)
    carrier = np.arange(bins) * (fs / window_length)
    center = int(np.argmax(window))
    center_matlab = center + 1
    energy = np.sum(window**2)
    half = (frames + 1) // 2

    def shift_scan(offset):
        lag = abs(offset)
        correlated = np.zeros_like(stft)
        if lag:
            correlated[:bins-lag] = stft[lag:] * stft[:bins-lag].conj()
            if offset < 0:
                correlated = correlated.conj()
        else:
            correlated = abs(stft)**2
        scan = fft.fft(correlated, axis=1) / (frames * energy * fs)
        shift = offset * fs / window_length
        cutoff = half + round_half_away(shift * frames / cyclic_fs)
        scan[:, max(0, cutoff):] = 0
        scan *= np.exp((-2j * np.pi * center_matlab / fs) * (alpha - shift))
        return scan

    delays = np.arange(1, center + 1) / fs
    weights = window[center-1::-1]**2

    def half_window(freq):
        return window[center]**2 + 2 * (np.cos(2 * np.pi * freq[:, None] * delays) @ weights)

    window_full = half_window(alpha) + half_window(alpha - cyclic_fs)
    combined_window = window_full.copy()
    combined_window[half:] = 0
    summed = shift_scan(0)
    for pair in range(1, int((window_length / 2) * cyclic_fs / fs) + 1):
        for offset in (pair, -pair):
            add = shift_scan(offset)
            summed[:, 1:] += add[:, 1:]
            shift_bins = offset * fs / window_length / cyclic_fs * frames
            left = int(np.floor(shift_bins))
            fraction = shift_bins - left
            shifted = np.roll(window_full, left) * (1 - fraction) + np.roll(window_full, left + 1) * fraction
            cutoff = half + round_half_away(shift_bins)
            shifted[max(0, cutoff):] = 0
            combined_window[1:] += shifted[1:]
    first = int(np.flatnonzero(combined_window < combined_window[0] / 2)[0])
    if first + 1 >= frames:
        raise ValueError("The released inverse-window cutoff has no successor bin")
    inv = np.empty(frames)
    inv[:first+1] = 1.0 / combined_window[:first+1]
    inv[first+1:] = 1.0 / combined_window[first+1]
    chosen = alpha <= max_cyclic_hz
    return summed[:, chosen] * inv[chosen] * energy, alpha[chosen], carrier


def synthetic_pair():
    fs, width, maximum, f1, f2 = 4096., 256, 480., 320., 512.
    t = np.arange(256 + 4*511) / fs
    factors = 1 - .65 * np.exp(-2j*np.pi*np.array([f1, f2])/fs)
    pair = np.stack([np.exp(2j*np.pi*f1*t), .65*np.exp(2j*np.pi*f2*t + .19j)])
    x = pair.real.sum(axis=0)
    y = (factors[:, None] * pair).real.sum(axis=0)
    before, alpha, bins = fast_spectral_correlation(x, fs, width, maximum)
    after, _, _ = fast_spectral_correlation(y, fs, width, maximum)
    j = int(np.argmin(abs(alpha-(f2-f1))))
    assert alpha[j] == f2-f1
    i = int(np.argmax(abs(before[:,j])))
    return {'positive_alpha_Hz':alpha[j], 'peak_row_freq_Hz':bins[i], 'symmetric_carrier_Hz':(f1+f2)/2,
            'observed_gain':float(abs(after[i,j]/before[i,j])), 'sideband_gain_expected':float(abs(factors.prod())),
            'carrier_only_gain':float(abs(1-.65*np.exp(-2j*np.pi*(f1+f2)/2/fs))**2),
            'peak_magnitude':float(abs(before[i,j])), 'shape':list(before.shape)}


if __name__ == '__main__':
    import json
    print(json.dumps(synthetic_pair(), sort_keys=True))
