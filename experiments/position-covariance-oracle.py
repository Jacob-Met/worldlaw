"""Independent numerical oracle for the frozen position-covariance comparison.

Requires NumPy and SciPy. The production JavaScript integrator never generates
these trajectories. All forty courses, including adverse families, are retained.
"""
import argparse
import json
import platform
from pathlib import Path

import numpy as np
import scipy
from scipy.integrate import solve_ivp

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
args = parser.parse_args()
rng = np.random.default_rng(0x51A7E29)
cases = []
for kind in ["linear", "gravity", "cubic", "correlated", "forced"]:
    for index in range(8):
        frequency = float(rng.uniform(.8, 3.5))
        damping = float(rng.uniform(.05, .4))
        cubic = float(rng.uniform(.2, 1.2))
        initial = [float(rng.uniform(.4, 1.4)), float(rng.uniform(-.25, .25))]
        next_initial = [float(rng.uniform(-1.1, -.3)), float(rng.uniform(.15, .6))]
        times = np.arange(601) * .02
        challenge_times = np.arange(401) * .025

        def ode(t, state):
            q, v = state
            restore = frequency ** 2 * (np.sin(q) if kind == "gravity" else q)
            nonlinear = cubic * q ** 3 if kind == "cubic" else 0
            forced = .2 * np.sin(.7 * t + .3) if kind == "forced" else 0
            return [v, -damping * v - restore - nonlinear + forced]

        def solve(start, clock):
            result = solve_ivp(ode, [0, float(clock[-1])], start, t_eval=clock,
                               method="DOP853", rtol=1e-12, atol=1e-13)
            assert result.success
            return result.y[0]

        training = solve(initial, times)
        challenge = solve(next_initial, challenge_times)
        sigma = .01
        noise = rng.normal(0, sigma, len(times))
        if kind == "correlated":
            for i in range(1, len(noise)):
                noise[i] = .9 * noise[i - 1] + np.sqrt(1 - .9 ** 2) * noise[i]
        terms = (["rate", "gravity"] if kind == "gravity" else
                 ["rate", "spring", "cubic"] if kind == "cubic" else
                 ["rate", "spring"])

        def run(label, clock, positions, rate):
            return dict(id=label, kind="synthetic", dynamics="unforced_scalar_rotation",
                        inertia=None, initialRate=rate,
                        source=dict(label="Independently authored SciPy DOP853 " + kind + " " + label),
                        samples=[dict(time=float(t), position=float(q))
                                 for t, q in zip(clock, positions)])

        cases.append(dict(kind=kind, index=index,
                          parameters=dict(frequency=frequency, damping=damping, cubic=cubic),
                          training=run("earlier", times, training + noise, initial[1]),
                          challenge=run("separate-release", challenge_times, challenge, next_initial[1]),
                          options=dict(terms=terms, maxTerms=len(terms), noiseSigma=sigma,
                                       windowDuration=1, windowStride=.025, rateWindowSize=9)))
output = dict(oracle="SciPy DOP853 rtol1e-12/atol1e-13; PCG64 seed0x51A7E29",
              environment=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__),
              cases=cases)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output) + "\n")
print(json.dumps(dict(cases=len(cases), output=str(args.output), environment=output["environment"])))
