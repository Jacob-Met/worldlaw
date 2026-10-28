# Nearby releases from a saved notebook

`scripts/nearby-releases.mjs` compares three conditional predictions from the
same recomputed notebook law: a nominal release, the nominal release plus one
declared initial-state perturbation, and the nominal release plus half that
perturbation. All three use the maintained Studio dynamics executor.

This answers a bounded question: **how does this particular finite initial
difference evolve over this declared run?** The report retains trajectories,
raw position and rate differences, the numerical method, and failures.

## Run it

Export a notebook from WORLDLAW, then run from the source distribution:

```sh
node scripts/nearby-releases.mjs \
  --notebook saved-notebook.json \
  --position 0 --rate 0 \
  --delta-position 0 --delta-rate 0.01 \
  --command 0 --inertia 1 \
  --duration 4 --interval 0.01 --time-scale 1 > nearby-releases.json
```

`--notebook`, `--position`, `--rate`, `--delta-position`, `--delta-rate`,
`--command` and `--inertia` are required. Both perturbation components must be
supplied, even when one is zero.

Position is unwrapped radians, rate is rad/s, command is N*m, and inertia is
kg*m^2. The nominal starting state, perturbation, command and inertia are
declarations for this prediction. They do not add acquired evidence to the
notebook.

The command replays the original notebook source and events through
`restoreSession`, including recomputing its candidate laws. It uses the
recomputed selected candidate by default. To compare a particular recomputed
candidate, supply its exact ID with `--model`. An ID absent from that notebook's
recomputed candidate set is refused. Cached discovery or trajectory data
cannot substitute for replay.

The output includes the SHA-256 and byte count of the original file, observation
and event counts, selected and executed candidate IDs, model terms and
coefficients, starting states, and requested and actual perturbations. The
input notebook is opened read-only, bounded by the maintained notebook byte
limit, decoded as strict UTF-8, and never written.

For reproducibility, retain the notebook and JSON report together with the
source commit and Node.js version used to run the command. A notebook hash
identifies the input bytes; it does not identify the replay or solver version.

## Read the result

The JSON schema is `worldlaw.nearby-releases/v1`.

| Field | Meaning |
| --- | --- |
| `courses.nominal/full/half` | Each solver outcome, its starting state, trajectory and diagnostics when complete, or its original error code and reason. |
| `initialPerturbations` | Requested full/half shifts and actual representable differences after adding them to the starting state. |
| `comparisons.full/half.rows` | Common output times, raw position and rate differences, weighted distance, and response factor relative to that course's actual initial difference. |
| `comparisons.*.sampledMaximum` | Largest factor among the returned output rows, with the first time at which it occurs. |
| `sizeComparison.rows` | Twice the half-amplitude difference minus the full-amplitude difference, plus the difference between the two response factors. |
| `sizeComparison.exactHalfInitialDifference` | Whether the actual half shift is exactly one half of the actual full shift in both components. |
| `work` | Three-course reservations, trials reported by completed adaptive courses, and whether failed-course work is unavailable. |

For a time scale `tau = --time-scale` in seconds, the declared distance is

```text
hypot(position difference, tau * rate difference)
```

Its unit is radians; the response factor is dimensionless. The denominator is
the actual representable starting distance of the relevant full or half
course. A factor above one means that this weighted distance has grown relative
to its own starting value. It does not by itself imply exponential growth.

The time scale changes the way position and rate differences are weighted.
It does not change any solver trajectory. Choose and report it explicitly
when comparing results. Different time scales can give different factors for
the same pair of trajectories.

A simple exact control makes the distinction concrete. For zero torque,
a pure rate perturbation `dv` has position difference `t * dv` and constant
rate difference `dv`. Its factor is `sqrt(1 + (t / tau)^2)`; it is
`sqrt(2)` at `t = tau`. That is the response of this direction. It is not the
largest possible response over all starting directions.

## Synthetic nonzero-command control

An authored synthetic notebook with torque `command - position - rate` gives,
for declared inertia 1 and command 0.5, the equation
`q'' = 0.5 - q - q'`. This is a mathematical control, not acquired physical
evidence. A nominal release at position 0.5 and rate 0 stays at that state.
Use `--position 0.5 --rate 0 --delta-position 0.02 --delta-rate 0
--command 0.5 --inertia 1 --duration 1 --interval 0.05 --time-scale 1`
with that exported notebook to compare a nearby release.

For initial position difference `a` and zero rate difference, the independent
exact solution is, with `omega = sqrt(3) / 2`,

```text
delta_q(t) = a * exp(-t/2) * (cos(omega*t) + sin(omega*t)/sqrt(3))
delta_v(t) = -2*a * exp(-t/2) * sin(omega*t)/sqrt(3)
```

