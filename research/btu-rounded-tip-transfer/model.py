"""Band-gain and source-level comparisons for the fixed NACA0012 records."""
import math

import numpy as np

SCHEMES = ('natural', 'tripped')
ANGLES = (0.,5.,10.,20.)
ARMS = ('rounded_carry','nominal_bpm','rounded_secant','rounded_recent_trend',
        'flat_full_difference','history_ridge','flat_tilt_bpm')
STATIC_ALIASES = ('rounded_carry','nominal_bpm','flat_tilt_bpm')


def projections(log_f):
    x = log_f - log_f.mean()

    def center(y):
        return y - np.mean(y, axis=-1, keepdims=True)

    def slope(y):
        return np.sum(center(y) * x, axis=-1, keepdims=True) / np.dot(x,x)

    def remainder(y):
        return center(y) - slope(y) * x

    return x, center, slope, remainder


def ridge_fit(history_features, history_outputs):
    X = np.vstack(history_features)
    y = np.concatenate(history_outputs)
    # A single shared regression transfers shape changes among the six nonzero
    # matched rounded conditions; all predictors are in dB after centering.
    return np.linalg.solve(X.T @ X + 2.0 * np.eye(X.shape[1]), X.T @ y)


def predictors(previous_rounded_change, current_flat_change, x, rate_step):
    return np.column_stack((previous_rounded_change, current_flat_change,
                            x * 61.0 * rate_step))


def forecast(history, freq, target_index):
    """history[(shape,trip,angle,p)] carries only permitted low-rate rounded spectra.

    Flat spectra at the target index are companion observations. The index is
    the author's nominal Reynolds series, with no claim to exact flow speed.
    """
    x, center, slope, remainder = projections(np.log10(freq))
    one = np.arange(1,target_index)
    rate = math.log10(target_index/(target_index-1))
    rate_prev = math.log10((target_index-1)/(target_index-2))
    features, outputs = [],[]
    for trip in SCHEMES:
        for angle in ANGLES[1:]:
            for j in range(3,target_index):
                ry = lambda p: center(history['rounded',trip,angle,p])
                fy = lambda p: center(history['flat',trip,angle,p])
                step = math.log10(j/(j-1))
                ratio = step / math.log10((j-1)/(j-2))
                features.append(predictors(ratio*(ry(j-1)-ry(j-2)),fy(j)-fy(j-1),x,step))
                outputs.append(ry(j)-ry(j-1))
    beta = ridge_fit(features,outputs)
    all_predictions = {}
    for trip in SCHEMES:
        for angle in ANGLES:
            rounded = np.stack([center(history['rounded',trip,angle,int(p)]) for p in one])
            previous = rounded[-1]
            last_change = rate/rate_prev * (previous-rounded[-2])
            flat_change = center(history['flat',trip,angle,target_index]-history['flat',trip,angle,target_index-1])
            past = np.log10(one[-4:])
            centered_past = past-past.mean()
            trend = (rounded[-4:]*centered_past[:,None]).sum(axis=0) / np.dot(centered_past,centered_past)
            recent = rounded[-4:].mean(axis=0)+(math.log10(target_index)-past.mean())*trend
            inferred_tilt = slope(flat_change) * x
            forecasts = {
                'rounded_carry':previous,
                'nominal_bpm': previous + (61.*rate*x if angle else 0.),
                'rounded_secant':previous + last_change,
                'rounded_recent_trend':recent,
                'flat_full_difference':previous + flat_change,
                'history_ridge':previous+predictors(last_change,flat_change,x,rate)@beta,
                # Symmetric rounded zero-incidence source is singular in BPM.
                # This compulsory control uses persistence, declared before scores.
                'flat_tilt_bpm':previous + (inferred_tilt if angle else 0.),
            }
            all_predictions[trip,angle] = np.stack([center(forecasts[a]) for a in ARMS])
    return all_predictions


def supported(freq):
    # Complete standard one-third-octave bands inside the plotting domain's
    # 1 kHz lower edge and the calibrated microphone range's 16 kHz upper edge.
    return (freq / 10**.05 >= 1000.) & (freq * 10**.05 <= 16000.)
