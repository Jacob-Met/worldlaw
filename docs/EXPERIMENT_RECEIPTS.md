# Inspect predictions before learning an outcome

The ordinary Studio now retains a comparison for every entered measurement batch
and virtual experiment. Open **Inspect predictions before this outcome** beside
the acquisition controls, or use **Predictions before learning the outcome** in
the existing evidence trail.

Previously, the core briefly evaluated the prior selected law during revision,
but the visible history only showed the newly fitted law and fixed held-out
error. A large original prediction failure could disappear into an improved
refit, and the competing earlier explanations could no longer be inspected.

## The comparison

Choose an experiment and any of its original competitive laws. The selector
keeps the earlier training order, including laws that stop being competitive
after the new outcome. The comparison shows:

- The actual earlier equation, exact coefficients, fitting assumption, noise
  declaration and number of preceding training rows.
- Every original command, angle, rate and observed torque in the acquired batch.
- The earlier law's prediction, raw residual and input-range extrapolation for
  each row, with raw RMSE and maximum absolute error across the whole batch.
- The new training-selected law's error on the same outcomes, explicitly marked
  as an after-fit result that reuses those outcomes.

The before/after plot confronts both laws with the entered torque values.
Changing the inspected law does not change the Studio's training ranking or
acquisition policy. A change to fitting assumptions creates no new measurement
comparison. All laws can fail; the inspector does not force a winning physical
explanation from receiving errors.

## Chronology and source custody

A single batch uses one earlier fit for every row. Two sequential acquisitions
use two fits: the second can learn from the first. A structure ID alone is not
a frozen law; the same terms may have different coefficients after an update.
Each comparison therefore keeps independent copies of the earlier coefficients
and the original competitive ensemble.

These are **pre-update predictions recomputed from earlier notebook evidence**.
Source-only session files retain the original observations, options and event
sequence; reopening reconstructs the comparisons. Derived comparisons are not
serialized and supplied cached results cannot replace the computation. Undo
removes the corresponding outcome and its comparison.

The notebook does not authenticate the time of acquisition, prove that a
measurement was unseen, or prevent a user from retrospectively editing the
source. User-entered outcomes retain that qualification. Virtual outcomes remain
explicitly synthetic. The base source label is contextual provenance, not
independent authentication of later entered readings.

## Interpretation and resource bounds

The earlier law's residual is a prediction error relative to the prior notebook
state. The new law's error on those same rows is a reused training result.
Different updates may use different models and adaptively selected inputs, so
this view does not report their combined errors as a fixed-model held-out score.
The existing fixed held-out evaluation remains separate.

Every raw torque residual is retained under least squares, soft-L1 and declared
ratio-weighted fitting. A small normalized or robust fitting loss does not make
a large raw outcome error disappear. Competitive-model spread remains a
heuristic; neither that spread nor this comparison supplies calibrated
probabilities, a physical causal explanation, or an absolute falsification
threshold.

The derived history stores the original batch rows once and compact copies of
all earlier competitive laws. It does not retain a candidate-by-reading table
for every update. Selecting a law evaluates its complete batch; the exact-row
table is constructed only when expanded. Source session formats and their
admission limits are unchanged.

## Reproduce the checks

Run from the repository or extracted maintained source package:

```sh
node --test tests/experiment-receipts.test.mjs
npm run verify
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
BROWSER_ARTIFACT_DIR=/absolute/path/to/receipts \
node scripts/experiment-receipts-browser.mjs
```

The independent arithmetic course checks exact analytic slopes, one-batch versus
sequential acquisition, same-ID coefficient changes, complete all-law failure,
held-out and future-outcome independence, weighted and robust raw error,
mutation isolation, source-only replay and compact complete-ensemble retention.
The browser course exercises the actual virtual and entered-measurement paths,
keyboard navigation, old-event inspection through refit, actual download/fresh
reopen, undo, invalid input, desktop and narrow layouts. These are authored
synthetic controls, not physical instrument validation.

Executed results and exact candidate/published identities belong to the native
issue and PR receiving record; the commands above are not a claim that a run
has occurred.
