"""Execute an unchanged released LAUM estimator and retain its electrical fit."""

from pathlib import Path
import hashlib
import json
import subprocess
import sys
import numpy as np
from clock import extract, FS

PINS = {
    "frac": "13fbaaf1d0b7d065565b0b15e11ca912898cf298",
    "mass-spring": "08c17c61a6d077a151a46314a32735d4e2c63420",
}


def run(repo, kind):
    assert (
        subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo, text=True
        ).strip()
        == PINS[kind]
    )
    sys.path.insert(0, str(repo))
    from modules.Loudspeaker import Loudspeaker

    A, _ = extract(repo / "data/test_meas.npy", {"hU", "hI", "hV"})
    U, I, V = (np.fft.rfft(A[k][:FS]) for k in ["hU", "hI", "hV"])
    f = np.fft.rfftfreq(FS, 1 / FS)
    speaker = Loudspeaker(f, U, I, V, model_Ze="Leach", model_Zm=kind)
    speaker.print_parameters()
    measured = speaker.U / speaker.I
    predicted = speaker.input_impedance_from_model()
    errs = np.abs(predicted - measured)
    imax = int(np.argmax(errs))
    return {
        "commit": PINS[kind],
        "n_fit_bins": len(errs),
        "first_last_hz": speaker.f_axis[[0, -1]].tolist(),
        "Bl": float(speaker.Bl),
        "resonance_Hz": float(speaker.f_res),
        "electrical": "Leach",
        "mechanical": kind,
        "optical_advance_sec": 0.00065,
        "Ze_coefficients": speaker.Ze_model_object.params.tolist(),
        "Zm_coefficients": speaker.Zm_model_object.params.tolist(),
        "input_impedance_relative_rms": float(
            np.linalg.norm(errs) / np.linalg.norm(measured)
        ),
        "worst_bin": {
            "Hz": float(speaker.f_axis[imax]),
            "complex_measured": [measured[imax].real, measured[imax].imag],
            "complex_predicted": [predicted[imax].real, predicted[imax].imag],
            "absolute_error": float(errs[imax]),
        },
        "fit_is_in_sample": True,
    }


if __name__ == "__main__":
    repo, kind, output = sys.argv[1:]
    target = Path(output)
    result = run(Path(repo).resolve(), kind)
    target.write_text(json.dumps(result, indent=2) + "\n")
    print("AUTHOR", json.dumps(result), flush=True)
    print(
        "COMPLETE", hashlib.sha256(target.read_bytes()).hexdigest(), target, flush=True
    )
