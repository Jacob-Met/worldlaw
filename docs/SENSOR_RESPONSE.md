# Original sensor response in Discovery Studio

The Studio's **Challenge a measured link-side torque response** instrument admits original NAD Franka CSVs without assigning their sensor readings the meaning of scalar net torque. It preserves the original CSV, column roles, declared joint, SI convention, timestamps, original row numbers and SHA-256 identity. A private adapter reuses the maintained bounded discovery and command-map fitter; public recording and fit envelopes are response-specific. They cannot be passed directly to the ordinary torque simulator or imported as ordinary observation notebooks. No adoption action or hardware action is available.

## Run the actual consumer

1. Run `npm start`, open the Studio, and expand the sensor-response instrument below the ordinary residual/command-map investigations.
2. Choose joint 4, declare the NAD Franka SI channel convention, and load `examples/physical-nad-56bd8a/train-200_001.csv`.
3. Keep the explicitly offered widths `0,.1,.25,.5,.75,1` and residual scale 0.1 N·m. Freeze the training comparison. The seven-term algebraic library admits at most four terms, using maintained ordinary least squares. Imported response notebooks retain their original fitting declarations on recomputation.
4. Load `test-200_006.csv` through the separately enabled receiving control. Inspect all six errors, the unchanged training choice, every original response/prediction/residual, and original source identities.
5. Save original response inputs and reopen them. Training is admitted and fitted before receiving rows are read/evaluated. Fitted claims are never saved as authoritative inputs. Editing declarations retires the old fit and receiving result; stale asynchronous file reads cannot revive them.

The original Studio model, simulation and ordinary notebook remain separate. This instrument predicts the sensor response conditional on **contemporaneous recorded command, position and rate**. It does not forecast those inputs. It is not a free-running motion prediction, a causal command-effect estimate, a calibrated net-torque conversion or identified robot physics. Mapping widths, feature names and fitted coefficients remain hypotheses within a finite algebraic family.

## Measured result and its limits

Original author sources, attribution, license and hashes are in `examples/physical-nad-56bd8a/README.md`. Joint4 and author training/test recording identities were chosen before reading raw training. All 942 training rows and 929 receiving rows remain. The separate author test file stayed unopened until a maintained inference-source freeze and actual browser freeze matched all fitted candidates. No candidate was changed after test exposure.

| Offered width N·m | Training RMSE N·m | Separate recording RMSE N·m |
| ---: | ---: | ---: |
| 0 | 2.494615403 | 2.419861157 |
| 0.1 | 2.484716170 | 2.404133092 |
| 0.25 | 2.473164512 | 2.381839184 |
| 0.5 | 2.452670338 | 2.398989858 |
| **0.75 — training choice** | **2.432411894** | **2.389165005** |
| 1 | 2.432590470 | 2.386055940 |

The frozen training choice improves this separate conditional response RMSE by approximately 1.27% relative to the mandatory zero-width baseline. Widths 0.75 and1 remain training-competitive. Every training candidate retains `residual_mismatch`; the selected receiving maximum absolute error is 6.79818 N·m. Width 0.25 happens to have a lower receiving error, but it is not substituted as the selected model. This small improvement and large retained failure do not establish a physical dead zone. Joint coupling, controller behavior, other state, sensor semantics and omitted response structure remain unresolved. The finite grid is neither an exhaustive physical model family nor a calibrated uncertainty interval.

## Source and work boundaries

Original CSVs are capped at 2 MB and 8–4096 complete strictly time-ordered rows, with no thinning. Every required selected-channel cell is a finite decimal in a bounded range; duplicate/missing headers, unsupported conventions and wrong joint declarations refuse. Extra columns remain unchanged in the retained source. Recording hashes establish byte identity, not measurement independence or calibration. Separate receiving also requires a different declared identity and matching joint/channel convention.

Browser CSV intake uses fatal UTF-8 decoding while retaining a byte-order mark. Non-well-formed strings in programmatic or notebook input refuse before hashing; re-encoded valid text preserves the original CSV byte identity.

The entire offered command-map family reserves maintained ordinary and, for imported declarations, robust work before fitting. Admitted sources and frozen fits are immutable and held in private identity maps; forged result-shaped objects are not accepted. The shared CSV parser is reused with only an added export. Portable notebooks have a shared 5 MB UTF-8 export/import ceiling, including JSON escape expansion; overflow refuses without modifying the fit or emitting a partial notebook.

## Reproduce and inspect

`node scripts/sensor-response-measured.mjs receive` checks the original frozen input hash, admitted inference-source hashes, all recomputed candidate coefficients, unchanged selection/options and the predetermined test-file hash before recording errors. After test exposure, review repaired UTF-8 intake and current main added an unused optional cosine term. `current-source-qualification.json` separately pins those source hashes and exact equality of all historical candidates/selection; it does not rewrite the original freeze or claim another blind test. `qualify-current` refuses any changed historical candidate, choice, option or work declaration.

The historical `freeze` command refuses to overwrite an existing receipt or run after the test file exists. Distributed examples now expose the test data: reproducing the receipt is not another blind test.

`node tests/sensor-response.test.mjs` checks independent unfamiliar authored response curves, exact maintained zero-width parity, role/simulator refusals, source/joint mismatch, immutable fit custody, receiving noninterference, original-only replay, exact work bounds and portable escape-expansion refusal.

`scripts/sensor-response-browser.mjs --receive` runs the actual Studio with original measured files, keyboard freeze, explicit role refusal, saved freeze equality, frozen separate evaluation, source-only reopen, desktop/narrow plots, late-read invalidation and original net-source preservation. Configure the existing Playwright/Chromium environment normally; this harness requests Chromium's sandbox, never disables it.

Two integration choices were considered: convert sensor readings into ordinary net-torque notebooks, or keep a response-specific source instrument alongside the existing Studio investigation using the same chart/fitter. The latter preserves useful measured prediction while refusing unsupported dynamics. The central visual is the original sensor course directly confronted with the frozen prediction and every residual, not a new dashboard. Desktop and 390 px actual captures are in the receipt directory. Remaining experience limitation: the long source/candidate inspection sits below the primary apparatus; no claim is made that it completes the product's full unfamiliar-mechanism journey.
