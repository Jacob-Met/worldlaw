# Select structure by predicting another training recording

Trajectory Challenge has a separate opt-in investigation for angular evidence:
**Which law predicts another recording?** It reuses the maintained compact-window
weak fitter and angular solver. Running it does not change the ordinary model
ranking, source observations or notebook.

Every offered structure is fitted on all but one training recording and freely
predicts the omitted recording. This repeats across all training recordings.
Only structures completing every fold and passing the declared two-step numerical
screen can compete. Sample-weighted validation RMSE selects structure; its final
coefficients use all training recordings. Separate challenge recordings assess
the frozen model afterward. Missing, unstable and numerically unresolved folds
remain inspectable; a candidate cannot win by omitting its failed folds.

This investigation always uses weak fitting, even when the main view uses the
cumulative estimator. Its original comparator is explicitly the weak-fit leader.

## Use and reproduce

Start `npm start`, open Trajectory Challenge and load an angular bundle with 2–4
training recordings, including the measured example. Set the assumed position
noise, maximum terms and numerical screen, then **Compare training predictions**.
The panel overlays frozen original/selected predictions against separate observed
motion. Details retain all structures and failures. Export/reopen saves only source
inputs and settings and recomputes the result. Source changes revoke the old
comparison. Setting edits disable export until applied.

```
node tests/predictive-selection.test.mjs
node experiments/predictive-selection.mjs
node scripts/browser-predictive-selection.mjs
```

The browser receiver takes `PUPPETEER_PATH`, `CHROME_BINARY`, and optional
`QA_OUTPUT`. Browser execution is a separate receiving gate, not inferred from
native tests or the experiment results below.

## Complete search and execution bounds

Structures are enumerated from the declared library before fitting, without a
data-driven shortlist. The default six terms and maximum four terms offer 57
structures. Each fold calls the maintained fitter once, then uses each exact
candidate fit. Rank-deficient candidates remain unavailable. The maintained
angular bundle validator screens shared recording identity and copied windows;
this does not authenticate independently acquired evidence.

The complete coarse-plus-half-step workload is reserved before fitting: at most
2,000,000 training integration steps, 262,144 prediction rows, and 128 structures.
Every call also respects the maintained one-million-step solver limit. Final
challenge execution has a separate one-million-step / 65,536-row reservation.
Budget refusal never returns a partial ranking. Reservations can overestimate
actual work when structures fail fitting.

Two-step agreement is not a convergence guarantee. The caller chooses its numeric
threshold. Final challenge numerical failures remain visible. RMSE weights
samples rather than time: unequal durations and sample cadence affect selection.

## Retained experiment, 2026-10-24 UTC

`evidence/predictive-selection-results.json` retains all fifteen cases: six
analytic oscillators, eight weak-excitation controls at fixed seeds 1–8, and
previously reused PASCO data. Separate challenge positions never select model
structure or fit coefficients.

- Three stationary analytic spring cases at noise 0, .001 and .01 rad retain the
  original rate+spring structure. No improvement is claimed.
- Three changed-physics cases select a finite predictor instead of the original
  runaway, but retain .576–.579 rad challenge errors. Prediction completion does
  not establish an adequate common law.
- Small-excitation noisy controls improve in five of eight seeds and worsen in
  three. Seed 1 changes RMSE .35067→.46571 rad; seed 5 changes .35042→.50057 rad.
  All eight results remain recorded. Validation can select the wrong extrapolator.
- PASCO completes 36/57 structures. Training validation selects
  `rate+coulomb+gravity+bias` at .129321 rad validation RMSE. The refitted model
  predicts the third recording at .089510 rad RMSE versus .322969 rad for the
  original weak-fit leader; two-step difference is .000228 rad. This dataset and
  its earlier failures already informed development, so this is exploratory
  evidence, not fresh blind validation or a new physical acquisition.

Repeated selection against training folds is model development. Its minimum error
is not an unbiased final generalization estimate or a calibrated likelihood.
Finite offered terms, supplied initial states, scalar unforced assumptions,
alignment and declared provenance remain limits. Independent new recordings are
required for stronger physical and generalization claims.

## Historical receiving, 2026-10-24 UTC

The integration receiver reported the following results for the candidate composed
against maintained base `3824ee`:

- `npm run verify`: 275 passed, zero failed, one conditional optional Playwright
  skip. Both separately launched smoke courses passed.
- Hosted predictive browser course: all eight groups passed, including narrow
  layouts at 390 and 320 pixels.
- Actual generated standalone HTML opened through `file://` with networking
  disabled. All five reported offline groups passed, including the real browser notebook
  download and reopening that downloaded file to recompute predictions.

The received generated HTML was 639,298 bytes, with SHA-256
`ed2499f05b41e5c78ac8d28ec3ffcec584a0ec98ae01fd89e81d937f5ae77fef`.
This identifies the received artifact; it does not establish association with a
published remote commit. The source publication/readback and its final commit
association are separate release steps.

### Received composition against `736cd761`, 2026-10-24 UTC

The integration receiver subsequently qualified the candidate composed against
`736cd761ce15aa7e2e32b51af67a17cd7548381e`, including its initial-state
sensitivity panel and UNKNOWN LAB duration/recovery planning:

- Native verification: 323 passed, zero failed, one conditional optional
  Playwright skip; the smoke courses passed.
- Hosted predictive receiving: all eight groups passed.
- Generated standalone offline receiving: all five reported groups passed.

The rebuilt and received HTML SHA-256 was
`00814ba45283cf24476f0e3bafc46a9a69c2ddbc8478a9db8af6cbb7904ad558`.
This hash identifies that received generated artifact, not a new remote commit.
All 15 locally reproduced predictive experiment records matched frozen evidence,
including 57 offered and 36 complete PASCO structures.

