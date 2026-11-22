"""Measure how much trajectory information the EMPS feedback command contains."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat

TRAIN_SHA256 = "6cf6814ae14618795da0101aae2bb97ff0c6351b0501b5492751b02b07facf7e"
PULSE_GIT_BLOB = "d09babe102db6f51407c8b0e44171fc01b6cf32e"
SAMPLE_PERIOD_S = 0.001
INITIALIZATION_SAMPLES = 20


def recording(path, *, training):
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    expected = TRAIN_SHA256 if training else PULSE_GIT_BLOB
    actual = sha if training else blob
    if actual != expected:
        raise ValueError(f"Unexpected EMPS recording {path.name}: {actual}")
    variables = ["qm", "vir", "t"]
    if training:
        variables.extend(["qg", "gtau", "kp", "kv"])
    data = loadmat(path, variable_names=variables, squeeze_me=True)
    return data, sha


def invert(voltage, reference, kp, kv):
    """Invert the released two-sample digital derivative and nested PD controller."""
    if reference.shape != voltage.shape:
        raise ValueError("Training and evaluation schedules have different lengths.")
    inverse_dt = 1 / (2 * SAMPLE_PERIOD_S)
    position = np.zeros_like(voltage, dtype=np.float64)
    for k in range(2, len(voltage)):
        numerator = kp * reference[k] + inverse_dt * position[k - 2] - voltage[k] / kv
        position[k] = numerator / (kp + inverse_dt)
    return position


def measure(position, prediction):
    anchor = INITIALIZATION_SAMPLES - 1
    anchored = prediction + (position[anchor] - prediction[anchor])
    error_mm = 1000 * (anchored[anchor + 1:] - position[anchor + 1:])
    worst = int(np.argmax(np.abs(error_mm)))
    return {
        "scored_samples": len(error_mm),
        "rmse_mm": float(np.sqrt(np.mean(error_mm**2))),
        "worst_index": worst + anchor + 1,
        "worst_signed_mm": float(error_mm[worst]),
    }


def audit(training_path, evaluation_path=None):
    train, train_sha = recording(training_path, training=True)
    if evaluation_path is None:
        data, data_sha = train, train_sha
    else:
        data, data_sha = recording(evaluation_path, training=False)
    reference = train["qg"]
    voltage = data["vir"]
    kp, kv = float(train["kp"]), float(train["kv"])
    gain = float(train["gtau"])
    modes = {
        "source_reference": reference,
        "controller_inverse": invert(voltage, reference, kp, kv),
        "shifted_reference_inverse": invert(voltage, np.roll(reference, 100), kp, kv),
    }
    return {
        "train_sha256": train_sha,
        "evaluated_sha256": data_sha,
        "initialization_samples": INITIALIZATION_SAMPLES,
        "reference_source": "pinned training recording at the original sample index",
        "command_unit": "V",
        "motor_gain_N_per_V": gain,
        "same_step_inverse_sensitivity_m_per_V": -1 / (kv * (kp + 1 / (2 * SAMPLE_PERIOD_S))),
        "roles": {name: measure(data["qm"], prediction) for name, prediction in modes.items()},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("training_mat", type=Path)
    parser.add_argument("--pulse-mat", type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.training_mat, args.pulse_mat), indent=2))
