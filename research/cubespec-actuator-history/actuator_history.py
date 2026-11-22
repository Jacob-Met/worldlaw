"""Fit and score input-history corrections on the two CubeSpec training triplets."""
import ctypes
from pathlib import Path

import freq_statespace as fss
import numpy as np
from scipy.fft import irfft, next_fast_len, rfft

AMPLITUDES = (100, 200, 300)
MODES = ("gain", "clip", "lag", "play")
RADII = (0.25, 0.50, 1.0)
N_INIT = 100
PERIOD = 8192
PADDING = 1000


def stop_operator(path):
    double_pointer = ctypes.POINTER(ctypes.c_double)
    kernel = ctypes.CDLL(str(Path(path).resolve())).stops
    kernel.argtypes = [ctypes.c_int, ctypes.c_int, double_pointer, double_pointer, double_pointer]
    kernel.restype = None

    def apply(inputs, radii):
        values = np.ascontiguousarray(inputs, dtype=np.float64)
        radii = np.ascontiguousarray(radii, dtype=np.float64)
        if radii.shape != (values.shape[1],):
            raise ValueError("One radius is required per input series.")
        out = np.empty_like(values)
        kernel(*values.shape, *(v.ctypes.data_as(double_pointer) for v in (values, radii, out)))
        return out

    return apply


def features(inputs, scale, mode, stop):
    samples, actuators, realizations = inputs.shape
    columns = [inputs]
    if mode == "gain":
        return np.stack(columns, axis=-1)
    for index, fraction in enumerate(RADII):
        radius = scale * fraction
        if mode == "clip":
            column = np.clip(inputs, -radius[None, :, None], radius[None, :, None])
        elif mode == "lag":
            delay = 2**index
            previous = np.zeros_like(inputs)
            previous[delay:] = inputs[:-delay]
            column = inputs - previous
        elif mode == "play":
            flat = inputs.reshape(samples, actuators * realizations)
            column = stop(flat, np.repeat(radius, realizations)).reshape(inputs.shape)
        else:
            raise ValueError(f"Unknown correction {mode}")
        columns.append(column)
    return np.stack(columns, axis=-1)


def impulse_response(model, samples):
    state, input_gain, output_gain, direct = [
        np.asarray(x, dtype=np.float64) for x in (model.A, model.B_u, model.C_y, model.D_yu)
    ]
    response = np.empty((samples, 3, 3))
    response[0] = direct
    state_input = input_gain
    for t in range(1, samples):
        response[t] = output_gain @ state_input
        state_input = state @ state_input
    return response * np.asarray(model.norm.y_std).reshape(1, 3, 1) / np.asarray(model.norm.u_std).reshape(1, 1, 3)


def design(model, inputs, scale, native_forecast, stop):
    # The organizer stacks the two original periods and prepends their last
    # 1,000 applied samples. Every correction and native baseline shares it.
    stacked = np.concatenate([inputs[:, :, :, 0], inputs[:, :, :, 1]])
    padded = np.concatenate([stacked[-PADDING:], stacked])
    centered = padded - np.asarray(model.norm.u_mean).reshape(1, 3, 1)
    length = len(centered)
    fft_length = next_fast_len(2 * length - 1)
    response = rfft(impulse_response(model, length), n=fft_length, axis=0)
    designs = {}
    for mode in MODES:
        f = features(centered, scale, mode, stop)
        transformed = rfft(f, n=fft_length, axis=0)
        columns = []
        for feature in range(f.shape[-1]):
            for actuator in range(3):
                convolved = irfft(
                    response[:, :, actuator, None] * transformed[:, actuator, None, :, feature],
                    n=fft_length, axis=0,
                )[PADDING:length]
                columns.append(np.stack([convolved[:PERIOD], convolved[PERIOD:]], axis=3))
        designs[mode] = np.stack(columns, axis=-1) * 1e6
    rebuilt = designs["gain"].sum(axis=-1) / 1e6 + np.asarray(model.norm.y_mean).reshape(1, 3, 1, 1)
    discrepancy = float(np.max(np.abs(rebuilt - native_forecast)))
    limit = max(5e-11, 5e-4 * float(np.sqrt(np.mean(native_forecast.astype(np.float64)**2))))
    if discrepancy >= limit:
        raise ValueError(f"Independent linear simulation differs from native by {discrepancy:g} m.")
    return designs, discrepancy


