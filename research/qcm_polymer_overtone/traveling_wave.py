"""Check both passive film loads from forward and reflected traveling waves."""
import cmath
import json
import math
import sys
from pathlib import Path


def verify(receipt):
    max_abs = 0.0
    omega_ref = math.tau * 25e6
    for harmonic, row in receipt["curves"].items():
        omega = math.tau * 5e6 * int(harmonic)
        ratio = omega / omega_ref
        elastic = 250000 + 300000 * ratio**2 / (1 + ratio**2)
        viscous = omega * (0.008 - 150000 / omega_ref) + 300000 * ratio / (1 + ratio**2)
        for label, shear in (("KV", complex(400000, omega * 0.008)),
                             ("relaxation", complex(elastic, viscous))):
            impedance = cmath.sqrt(1100 * shear)
            wave_number = omega * 1100 / impedance
            backing = cmath.sqrt(1j * omega)
            reflected = (backing - impedance) / (backing + impedance)
            reflected *= cmath.exp(-2j * 42e-9 * wave_number)
            reconstructed = impedance * (1 + reflected) / (1 - reflected)
            residual = abs(reconstructed - complex(*row[label]))
            assert residual < 1e-9, (harmonic, label, residual)
            max_abs = max(max_abs, residual)
    assert set(receipt["curves"]) == {"3", "5", "7", "9", "11", "13"}
    return {"loads_compared": 12, "max_absolute_error_Pa_s_per_m": max_abs}


if __name__ == "__main__":
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text())), sort_keys=True))
