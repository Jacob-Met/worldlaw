# Bounded cross-channel encoder calibration

After comparing an original loop in Coupling Lab, open **Could the encoder
channels mix the two coordinates?** Supply a2×2 box of matrix-entry bounds and
their calibration basis. Identity defaults are assumptions, not sensor estimates.
The existing nominal-law, coordinate-box and shared/independent-gain inspectors
remain separate.

## Physical convention

The explicitly offered model is `q_true[i] = M q_nominal[i] + offset`, with one
matrix and constant per-coordinate offsets throughout the complete course.
Torque readings remain in separately declared fixed physical axes, with
independent reading errors. This is a sensor-calibration hypothesis, not an
arbitrary coordinate change that silently omits the conjugate-force transform.
No channel mixing, rotation, sensor calibration or physical law is inferred.

Each matrix entry has an independent finite interval bounded in magnitude by1000.
Admission requires a strictly positive determinant throughout the entire box.
The determinant is multi-affine in the four entries, so exact positive values at
all16 vertices certify the whole box. If any vertex is singular or reverses
orientation, this all-matrices calibration contract refuses and asks the
investigator to revise the declaration. It does not claim every matrix is invalid.

## Shared readings and exact extrema

The producer reuses the existing finite-input dyadic conversion, exact addition
and calibration multiplication/comparison primitives. The prior module receives
only named export aliases for its unchanged arithmetic functions.

For every original acquisition row, form the exact shared-endpoint polygon
weights `(q_next - q_previous)/2`, using the endpoint conventions maintained by
Cycle Work. At each matrix vertex, combine the two coordinate contributions
before bounding that original torque reading. An original reading is one variable,
even when several matrix terms use it. First and final torque readings remain
separate observations despite shared closed angles.

Work is multi-affine in the independent matrix entries and torque readings.
Therefore global extrema occur at box vertices. The implementation visits16
matrix vertices and analytically chooses each original torque endpoint according
to the sign of its combined coefficient. It retains the attaining matrix and one
endpoint assignment per original reading. No exponential torque-corner search is
needed in the product. The existing original-row cap1024 is retained.

Offsets cancel every segment difference exactly. The supplied physical-J
integration allowance expands the calibrated polygon interval once afterward.
The witness inspector shows the one attaining matrix, original row, exact torque
endpoints and calibrated position before constant offset. These are mathematical
assignments, not acquired corrected observations or a reconstructed instrument.

## Executed controls and receiving contract

An authored square with torque `[x, 2y + .02x]` retains positive work
[.0198,.0202]J under diagonal gain uncertainty±1%. Unit diagonal with cross-channel
entries±.01 instead admits[-.01,.05]J. Separately, a shared-reading cancellation
control has a tight error radius3J; independently bounding cross-work terms would
inflate it to4J. These controls motivate the mechanism without authenticating
either calibration model.

Six native groups pass via `node tests/circulation-matrix.test.mjs`. They include
16 distinct matrix vertices×1024 original-reading corners, direct reconstruction
of attaining witnesses, shared-reading cancellation, determinant certification
and refusal, offset invariance, reversal, once-added allowance, malformed input
and source-only replay. SECOND GROUND independently reviewed the core and ran all
six groups with no blocker. A separate Python Fraction prototype reproduces the
matrix/reading-corner experiment independently.

The actual browser receiver is enabled with `WORLDLAW_MATRIX_RECEIVING=1` in the
maintained circulation harness, preserving previous allowance, coordinate and
calibration flags. It exercises original source→matrix outcome→same-reading
witness→actual download/fresh reopen, keyboard execution, determinant refusal and
retry, source replacement/detached-read invalidation, and1440/390px layouts.
Browser execution and visual acceptance must be reported separately from native
passes; no browser or deployment result is asserted by authoring the receiver.

## Source custody and limitations

`worldlaw.coupling-matrix-calibration/v1` retains original normalized loop inputs,
matrix and offset bounds, explicit physical-axis/error assumptions and calibration
basis. Saved derived claims are ignored. A reopened independent matrix course is
clearly distinguished from the nominal comparison above it; it does not replace
training or refit laws. Edits invalidate outcomes, and a late detached import
cannot revive an inspector removed by source replacement.

The consumer remains attached to the existing original-loop apparatus so source
readings and earlier receiving results stay inspectable. A separate calibration
dashboard was rejected because it would disconnect these physical assumptions
from the course they describe. The mathematical witness is an inspectable source
row and matrix assignment, not a decorative uncertainty plot.

No statistical coverage, verified calibration, continuous-path work, full-state
closure, passivity, dissipation or physical mechanism is established. Entry-box
independence excludes more specific correlated matrix families; those require a
separate explicit contract rather than silently narrowing the retained box.
