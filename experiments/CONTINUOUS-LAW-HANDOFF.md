# Continuous actuator discovery development results

## Status

This branch contains a continuous actuator planner, independent controlled ODE instrument, prospective residual receiver, derivative SINDy comparator, JSON CLI consumer, and six-world development harness in the maintained Worldlaw core. The maintained tests, real application smoke, real trajectory smoke and six-world development course passed together on the repaired original policy.

No calibration or final evaluation world has been opened. The harness implements only development and refuses other stages. The JSON calibration/evaluation specifications remain plans. The development result covers the declared known-inertia scalar instrument and finite feature library.

## Matched development results

The two source recordings used only −1, 0 and +1, where the linear and cubic command columns coincide. Strict recovery required exact support, normalized coefficient error at most 0.1, and an executable forecast on an independent holdout recording.

| Estimator | Source only | Random continuous commands | Frozen active commands |
| --- | ---: | ---: | ---: |
| Weak equation fit | 3/6 | 6/6 | 6/6 |
| Derivative SINDy | 0/6 | 5/6 | 5/6 |

Active held-position RMS was lower than random in four worlds. The medians were 1.045 and 1.095 noise units, respectively. Linear Duffing was the worst reversal, at 1.584 active versus 1.082 random. The two policies tied on strict recovery.

An alternative that scored all viable actuator/restoring-law combinations recovered 2/6. In the two spring and two gravity worlds, its best refined minimum separation at the first round was 0.040, 0.210, 1.817 and 0.158 noise units, respectively. All four fell below the fixed threshold of 3. The two-rival planner was retained. [Matched qualification run and raw archives](https://github.com/Jacob-Met/worldlaw/actions/runs/45268239303) · [Rejected alternative](https://github.com/Jacob-Met/worldlaw/pull/875)

## Reproducing the development course

Run `make qualify-continuous-law` from a clean Node 20+ checkout with `ARTIFACT_DIR` set to a new output directory. The driver retains two artifacts.

- `continuous-law-qualification.json`
- `continuous-law-development.tgz`

The worker must provide ARTIFACT_DIR. The driver runs all maintained tests with concurrency two, then the real app and trajectory smoke scripts. Only after those pass does it run six development worlds. It archives failures and all created evidence. Bind the original dispatch repository/commit receipt separately; the worker's source archive has no Git metadata.

The development course compares active and random continuous commands with two source runs plus two acquisitions each (804 observations). Derivative SINDy receives exactly the recordings used by its paired weak-fit arm. Every plan is fully written, fsynced and read back before acquisition; all final predictions precede the final observation. Rollout refusals are failures in the strict recovery metric even if fit-only support matches.

The trusted fixed learner receives recordings and declared settings, never generating coefficients. The generator and seeds remain accessible in this repository; this is not cryptographic blinding or an independent external oracle. Notebook replay checks consistency, not physical authentication or an external timestamp.

## Remaining work

1. Qualify the installed downstream numeric consumer using its separately retained private combined-source snapshot. Keep private contents out of this public repository.
2. Implement the planned disjoint-world calibration/evaluation only after development qualification. Keep acquisition, fitting and stopping fixed. Refuse calibration when any reference world is incomplete.
3. Run the separately specified Nullgarden world-level label sham. It is an association diagnostic, not a substitute for residual calibration.
4. Keep every frozen world in each denominator, including whole-world failures. A non-rejected residual is inconclusive.
5. The broad noisy PDE/hidden-mechanism discovery goal remains open. This known-inertia scalar finite-library increment cannot establish it alone.

## Method sources

- https://doi.org/10.1073/pnas.1517384113
- https://arxiv.org/abs/1605.06682
- https://doi.org/10.1137/20M1343166