def score(errors):
    trimmed = errors[N_INIT:]
    cells = np.sqrt(np.mean(trimmed**2, axis=0))
    t, sensor, realization, period = map(int, np.unravel_index(np.argmax(np.abs(trimmed)), trimmed.shape))
    return {
        "mean": float(cells.mean()), "channels_realizations_periods": cells.tolist(),
        "worst": {"sample": t + N_INIT, "sensor": sensor + 1, "training_realization": realization + 4,
                  "period": period + 1, "error_um": float(trimmed[t, sensor, realization, period])},
    }


def fit(training, models_dir, library, output):
    with np.load(training, allow_pickle=False) as data:
        expected = {f"{kind}_{amp}mV_train" for amp in AMPLITUDES for kind in ("u", "y")}
        if set(data.files) != expected:
            raise ValueError("Expected precisely the six training-only input and displacement arrays.")
        measurements = {amp: (data[f"u_{amp}mV_train"], data[f"y_{amp}mV_train"]) for amp in AMPLITUDES}
    models = {p.stem: fss.load_model(p) for p in Path(models_dir).glob("*.zip")}
    if len(models) != 5:
        raise ValueError("All five pinned author models are required.")
    stop = stop_operator(library)
    paths = np.array([[0., 0.], [2., -2.], [0., 0.]])
    if not np.array_equal(stop(paths, np.ones(2))[-1], [-1., 1.]):
        raise AssertionError("The matched current input must retain two different stop histories.")
    scale = measurements[100][0][:, :, :3, :].std(axis=(0, 2, 3))
    blocks, streams, scores, parity = {}, {}, {}, {}
    for amp, (inputs, truth) in measurements.items():
        if inputs.shape != (PERIOD, 3, 6, 2) or inputs.shape != truth.shape:
            raise ValueError(f"Unexpected tensor shape at {amp} mV")
        native = {name: model.simulate(inputs, offset=PADDING)[0] for name, model in models.items()}
        scores[amp] = {name: score(1e6 * (pred[:, :, 3:, :] - truth[:, :, 3:, :])) for name, pred in native.items()}
        streams[amp] = {"truth_m": truth[:, :, 3:, :], "input_V": inputs[:, :, 3:, :],
                        **{name + "_m": pred[:, :, 3:, :] for name, pred in native.items()}}
        key = f"bla_{amp}mV"
        designs, parity[amp] = design(models[key], inputs, scale, native[key], stop)
        blocks[amp] = (1e6 * (truth - native[key]), designs)
    coefficients = {}
    for mode in MODES:
        width = blocks[100][1][mode].shape[-1]
        gram = np.zeros((width, width))
        rhs = np.zeros(width)
        count = 0
        for residual, designs in blocks.values():
            x = designs[mode][N_INIT:, :, :3, :, :].reshape(-1, width)
            y = residual[N_INIT:, :, :3, :].reshape(-1)
            gram += x.T @ x
            rhs += x.T @ y
            count += len(y)
        norm = np.sqrt(np.diag(gram) / count)
        coef = np.linalg.solve(gram + 1e-6 * count * np.diag(norm**2), rhs)
        coefficients[mode] = coef.tolist()
        for amp, (residual, designs) in blocks.items():
            correction = designs[mode][:, :, 3:, :, :] @ coef
            name = "correction_" + mode
            scores[amp][name] = score(correction - residual[:, :, 3:, :])
            streams[amp][name + "_m"] = streams[amp][f"bla_{amp}mV_m"].astype(np.float64) + correction * 1e-6
    for amp, arrays in streams.items():
        np.savez_compressed(output / f"development-streams-{amp}mV.npz", **arrays)
    return {"scores_um": scores, "coefficients": coefficients, "linear_native_discrepancy_m": parity,
            "fit_100mV_voltage_rms": scale.tolist(), "held_displacement_members_opened": []}
