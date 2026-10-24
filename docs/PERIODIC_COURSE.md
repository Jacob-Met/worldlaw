# Receiving every pair under one bounded sensor explanation

The UNKNOWN LAB periodic contrast instrument bounds how a declared common sensor
process could bias the average preparation contrast. An average-compatible
explanation may still be impossible across the actual pattern of pair differences.
**Can one explanation account for every pair?** tests that stronger condition using
the inspected raw evidence and the same finite periodic components.

## Explicit conditional model

For each original reference/conditioned pair, the offered response is

`difference = h + d*(conditionedIndex-referenceIndex) + Σ[a_k*Δcos_k+b_k*Δsin_k] + error`.

The cosine/sine differences use the declared period in acquisition steps and a
common origin. Every pair shares the same coefficients. Each phasor lies in the
disk `hypot(a_k,b_k) <= amplitudeBound_k`. The sensor process is common to both
histories; independent sensors, condition-specific artifact amplitudes and
undeclared frequencies are outside this family.

Two families are kept separately: preparation offset fixed to zero, and one
constant preparation offset bounded by the explicit absolute limit. Both share
the same declared absolute drift limit and absolute pair-discrepancy limit.
Offsets may depend on state in reality; the constant-offset family is an offered
hypothesis, not established by matching the current coordinates. A result needing
that term does not identify physical memory or a preparation cause.

The pair-discrepancy radius is independently declared with a basis. It is **not**
estimated from the notebook's noise sigma, the empirical three-standard-error
screen or the new residuals. It must account for every admitted unexplained pair
difference, including any current-state mismatch. These are conditional bounded
models, without calibrated confidence or authenticated sensor calibration.

## Mechanism and independently checkable outcomes

The core reuses the maintained column-normalized QR fitter and rank diagnostic.
Rank includes only active coefficient columns; coefficients fixed at zero do not
pretend to add identifiable dimensions. A rank-deficient model may possess a
compatible witness, which never establishes unique phase, amplitude or offset.

A bounded projected search operates on the product of history/drift intervals
and the periodic phasor disks. Candidate parameters are checked again against
every original pair through a direct endpoint computation. Compatibility needs
strict residual interior after a numerical allowance. Zero-radius contact and
unresolved numerical boundaries do not receive a false success label.

A separator assigns a bounded signed weight `v_i` to every pair. The maximum
weighted response, including allowed discrepancy, is

`H*|Σv| + D*|Σv*Δindex| + Σ A_k*hypot(Σv*Δcos_k,Σv*Δsin_k) + radius*Σ|v|`.

The checker recomputes that support from the original reading endpoints. If the
weighted original differences exceed it by more than the numerical tolerance,
no shared parameter vector in this declared family can receive the whole course.
The tolerance includes raw reading magnitudes and an uncancelled phasor bound,
so large baselines and nearly cancelling components do not silently shrink the
arithmetic screen. This is independently rechecked numerical evidence, not
certified interval arithmetic for platform trigonometric functions.

Search exhaustion stays unresolved. The declared iteration limit and estimated
iterative matrix-term limit do not count input admission, bounded QR/rank work
or final independent source checks. They never truncate pairs or components.
The complete source, model bounds and search budgets are retained in input-only
`worldlaw.periodic-course/v1` files. Certificates are separately bound to the
normalized source and declarations; changed inputs cannot reuse an old certificate.

## Actual consumer and custody

First inspect periodic evidence and bounds in the preceding instrument. The
course then consumes that exact retained snapshot, including a reopened snapshot
when explicitly selected there. Changing the parent evidence or any declarations
retires the dependent course results and disables saving. The original paired
history result and aggregate inspection remain unchanged by all-pair checking.

The full-width instrument compares the two families directly. Compatible cases
show original pair differences against one constructed common response and its
declared discrepancy band. Failed cases expose the weighted evidence, support
and positive numerical gap. Every original pair and the complete coefficient or
weight vector remain inspectable. Save/reopen recomputes from raw source inputs;
reopening a course does not replace the original inspectors.

This direct observation-versus-witness instrument was chosen over a parameter
dashboard: the important question is whether one explanation can receive the
whole original pattern. Coefficients remain inspectable without being presented
as uniquely identified physical quantities.

Try [the authored pattern-failure input](../examples/periodic-course-pattern-failure.json)
with **Reopen course inputs**. It contains actual synthetic input rows and bounds,
not cached model results, and recomputes both family failures.

## Controls and receiving boundary

Six native groups cover an average-compatible/all-pair-impossible course;
rank-deficient compatibility; zero-history failure and bounded-history
compatibility; independent endpoint support arithmetic; 64 independently
authored feasible courses with direct witness receiving; changed-source and
forged-certificate refusal; input-only replay; invalid declarations; and work
exhaustion.

In the authored period-four control, two same-phase/same-order pair differences
are changed in opposite directions. The average remains compatible with the
artifact bound, but their approximately 0.160000 N·m difference cannot be
explained within two 0.01 N·m pair-error intervals by a shared response. The
full-course separator retains that contradiction rather than silently fitting
each pair with different coefficients.

Independent adversarial review exercised 40 support-boundary courses with 64
pairs, eight nearly coincident periods, amplitude bounds of 1000 N·m and raw
baselines up to 900000 N·m. None falsely separated; 40 deliberately contradictory
courses separated. These are numerical software controls, not physical evidence.

Run `node --test tests/periodic-course.test.mjs`. The actual browser receiving
course is `scripts/periodic-course-browser.mjs`, with `WORLDLAW_URL`,
`PUPPETEER_MODULE`, `BROWSER_EXECUTABLE_PATH` and `BROWSER_ARTIFACT_DIR` overrides.
It checks actual `chrome://sandbox` protection status before navigating the
product, then receives source intake, both families, keyboard operation,
download/reopen, invalidation, refusal, budget exhaustion and desktop/390px
layouts. Authored scripts are not themselves executed browser evidence; exact
source and result receipts belong to the integration PR.
