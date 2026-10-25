# Applied-torque inertia identification receiving

Issue #194; base `c33d454ff03e0ba03df8c29f5e64febd2b8dcf2a`. Exact owned-source SHA256 values are recorded in `native.json`. Publication and merged identities belong to the integration owner's later receipt.

## Executed locally

With Node.js v24.19.0 from the repository root:

```sh
node tests/applied-torque.test.mjs
node --test tests/applied-torque.test.mjs tests/forced-weak*.test.mjs tests/trajectory-angular-weak-92be.test.mjs
```

Nine new individual groups passed, zero failures/skips, in0.903seconds. The four-file adjacent run passed all four groups with zero failures/skips in1.126seconds. It covers the current applied-torque identification, the preceding forced weak estimator and original angular weak behavior.

The new controls test independent physical coefficient recovery and separate forecast, single-frequency rank refusal, initial-rate and held-out mutation boundaries, source-only replay, arbitrary-command/conflicting-unit/copied-source refusal, negative inertia refusal, irregular clocks, preserved training inference after forward work-budget failure, and multibyte UTF-8 limits. These are authored numerical controls, not physical acquisitions.

## Independent review and repairs

MICROVERSE independently ran the initial six groups and reviewed signs, calibrated channel custody, the admission-only unit-inertia surrogate and separate forecast mapping. Its UTF-8 byte-budget observation was repaired in core and UI; export and reopen now enforce the same advertised bound.

SECOND GROUND independently ran the initial six groups and mutated noninitial challenge angles and initial rate to verify the training/prediction boundary. It found two consumer issues: imported forward steps could reset on recomputation, and a pending replacement file left stale source authority active. The instrument now restores and exposes the forward step, clears previous source authority during replacement, disables Fit until admission and fences asynchronous callbacks. SECOND GROUND re-reviewed these repairs without a remaining blocker. The browser harness explicitly exercises both behaviors.

## Complete-archive qualification before the visual repair

The integration owner executed `npm run verify` against the complete exact `01a9a239a1f796e887bac51f1c3d43b0626e3279` archive plus the reviewed overlay. It passed **846 total tests:845 passes,1 inherited skip,0 failures**, followed by both launched-product smokes. The native test duration was29.891seconds under Node.js v22.23.4. `receiving.json` binds this run to the **pre-visual** source hashes; the complete log is published as `full-verify.log.gz`.

The first seven-group browser run also passed, but screenshot inspection found that the new panel lacked the maintained instrument's spacing/control treatment and its plot lacked interpretable axes. Passing interactions alone did not constitute visual acceptance.

## Final affected-browser qualification and visual repair

Only presentation and its receiving assertions changed: the panel now uses the maintained heading/button/disclosure grammar, coherent internal spacing, grouped source/actions, responsive numerical controls and a clearly separated coefficient display. The observation/forecast overlay now has sparse angle-in-radians and elapsed-time-in-seconds axes, gridlines and a dark-teal/orange legend. It redraws at the actual available width; equation, admission and source-custody behavior remain unchanged.

Root reran all **seven affected browser groups** on the final presentation bytes, with exit0, no stderr/page errors and sandbox admission. `visual-receiving.json` identifies the exact final source SHA256 values, `browser.json` lists the executed checks, and `sandbox.json` records the admitted Chrome/156 runtime. The final panel SHA256 is `8a24c96ca8b4b4b36a0c5aaee4024cb33b192c6909d2cdcd2c87c14ff5dc712e`; harness SHA256 is `8a31bbeb8f923b0230148455895224ee941d7998d3720b84233edee3041930f0`.

The seven groups cover keyboard identification and a separate forecast, desktop/narrow labelled plotting, original-input download/fresh-document recomputation with a nondefault forward step, delayed replacement-file custody, settings invalidation, single-frequency confounding, and wrong physical units with stale results retired. Root inspected the final screenshots at1440 and390pixels and found the instrument consistent with the maintained application, with readable axes:

- [Desktop instrument](applied-1440.png)
- [Narrow instrument](applied-390.png)

These final-browser results do not relabel the earlier full-suite run as execution on the final panel bytes. Root will run `npm run verify` on the exact published branch again before merge, and record publication/merge verification separately. This worker-authored account attributes remote execution and visual inspection to root.

## Meaning and remaining limitations

The fitted inertia/loss parameters are conditional on calibrated applied torque and one constant linear scalar model. Calibration, source independence and physical applicability remain declarations. A candidate is not a proof of the law. Single-frequency confounding, inadmissible coefficients and forward failures remain visible. Input-only notebooks retain the original applied-torque channel and unknown input inertia; they never convert arbitrary actuator commands into claimed physical torque.

## Current-main composition

The consumer app was refreshed to `01a9a239a1f796e887bac51f1c3d43b0626e3279` before complete integration testing. Canonical incoming app Git blob `4552b8192745280fe12bf4cfe87876f9b2d85021` was verified. The candidate adds exactly the applied-torque import and mount; stripping those two lines reproduces the incoming bytes exactly. Incoming command-response example and instrument behavior are preserved. The updated app SHA256 is in `native.json`.
