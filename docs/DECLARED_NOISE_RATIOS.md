# Fit a law under declared reading precision

The scalar discovery studio offers **Weighted least squares** when the original
training rows include `torqueNoiseRatio`. The ordinary least-squares default and
the explicit soft-L1 alternative remain available. A ratio is an investigator's
assumption about a reading's torque standard deviation relative to a common
reference, not a reliability score learned from its residual.

Each row assumes standard deviation `noiseSigma * torqueNoiseRatio`. Ratios must
be finite numbers from `0.000001` through `1000000`; if a training or held-out
group contains one ratio, every row in that group must contain one. Ratios have
unit `1`. The other original quantities retain their existing units. Partial,
zero, negative and unsupported declarations refuse without a weighted fallback.

## Mechanism and visible consequences

For each unchanged finite-library candidate, the maintained QR least-squares
solver receives every design row and torque divided by that row's ratio. This
minimizes the sum of squared original residuals divided by squared declared
ratios. No row is removed, no ratio is estimated, and held-out outcomes cannot
change the fit, candidate ordering, excitation planner or source assumptions.

The model retains its raw torque RMSE, every raw reading and residual, the
declared ratio and mathematical weight `1 / ratio²`. A separate normalized RMSE
is the RMS of residuals divided by ratios. Candidate scores use that normalized
error with the reference `noiseSigma`; training adequacy compares normalized
RMSE to three times that reference. Both conclusions are conditional on the
declared noise assumptions. A large raw error can coexist with conditional
adequacy and remains visible.

Numerical rank and conditioning describe the weighted design. Evidence given
negligible weight can cease to resolve a term numerically. The input-only pilot
planner still measures geometric excitation without declared torque-noise
ratios; the page explicitly distinguishes its rank from the fitted law's
weighted rank. Existing ordinary jackknife/influence diagnostics identify their
different estimator instead of silently presenting themselves as weighted ones.

Private fit reuse checks the loss identity and every original ratio. Returned
coefficients and nested metrics cannot mutate its retained fit. Moving between
ordinary, soft-L1 and weighted choices recomputes the appropriate estimator.
The maintained command-deadzone comparison carries the same original ratios
and fitting assumption into every declared command mapping.

## Original input and replay

JSON ratio-bearing sources use `worldlaw.observations/v3`; CSV adds an optional
`torqueNoiseRatio` column. Existing observation v1 remains unchanged. The offered
input v2 contract remains intact: v2 requires an explicit `offeredInputs` set,
including an empty set. A ratio-bearing v3 source may also retain that set and
never invents additional offered inputs.

Ratio-bearing source or weighted history uses `worldlaw.session/v4`. Its download
contains original base observations and declared events, never fitted answers.
Fresh browser and Node consumers recompute it. Old session v1/v2/v3 inputs retain
their existing meanings; they cannot silently carry weighted history. Switching
back to an ordinary fit keeps original ratios in subsequent source exports.
Adding a manual reading to a ratio-bearing source requires its ratio. The virtual
instrument offers no weighted choice because it supplies no such declarations.

## Executed numerical qualification

Six authored, independently evaluated mixed-precision courses retained all
121 training readings. The selected weighted law was command + spring + quadratic
drag in each. Separate raw held-out RMSE was `0.001742–0.002742 N·m`, compared with
`0.092099–0.644051 N·m` for the ordinary fit on those same courses. For seed 1337,
the ordinary error was `0.0920986336`, the weighted error `0.0017416649`, while
the weighted training **raw** RMSE remained about `1.6117873 N·m` and normalized
RMSE about `0.00896455 N·m` on the ratio-one torque scale.

An independent NumPy SVD construction checked all 594 candidate fits across
those courses: maximum coefficient difference `1.5321e-14`, maximum normalized
RMSE difference `2.2205e-16`. The retained receipt is
`docs/receipts/weighted-fit-1337/independent-numpy.json`. Two-parameter analytic
normal equations, weighted means, unit-ratio ordinary parity, global ratio/noise
rescaling, weak-rank, cache-mutation and held-out noninterference controls also
exercise the maintained solver.

Wrong declarations are informative failures: inverting which readings receive
large ratios worsens separate prediction by more than twentyfold in the authored
control. Setting every ratio to one million can make conditional adequacy pass
despite large raw mismatch. These results are retained in the native tests.
This is qualification of the declared estimator and software consumer, not
physical sensor calibration, independent noise estimation or a general accuracy
claim. Correlated or systematically biased readings need different assumptions.

Run `node --test tests/weighted-fit.test.mjs` for the focused courses. The actual
page harness is `scripts/weighted-fit-browser.mjs`, with `PLAYWRIGHT_MODULE`,
`BROWSER_EXECUTABLE_PATH` and a new `BROWSER_ARTIFACT_DIR`. It exercises original
import, keyboard application, raw/normalized errors, complete reading table,
real CSV and notebook downloads, fresh-profile and Node replay, manual append/
undo, invalid-source retention and a 390px layout. Current-source native, browser
and distributable receiving results are recorded with the integrated PR; the
presence of a harness alone is not an executed pass.
