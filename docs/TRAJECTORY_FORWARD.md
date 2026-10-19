# Independent forward trajectory challenge

`src/trajectory/forward.mjs` exports `rollout(model, run, options)` and
`TrajectoryRolloutError`. This executes an existing scalar torque model against
timestamped positions. It does not fit parameters or update the model.

```js
import { rollout } from './src/trajectory/forward.mjs';
const result = rollout(model, {
  id: 'challenge-1', label: 'Independent encoder run', kind: 'measured',
  inertia: 0.5, initialRate: 0,
  source: { label: 'Encoder recording with independently supplied initial rate' },
  samples: [
    { time: 0, position: 0.4, command: 0.2 },
    { time: 0.125, position: 0.41, command: -0.1 },
    { time: 0.3, position: 0.39, command: 0 },
  ],
}, { maxStep: 0.01, maxSteps: 200000 });
```

## Integration and evidence semantics

The model must be executable `worldlaw.torque-model/v1` from the existing finite
torque library. Every RK4 derivative calls the existing `predict()` function.
The solver integrates θ′ = ω and ω′ = predicted net torque / inertia. Positions
are unwrapped radians, rates rad/s, times seconds, commands N·m, and inertia
kg·m². The caller must supply initial rate independently of future challenge
positions. The solver never estimates it.

Initial position comes only from the first sample. No subsequent observation
resets the evolving position or rate. `samples[i].command` is held throughout
`[samples[i].time, samples[i+1].time)`, including the final RK4 stage used to
integrate that interval. The final sample's command is recorded but never drives
the already-completed run. Each interval is divided into `ceil(duration/maxStep)`
equal steps, so command changes and original sample timestamps are exact output
boundaries. Integration uses local interval durations rather than repeatedly
adding steps to epoch timestamps. Shifting timestamps preserves dynamics when
the shifted timestamps preserve the same representable intervals; precision
already lost when encoding timestamps cannot be recovered.

The result schema is `worldlaw.trajectory-rollout/v1`, with `modelId`, `runId`,
`rows`, `metrics`, and `diagnostics`. A model without an ID receives a term-list
ID, or `zero` for an empty model. Every row contains
`{time, observed, predicted, rate, residual, command}`; residual means observed
minus predicted. Metrics contain `count`, `positionRMSE`, `maxAbsError`, and
`finalAbsError`, all position errors in radians. The exactly initialized first
sample is excluded from all metrics. Inputs are copied and never mutated.

## Bounds and failure behavior

- A run requires 2–10,000 samples, strictly increasing finite timestamps, finite
  intervals and total duration, nonempty ID/label/source label (up to 512
  characters each), and kind `synthetic`, `measured`, or `unknown`.
- Inertia is positive and at most 10¹² kg·m². Commands, observed positions,
  initial rate, intermediate RK4 positions/rates, and completed solver states
  stay within magnitude 10⁶, matching the executable predictor's input bounds.
  Model coefficients have magnitude at most 10¹⁸.
- `maxStep` is finite and positive; default 0.01 seconds. `maxSteps` is an integer
  from 1 to 1,000,000; default 200,000. The complete interval step budget is
  checked before integration, so excessive work never returns partial success.
- Errors are `TrajectoryRolloutError` with code `invalid_model`, `invalid_run`,
  `invalid_options`, `step_limit`, `runaway_state`, or `numerical_failure`.
  Nonfinite acceleration/state and bounded-state violations fail immediately.

These are computational guardrails, not mechanical safety limits. A finite
result does not establish physical validity, stiffness stability, parameter
identifiability, or uncertainty. Fixed-step RK4 does not estimate numerical error;
discontinuous Coulomb sign changes may need smaller steps and an event-aware
solver. Forward residuals combine law mismatch with errors in observations,
initial conditions, command timing, inertia, and integration. The held-out
split and measurement provenance remain the caller's responsibility.

The test suite retains a concrete finite-but-inaccurate case: θ″ = −100θ′,
θ(0) = 0, θ′(0) = 1, sampled every 0.03125 seconds through 0.125 seconds.
Its independent exact position is `(1-exp(-100*t))/100`. A 0.03125-second
step produces position RMSE about 0.04566 rad; a 0.001-second maximum step
produces RMSE below 10⁻⁹ rad. Both outputs are finite.

## Optional numerical resolution comparison

`src/trajectory/resolution.mjs` exports
`rolloutWithResolution(model, run, {maxStep: 0.01, maxSteps: 200000})`. It reuses
the forward solver at the requested step and half that step. Its output is
`{rollout, resolution}`: `rollout` is the complete unchanged coarse result, and
`resolution` separately reports numerical sensitivity.

When `resolution.status` is `compared`, `positionRMSEDifference` is the RMS
difference between the two **predicted positions**, and
`maxAbsPositionDifference` is their maximum absolute difference. Neither metric
uses later observed positions; both exclude the initialized first sample. These
values are not differences between the two observation RMSE scores.