### Received composition against `a4620e1`, 2026-10-24 UTC

The integration receiver completed fresh receiving of the candidate composed
against `a4620e1cb73986b34be38da7ca11cb2de4f5870b`, including the angular
prelude, shared kinematics updates and UNKNOWN LAB probe study:

- Native verification: 349 passed, zero failed, one conditional optional
  Playwright skip. Both smoke courses in `npm run verify` passed.
- Actual hosted predictive receiving: all eight groups passed.
- Actual generated standalone offline receiving: all five reported groups passed.

The received standalone HTML SHA-256 is
`1cb66aba91c5091dca7dd6f46fc93d83ad395e441610ad9b18a1b06e7c4022da`.
Predictive science and UI source bytes remained frozen. All 15 local predictive
experiment records remained exactly equal after the shared-kinematics overlay,
including the original 57 offered / 36 complete structure population. Independent
peer science review separately reproduced all 15 experiments, the 36 complete
PASCO fold scores, and the separation of challenge observations from selection.

These results qualify the stated composed source and generated artifact. Final
publication and commit readback remain separate steps; the maintained base hash
alone does not identify the additional candidate files. The optional skip is
retained explicitly and is not counted as a passed test.

### Received rolling-origin composition against `2dde8158`, 2026-10-24 UTC

Fresh integration receiving passed against maintained main
`2dde8158ece31a1e16eb162f9388483472fdd022` with the rolling-origin challenge:
358 native tests passed, zero failed, one conditional optional Playwright skip
(359 total); both launched smoke courses passed; all eight hosted and five
reported offline receiving groups passed. The three predictive scientific/UI
modules remained byte-identical, and all 15 experiment records remained equal.

The received standalone HTML was 694,984 bytes, SHA-256
`472eed3b65fcfe685b3317d3d5dd1ee2cac5aa6ba40fea7f58ba1f2025dd8d61`.
The actual downloaded/reopened notebook remained 199,946 bytes. This qualifies
the stated composed source and generated artifact. Final publication/commit
readback remains a separate step; base revision alone does not identify the
additional candidate files. The optional skip remains explicitly unpassed.

### Received publication composition against `88f483ae`, 2026-10-24 UTC

Fresh receiving also passed for the publication composition against
`88f483ae95ab1e5448c588b60c2954f67dd93cb5`:377 native tests passed,
zero failed, one conditional optional skip; both launched smokes passed;
eight hosted groups and five reported offline groups passed. This receiving
included the shared torque-core extraction dependency, rather than assuming
unrelated-looking additions could not affect the trajectory consumer.

The received generated HTML was695,231 bytes, SHA-256
`51c105f921a8aa9b8c50a313fb4c01871d4ce2ddc3737485a558e057d5315ae1`.
Frozen predictive modules remained unchanged. These are exact composition and
artifact receiving results; publication and remote commit readback are separate.

### Reproduce the offline receiving course

Generate the maintained standalone application with `npm run trajectory:build`.
Then use the actual generated HTML, not a substitute hosted page:

```sh
PUPPETEER_PATH=/path/to/puppeteer \
CHROME_BINARY=/path/to/chrome \
TRAJECTORY_OFFLINE_FILE=/path/to/generated-standalone.html \
QA_OUTPUT=docs/receipts/predictive-selection-20261024/offline \
node scripts/browser-predictive-standalone.mjs
```

Without overrides, the helper reads
`.receipts/trajectory-experiment-screened-standalone-92be.html` and writes to
`.receipts/predictive-standalone`. It disables networking and refuses external
requests or auxiliary local assets. It checks the embedded predictive source
manifest, runs the embedded reused PASCO example through the actual weak-fit UI,
retains all 57 offered structures and 36 complete structures, and checks the
selected and original forecasts. It downloads the actual source-and-settings
notebook, changes a setting, then reopens that file and checks recomputation and
restoration. Desktop, 390-pixel and 320-pixel captures accompany the receipt.

The explicit output directory receives `offline-browser-receipt.json`,
`offline-predictive-desktop.png`, `offline-predictive-390.png`, and
`offline-predictive-320.png`; the actual downloaded notebook is retained in a
fresh `downloads-*` subdirectory. Packaging includes the helper and published
JSON/PNG receipts directly inside the documented `offline` directory. Temporary
browser download directories are not part of that receipt allowlist.

The offline success establishes runnable local receiving of this generated
consumer. It does not turn previously reused PASCO evidence into new acquisition,
blind validation, or a guarantee of generalization.

### Final publication composition, 2026-10-24 UTC

Receiving against `eb249b782b9dbb58de920951e1aa421ce14726ad` passed 414 native cases, zero failures, one optional Playwright skip, both launched smokes, eight hosted groups and five offline groups. The generated offline HTML remained 695,231 bytes with SHA-256 `51c105f921a8aa9b8c50a313fb4c01871d4ce2ddc3737485a558e057d5315ae1`.

The final composition preserves `40ee8769eaa09befb89872bcd369625624980f47`, including Cycle Work's separate modules, server route and additive package patterns. Fresh `npm run verify` passed **427 native cases**, zero failures, one optional skip (428 total), and both launched smokes. All **eight hosted receiving groups** passed on this composition. The standalone dependency source is unchanged from the preceding five-group offline receiving; Cycle Work adds no trajectory bundle dependency. Packaging retains all current upstream and predictive/rolling/offline requirements. The predictive selection, session and panel source bytes remain unchanged. Published verification records the distinct native/hosted and offline base scopes rather than treating a base revision alone as the complete candidate identity.
