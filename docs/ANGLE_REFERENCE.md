# Investigating the angular reference

The Trajectory Challenge offers **Investigate the angle reference** beneath the
existing experiment apparatus. Load an angular bundle (the measured PASCO
example is supported), declare offsets including zero, and compare the same
weak angular-law library at each reference. The panel fits training runs only,
freezes the coordinate and model, and compares free-running predictions with
separate recordings in original recorded angle coordinates. Original evidence,
notebook and planner remain intact. The separate reference notebook saves only
inputs; reopening recomputes every model and prediction claim.

## Scientific contract

Each candidate uses `theta_model = theta_recorded - offset`. Rates and timestamps
are unchanged. The maintained `discoverAngularWeak` fits the existing library;
`rolloutAngularWithResolution` performs the unchanged free solver and numerical
comparison. Predictions and observations are transformed back by adding the
offset; residuals and numerical differences are translation invariant.

The declared grid supports 41 unique values within ±π, including zero. Its
unshifted baseline must fit. Nonzero coordinates pay `log(n)` in addition to
the existing weak score, representing one extra fitted reference parameter.
This is a ranking heuristic, not a calibrated likelihood, confidence interval
or justification for arbitrary grid refinement. The inherited overlapping-window
correlation and errors-in-variables limitations remain.

The report preserves all candidates, failures, competitive offsets, excitation
diagnostics and endpoint winners. Challenge error never selects an offset,
equation, noise level or window. Manual retuning after inspecting challenge
error destroys any untouched-validation claim. Search status describes training
evidence only; prediction error remains explicit.

A useful offset can represent a sensor reference, a physically tilted restoring
law or compensation for omitted physics. A good fit cannot distinguish these.
A linear spring plus constant bias absorbs a coordinate shift exactly; tests
retain this ambiguity. Physical inertia and absolute torque remain unknown.

## Receiving — October 24, 2026

Base source `ed39865b5e9b86a5132920c7201a86c305c0d08f`; Node v24.19.0.
New modules live in `src/representation/`. Existing estimators, acquisition,
planner and sessions are unchanged; the app hook creates and invalidates the
panel on source changes.

Seven focused test groups passed normally and with `--no-opt`: shifted and
unshifted motion, challenge invariance, spring/bias equivalence, omitted terms,
grid boundary, stationary motion, resource refusal and input-based replay.
The existing independent fine-step pendulum oracle and analytic spring fixture
generate observations; their equations never enter the fitter.

Actual Chromium receiving passed 11 groups against the normal server: angular
import, keyboard fitting, predictions, download, invalid-setting revocation,
reopen, invalid reopen preserving results, desktop/narrow canvas, focus and
page bounds, source replacement revocation, and measured PASCO. Screenshots
were visually inspected at 1440 and 390 px. Narrow chart text was corrected;
the ranking table has keyboard-focusable horizontal scrolling. Both maintained
launched smoke commands passed. Independent review caught a search/reopen
cancellation race; stale work now stops and the current operation restores
the search control.

The synthetic +0.3 rad case with six offered terms and assumed noise 0.00001
rad selected +0.3. Separate-release RMSE was 0.34596 rad unshifted versus
5.6293e-8 rad shifted. This is controlled synthetic evidence, not calibration.

The existing measured PASCO bundle, fixed [-0.5,+0.5] grid at 0.05 rad steps
and assumed noise 0.01 rad, selected -0.15 rad. The baseline selected
gravity+bias; the shifted candidate selected spring+gravity+bias. Separate
third-recording RMSE changed from 0.3229695 to 0.2535250 rad, while final error
**worsened**, from 0.3140332 to 0.3548895 rad. Maximum numerical discrepancy
was 3.8024e-6 rad. Large physical mismatch remains. PASCO challenge data has
been reused during prior development: this is exploratory receiving, not fresh
blind validation or new acquisition.

## Reproduce

```sh
node --test --test-isolation=none tests/angle-reference.test.mjs
node --no-opt --test --test-isolation=none tests/angle-reference.test.mjs
node experiments/angle-reference.mjs
node scripts/smoke.mjs
node scripts/trajectory-smoke-92be.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
node scripts/reference-browser.mjs
```

The exploration retains a grid near-miss (+0.075 rad), small excitation, angle
noise and the measured case in `evidence/angle-reference-results.json`. In its
12 fixed cases, noisy small-angle training retained an unshifted or ambiguous
reference and about 0.892 rad separate-release RMSE. When the true +0.075 rad
offset was absent from the grid, +0.05/+0.1 selections retained mismatch or
approximation rather than exact recovery. Settings were not retuned on these
challenge outcomes. Read failures and ambiguities alongside gains.

The full regression invocation initially passed 210 tests, skipped one existing
browser-conditional check, and failed one raw-PASCO custody check because the
local checkout lacked the CSV files. After materializing all three original
CSV blobs, the complete affected 10-test file passed. The focused new tests
and both launched smoke checks passed. The targeted actual-browser race
harness passed malformed-reopen and settings-edit cancellation before pending
animation-frame work. This records the initial failure rather than relabeling
that first broad run as wholly passing.

### Current-main composition

The final runtime was composed with all 13 incoming files from current main
`43e7` (UNKNOWN LAB). Eleven files remain byte-identical; README and smoke
retain both contributors' additions. Packaging explicitly includes and requires
UNKNOWN LAB as well as the reference modules. On local runtime
`964cd55cd2b081ca4684f1ef1842ecfa336687ef`, the complete current test suite passed
236 tests with zero failures and one existing browser-conditional skip.
Both launched smoke commands, the 11-group browser course, and both targeted
browser race checks passed on that composition.

The composed 136-file portable archive passed every SHA-256/length check and
an extracted-package launched smoke. Archive SHA-256:
`0d3a458af724576415ecc9bea859ed517f5a26b9f42d9988dac1188ca2a7d768`.
This is locally received composed source and package evidence; publication,
merge and actual deployment remain distinct operations.

No physical intervention, cloud/GPU workload, platform qualification,
deployment or submission follows from this increment.