One combined `maxSteps` budget covers both executions. The wrapper completes
the coarse run, subtracts its step count, and passes only the remaining budget
to refinement. `stepsCoarse`, `stepsRefined`, and `combinedSteps` report completed
work for a successful comparison. If refinement does not fit in the remaining
budget, it is rejected by the forward solver's preflight and returns
`status: unavailable`, `reason: combined_step_budget`, and null discrepancy
metrics and `stepsRefined`. A half step below floating-point representation also
returns unavailable. A numerical or runaway refusal during refinement retains
the coarse result with `reason: refinement_execution_refused` and the typed
failure code/message. Coarse failures continue to throw `TrajectoryRolloutError`.
Unavailable refinement never means the two resolutions agree.

The result includes both requested maximum steps, the remaining refinement
budget, and explicit interpretation/limitations. Resolution agreement can miss
shared numerical bias; nonsmooth Coulomb sign changes and stiffness can defeat
smooth RK4 convergence assumptions. The comparison is numerical sensitivity,
**not a calibrated accuracy bound, a physical-law validation, or a reason to
rerank training hypotheses**.

Run `node tests/trajectory-resolution-92be.test.mjs` for independent harmonic
convergence, stiff-law discrepancy, combined-budget, input-integrity, and typed
refusal checks.

## Sampled prediction-error horizon

`src/trajectory/horizon.mjs` exports
`summarizePredictionHorizon(rollout, {positionTolerance})`. The tolerance is a
required positive finite number in radians. This summary reads the already
computed rollout and does not fit models, rerank candidates, or run the solver.
Changing the tolerance therefore only changes the comparison criterion.

The result schema is `worldlaw.trajectory-horizon/v1`, with the same `modelId`
and `runId`, the original `sourceSchema`, `positionTolerance`, and these fields:

- `status`: `threshold_exceeded` or `not_exceeded_at_samples`.
- `firstExceeded`: `{index, time, elapsed, absoluteError}`, or null. Indices are
  original rollout indices; elapsed time is relative to the first timestamp.
- `previousSample`: `{index, time, elapsed}`, or null when nothing exceeds.
  This is the preceding sampled boundary. If the first evaluated point exceeds,
  it is t0; t0 is still excluded from error statistics.
- `lastWithin`: the latest evaluated `{index, time, elapsed, absoluteError}`
  within tolerance, or null. It may occur **after** the first exceedance.
- `count`, `withinCount`, `exceededCount`, and `withinFraction`: statistics over
  all samples after t0. Equality to the tolerance counts as within.

Positive and negative residuals are treated symmetrically. The helper validates
finite source rows, strictly increasing timestamps, consistent
`residual = observed - predicted`, exact t0 initialization, and source identity.
It preserves input arrays and throws `TrajectoryHorizonError` with code
`invalid_options` or `invalid_rollout` on invalid contracts.

This is a **sampled first exceedance**, not an interpolated or continuous-time
prediction horizon. A threshold crossing and return between observations can
be missed. Neither no sampled exceedance nor a user-selected tolerance establishes
physical validity or calibrated uncertainty. Run
`node tests/trajectory-horizon-92be.test.mjs` for irregular-time crossings,
threshold equality, symmetric errors, initialization exclusion, real-rollout
consumption, input integrity, and explicit failure behavior.

## Angular-acceleration recordings with unknown physical scale

`src/trajectory/angular-resolution.mjs` exports
`rolloutAngularWithResolution(model, run, options)`. It wraps the angular
rollout through the same shared numerical comparison implementation, including
one combined step budget, preserved coarse failures, and unavailable-refinement
semantics. Its `rollout` retains `worldlaw.angular-rollout/v1`, radian position
and angular-rate units, `physicalInertia: null`, and no torque-command channel.
The private numerical factor used by angular execution does not identify an
apparatus inertia or an absolute torque scale.

The horizon helper also accepts `worldlaw.angular-rollout/v1` when the declared
position, time, and rate units are `rad`, `s`, and `rad/s`. It checks the same
sampled position errors while rejecting fabricated command or torque fields.
For this mode, residual limitations name unrecorded forcing and unknown physical
scale rather than implying that command or inertia was measured. Neither helper
changes fitted coefficients, training order, or the supplied initial rate.

Run `node tests/trajectory-angular-resolution-92be.test.mjs` for analytic
harmonic motion, retained stiff numerical error, combined-budget refusal,
angular unit preservation, input integrity, and typed failures.

## Verification

Run `node --test tests/trajectory-forward-92be.test.mjs`. Independent analytic
fixtures cover harmonic motion, constant acceleration with irregular timestamps
and command switches, representable epoch shifts, and fourth-order smooth-law
step convergence. Adversarial tests cover wrong restoring laws, poisoned future
positions, supplied initial-rate preservation, copied inputs, invalid contracts,
resource limits, and runaway/nonfinite execution. These tests qualify this
component; they do not claim a received physical-instrument release.