At one second, `a = 0.02` gives position difference approximately
`0.013194003067834` radians and rate difference `-0.010670143902294` rad/s.
For time scale 1 second, the predicted response factor is approximately
`0.848430444777`. The half-amplitude differences are half as large, with the
same factor in exact arithmetic. These are analytic reference values;
recomputed fit coefficients, integration and floating-point arithmetic affect
the CLI comparison and must be checked in its actual report.

## Try a retained notebook: positive power with shrinking separation

The source distribution includes
`evidence/conditional-rate/conditional-notebook.json`, a Studio export
of an **authored synthetic** example, “Authored active-law falsification of
imposed dissipation.” Its browser-export provenance belongs to
[issue #220](https://github.com/Jacob-Met/worldlaw/issues/220) and
[PR #223](https://github.com/Jacob-Met/worldlaw/pull/223). This comparison
reads those original bytes unchanged.

The exact input is 11,345 bytes, schema `worldlaw.session/v1`, with SHA-256:

```text
a0828dd0ff6c40aed16bc3c6e8c6af18677c54dedf4d70736f87a68ae265a685
```

It contains 60 training observations, 20 held-out rows and no events. All
20 held-out rows duplicate training rows exactly, so they provide no
independent unseen-data check. The source identifies its declared kind as
synthetic even though the exported source kind is `user-supplied`.

Replaying this notebook reconstructs candidate `rate+coulomb+quadratic`,
with torque approximately `8*v - sign(v) - 8*v*abs(v)`. Ask whether positive
model rate power, `torque * v`, necessarily makes nearby releases separate.
Run these commands from the source distribution:

```sh
node scripts/nearby-releases.mjs \
  --notebook evidence/conditional-rate/conditional-notebook.json \
  --model rate+coulomb+quadratic \
  --position 0 --rate 0.25 --delta-position 0 --delta-rate 0.02 \
  --command 0 --inertia 1 \
  --duration 0.1 --interval 0.001 --time-scale 1 > nearby-low-rate.json

node scripts/nearby-releases.mjs \
  --notebook evidence/conditional-rate/conditional-notebook.json \
  --model rate+coulomb+quadratic \
  --position 0 --rate 0.75 --delta-position 0 --delta-rate 0.02 \
  --command 0 --inertia 1 \
  --duration 0.1 --interval 0.001 --time-scale 1 > nearby-high-rate.json
```

Each command compares nominal, full `+0.02 rad/s`, and half `+0.01 rad/s`
releases. Inertia is **declared** as 1 kg*m^2, and the norm time scale is
**declared** as 1 second. At the single chosen horizon of 0.1 seconds,
the actual CLI results from the fresh package of published commit
`f638f614f75de6ff798114fd7389ecde61d5bf8f` were as follows. Factors come from
the CLI reports; power ranges are calculated from the recomputed law at the
returned states.

| Nominal rate (rad/s) | Full response factor | Half response factor | Sampled rate power across all three courses (W) |
| --- | ---: | ---: | ---: |
| 0.25 | 1.403456934777 | 1.416861948098 | 0.125000 to 0.267804 |
| 0.75 | 0.644065343618 | 0.648206073117 | 0.211240 to 0.375000 |

Read the final entries of `comparisons.full.rows` and
`comparisons.half.rows` in each report. Both runs have positive sampled
power, but the higher-rate run's selected nearby-release distance shrinks.
**Positive power does not imply growth of this finite separation.** The
full and half factors also differ: reducing the initial perturbation changes
the finite response.

For positive rates the ideal law obeys `v' = 8*v - 1 - 8*v*v` at the declared
inertia. Two such courses satisfy
`delta_v' = (8 - 8*(v_perturbed + v_nominal))*delta_v`. The coefficient is
positive for the lower-rate courses and negative for the higher-rate courses.
An independent closed-form solution using the exact recomputed coefficients
(`8.000000000000004`, `-1.0000000000000004`, `-8.000000000000004`) agreed
with the received response factors to within approximately `1.1e-12`. The
equation above is the rounded illustration; this comparison checks these
particular runs and is not a general numerical error bound.

All returned rate samples in the six courses were positive and within the
observed **rate** range. The courses
used the maintained Coulomb fixed-step RK4 branch: 100 steps, 101 samples per
course, with no adaptive error estimate or sticking interpretation. They do
not test a zero-rate crossing. Their positions immediately leave the only
observed position, zero. Because every source row also has command zero,
command-dependent and restoring-position terms are unidentified here. For
example, adding `k*position` leaves every source row unchanged but can change
later motion; it is not another reconstructed candidate in this comparison.

Keep these results conditional on the selected law, declared inertia, norm,
direction and horizon. They do not establish physical validity, behavior at
other positions or commands, maximum gain, global stability, or a
variational derivative. The original notebook remains unchanged; a separate
conditional constrained fit shown in the original browser workflow is not
reconstructed as a candidate merely by exporting this notebook.

## Two finite amplitudes

The full and half courses expose whether a finite-amplitude conclusion changes
when the perturbation is smaller. Linear dynamics give proportional differences
in exact arithmetic. Nonlinear dynamics can give different factors.

Numerical integration and floating-point subtraction also affect this
comparison. If the half and full initial shifts are not exactly proportional
after rounding, `exactHalfInitialDifference` is false and even the initial
twice-half-minus-full row may be nonzero. If any requested nonzero component
rounds away in either initial shift, the command refuses the comparison.
Nonrepresentable distances or ratios remain unavailable rather than becoming
apparently valid numbers.

Agreement between two amplitudes is not a numerical convergence result,
integration-error bound, exact tangent or variational derivative, or physical
validation. Very small perturbations can be dominated by solver error and
subtraction. The report keeps actual differences, tolerances and diagnostics
so that those limitations remain visible.

## Numerical execution and bounded work

`--interval` sets returned output times and caps the smooth executor's internal
trial step; adaptive refinement can take smaller steps. Smooth laws use the
existing adaptive RK4 step-doubling executor.
A law with a nonzero Coulomb term keeps the existing fixed-step RK4 branch,
using this interval as the nominal step with the final step clamped to duration,
whose diagnostics do not assert an adaptive local-error estimate or a sticking
model. The comparison never replaces a failed adaptive run with the fixed-step
method.

All courses use identical command, inertia, duration, output interval and
tolerances:

| Option | Default | Accepted range |
| --- | --- | --- |
| `--duration` | 4 seconds | Greater than 0, at most 1000 |
| `--interval` | 0.01 seconds | Greater than 0, at most 1; at most 10,000 output intervals |
| `--inertia` | Required | Greater than 0, at most 1e12 |
| `--time-scale` | 1 second | Greater than 0, at most 1e6 |
| `--max-trials` | 50,000 per adaptive course | Integer from 1 through 100,000 |
| `--relative-tolerance` | 1e-8 | 1e-14 through 0.01 |
| `--position-tolerance` | 1e-10 | 1e-14 through 0.01 |
| `--rate-tolerance` | 1e-10 | 1e-14 through 0.01 |

The relative tolerance is dimensionless. The absolute position tolerance is
in radians, and the absolute rate tolerance is in radians per second.

Starting position, rate, each perturbation component, command, and the shifted
starting position and rate must have magnitude at most 1e6. The perturbation
must be nonzero. Maintained solver state and prediction bounds still apply
during each course.

The reservations are at most `3 * maxTrials` adaptive trials, or
`3 * ceil(duration / interval)` fixed steps, depending on the existing
solver branch. They are ceilings, not observed work or elapsed-time promises.
`completedAdaptiveTrials` counts only diagnostics returned by completed
courses. Failed courses do not return a partial trajectory or trial count;
their executed duration is unknown and `failedCourseWorkUnknown` is true.

Each course is executed independently even if another fails. A completed
nominal-plus-half comparison remains useful if the full course fails. A
comparison that requires a failed course stays unavailable, and the overall
report is incomplete.

| Exit code | Output |
| --- | --- |
| 0 | JSON with a complete three-course comparison. |
| 2 | JSON preserving incomplete comparisons and original solver failures. |
| 1 | Refusal on stderr, with no report on stdout. |

`--help` is the exception: it returns command-reference text with exit code 0,
not a JSON comparison.

Unknown, repeated or incomplete flags, nondecimal numeric values, nonfinite
values, numbers that underflow to zero, invalid files and missing model IDs
are refused. `--help` prints the command reference.

## Interpretation boundary

This is a prediction conditional on one recomputed fitted law and declared
release conditions. It is not a measurement, maximum gain over all directions,
maximum between the sampled times, instantaneous eigenvalue calculation,
Lyapunov exponent, global stability result, or confirmation that the fitted
law describes physical reality. The existing balance and local-response
features answer different questions and retain their own ownership and
numerical contracts.

A shrinking difference in one chosen direction cannot establish stability.
For example, in the synthetic equation `q'' = q`, the initial difference
`(delta_q, delta_v) = (epsilon, -epsilon)` evolves as
`(epsilon * exp(-t), -epsilon * exp(-t))`: its reported factor decays for any
fixed positive time scale. The different initial direction
`(epsilon, epsilon)` grows as `exp(t)` in the same system. A finite-direction
comparison can therefore shrink while a growing mode exists.

## Receiving controls

The native tests include independent analytic free-particle, critically damped,
oscillatory and unstable-spring solutions; a nonlinear amplitude check;
time-scale invariance of trajectories; representable and rounded-away shifts;
budget exhaustion; and partial-evidence preservation when one course fails.

The CLI tests invoke the actual command against a notebook produced by the
maintained session exporter. They check recomputed source, exact input-byte
hashes, unchanged files, ignored forged caches, rejected model IDs and invalid
input, and retained failure JSON. These tests are included with the source
distribution alongside the module and CLI.
