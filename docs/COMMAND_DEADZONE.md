# Static command response investigation

In the existing Studio, expand **Investigate a static command dead zone** beneath
the residual plot. Declare one to sixteen symmetric half-widths, including zero.
The instrument compares the original command with
`u′ = sign(u) max(0, |u| − d)` before attributing a poor torque fit to mechanical
terms. Widths are in the existing command unit, N·m. This is a conditional command
mapping, not a calibrated applied-torque measurement.

Every width runs the maintained scalar discovery library using training readings
only. The original feature choices, noise floor and maximum term count apply to
each width, including the explicitly selected least-squares or soft-L1 loss and
its declared scale. Raw RMSE always retains every original reading; a soft-L1
score and reduced influence do not identify faulty readings. The same heuristic
score ranks the finite width grid; ties use the
smaller width. No continuous optimum, posterior or uniquely identified threshold
is claimed. Every declared width remains visible, including training mismatch and
rank/conditioning diagnostics. A command that never changes, a command always
inside the dead zone, or confounding with bias/gain can leave widths unresolved.

The comparison does not replace the selected Studio model or change its planner.
Original commands and torque readings remain unchanged. Separate receiving rows
only evaluate frozen fitted laws; the instrument never chooses widths or terms
from receiving error. The zero-width result is exactly the ordinary discovery
result under the same options.

## Inspect and execute

The command-response plot fixes angle and angular rate to zero and compares the
inspected width with zero. It is explicitly a conditional slice, potentially
outside measured support. Residual points instead use every original row's actual
command, angle and rate. Original/mapped commands, coefficients and diagnostics
are inspectable together.

**Compare motion using Studio solver inputs** runs both conditional laws through
the maintained RK4 solver at the current Studio initial angle/rate, constant
original command, inertia, duration and step. The settings are printed alongside
the result. Invalid execution removes the prediction. These are conditional
model trajectories, not observations or a convergence certificate. No actuator,
hardware operation, delay or hysteresis is inferred.

The source notebook plus width declarations can be downloaded as
`worldlaw.command-deadzone-inputs/v1`. Reopening restores the original notebook;
explicitly compare again to recompute. No derived fit is accepted in the envelope.
Ordinary Studio saves keep their original format and do not save this temporary
comparison. A new source, changed width declaration or pending replacement
retires the previous comparison. Late file reads cannot replace newer evidence.

## Work and scientific limits

The wrapper reserves the complete width family before fitting, at most 25 million
feature-work units. For each width and original training row, it conservatively
counts the full-library rank term `p²` and every feature subset's `1+k+k²`, even
when maxTerms would exclude the subset. This is a declared algorithmic work
proxy, not a CPU-instruction or wall-time guarantee. The existing fitter remains
bounded to its maintained row/feature limits. Exceeding the reservation refuses
the whole family; no successful prefix is reported as complete.

For soft-L1, the instrument additionally reuses the maintained
`discoveryRobustWork` reservation, including every permitted iteration and line
search, across **all** declared widths before fitting. The complete family must
fit within the existing 250 million robust-work limit. A family that is too
large refuses; there is no silent ordinary-loss fallback or width thinning.
The original v3 soft-L1 notebook is retained inside the input-only comparison
envelope and is recomputed on reopening.

The widths are investigator declarations. Selecting them after seeing a
receiving result turns that source into development evidence; the software does
not authenticate blindness. Symmetry, centering and memorylessness can all be
wrong. An asymmetric response is retained as a wrong-family control. Low
receiving error on authored controls is not physical actuator calibration.

## Qualification

`node tests/command-deadzone.test.mjs` exercises four independently authored,
previously unused half-widths 0.137,0.419,0.863,1.071 with 80 training and 47 receiving
states each. The declared correct widths recover the response with receiving
RMSE below 1e−12 N·m, while zero-width errors remain above 0.02 N·m. The native
course also checks original-command custody, exact baseline parity, changed
receiving noninterference, wrong-family refusal, gain/width ambiguity, exact work
boundaries, input-only replay and maintained solver execution.

`node scripts/command-deadzone-browser.mjs` receives the actual served Studio,
including keyboard operation, all declared candidates, completed download,
explicit recomputation, both model trajectories, invalid-inertia refusal,
desktop/390 px layouts and delayed replacement custody. It requires Playwright
and an available browser, with Chromium's sandbox enabled. Receipts are in
`docs/receipts/command-deadzone-56bd8a/`.

The design considered a separate fitted-parameter dashboard and a command
transfer instrument within the maintained residual view. The latter directly
confronts original inputs, alternative response curves and resulting motion;
it preserves WORLDLAW's working apparatus rather than introducing another app.
The larger Studio is still a long vertically stacked workbench; this increment
does not resolve its overall navigation/design limitations.
