# Motion source-prefix starting rate — receiving record

Native issue: [#349](https://github.com/Jacob-Met/worldlaw/issues/349). Team: `9e5183`.

**Status:** focused and full native regression, launched smokes, original-browser reproduction and both candidate-browser runs passed through the integration lead's Renpō route. After repairing a desktop axis-readability problem and incomplete narrow capture, the lead inspected all four revised images and accepted the readable source axes and complete forecasts at desktop and 390-pixel widths. Exact package artifacts, final commit identities and publication results belong in the linked native [#349 issue / PR receiving record](https://github.com/Jacob-Met/worldlaw/issues/349); this document does not assert an unreported package or publication result.

## Consumer outcome and explicit choice

Motion intake previously required a supplied starting rate before admitting each recording. The optional **source-prefix** path lets the user choose an interior forecast origin and trailing window in one continuous course, inspect the original angular curve, and explicitly adopt the maintained local-cubic rate estimate. This connects the existing angular prelude estimator to intake; it does not replace the prelude or #35 rolling-origin instruments. The supplied-rate path remains the default.

For each recording, the user selects a starting sample and an odd window of 5–31 samples and confirms adoption. The window ends at the original origin observation and contains no later sample. The origin's measured angular value is unchanged; the polynomial's fitted position does not replace it. At least 17 training samples or two challenge samples must remain. The window cannot cross a lost/rejected point, gap or continuous-course boundary.

A blank noise override uses the maximum declared Motion angle-noise value from **only that chosen window**. A numeric override is explicit; an invalid numeric input blocks adoption rather than silently acting as blank. This noise scale is an uncertainty assumption, not calibrated tracking confidence. Existing clock, fixed-reference, source-kind, separate-recording and shared-angle/dynamics declarations remain in force.

## Adopted-input and source-custody contract

`previewMotionStart(inspection, {role, segmentId, start})` provides a synchronous provisional preview. `start` contains `mode: 'source-prefix'`, explicit zero-based `originSampleIndex` within the chosen course, explicit `windowSize`, and optional `positionSigma`. The core accepts the maintained explicit `null` residual-proxy option; the UI does not expose it. Actual pair creation reparses the original Motion bytes and derives again. A cached preview is never authoritative; conflicting supplied-rate and prefix declarations are rejected.

The result becomes an explicitly adopted preparation input at `run.initialRate` and `source.motion.initialRate.value`. Generic Trajectory notebook reopen reuses the saved scalar and refits from saved inputs. It **does not re-estimate the rate, reopen the original Motion notebook or verify video pixels**. Rebuilding from Motion derives anew.

`source.motion.initialRate.preparation`, schema `worldlaw.motion-source-prefix/v1`, retains:

- Exact chosen-window times, unwrapped angles and Motion position-noise values, plus original notebook measurement indices.
- The origin's course index, original measurement index, time and unchanged angle.
- Window size, resolved noise and its origin, maintained estimator schema, method/version, conditional diagnostics and qualifications.
- Counts of earlier course rows omitted from the window or forecast, and explicit saved-input persistence wording.

The whole original course descriptor remains intact. `source.motion.observationIndices` maps the retained suffix to the original notebook. Input SHA-256 and byte length bind the full Motion file, which retains earlier unused rows, pixel-coordinate measurements, revisions and diagnostics. Keep the separately identified original video for pixel reinspection; its image pixels are not embedded in the notebook. Synthetic or unknown evidence does not become measured physical evidence through this preparation.

Source inspection confirmed the maintained estimator's diagnostic names: `rate`, `rateSigma`, `conditionEstimate` and `localResidualScale`. `estimateAngularPrelude()` passes them through from `fitAngularWindow()`; the stored preparation uses those exact fields. Their numerical meaning does not imply physical confidence.

## Conditional scientific boundary

The rate estimate excludes strictly later receiving angles, conditional on the retained clocks and angular reference. A reference fitted using later observations remains a full-source conditioning dependency. Past-only rate preparation does not make that reference prospectively calibrated or turn exploratory reuse into blind validation. Reference-conditioning metadata and warnings remain.

The falsification changes every challenge angle strictly after the origin while preserving the prefix, origin and clocks. The adopted estimate and entire frozen forecast must remain identical while receiving errors change. Native tests additionally vary later propagated angle noise to catch future-dependent default noise. Whole-source hashes and global diagnostics may legitimately change.

## Pinned receiving inputs and observed result

The browser course reopens these exact notebooks from the previously qualified authored decoded-movie/tracker course. It does not perform new movie acquisition. The retained sources contain their upstream tracked/manual evidence and conditioning.

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `examples/motion-prefix/fit-plane-notebook.json` | 169,532 | `a3ae4cec3a031e86d557b13ff623f1068fddf441761fd97a127882cd88dd8953` |
| `examples/motion-prefix/challenge-plane-notebook.json` | 170,780 | `2b4e1759e3b85632167d16fc3d635ac353e4eebb27e96e7728df079ffc520371` |

Original authored movie SHA-256 identities:

- Fit: `5a27a92fe35d38e54f303b8299693f630223c6d252076b52820cb4e302e66d7c`.
- Challenge: `1740ff6d082d562f7b35bbb1d28e6eaaf5f0de1198d23721fb369912a59ad3c9`.

The receiving declaration fixes zero-based origin 30 (the 31st source sample) and window 17 before scoring either recording. Each source has 160 rows; the suffix retains 130 rows, starting at 1.5 seconds. Adopted training rate: `-0.6521970056939961 rad/s`; challenge rate: `-0.9423023703739606 rad/s`. The actual consumer selected rate + gravity, with challenge RMSE `0.08358431282266787 rad` and maximum absolute error `0.13862528876195745 rad`. These are receiving observations, not a physical-validation or accuracy-improvement claim.

The separate authored analytic control changed all 470 strictly later challenge angles. Receiving RMSE changed from `0.004162457684187028` to `0.35243969493195676 rad`; the adopted estimate and full frozen forecast remained exactly unchanged. Both forecasts had SHA-256 `bd251c345226481dc44185cb24227b06a5d82dd03e0e4237317e287b0119ad15`. This control uses authored coordinates, not decoded movie measurements.

## Qualification ledger

| Layer | Qualified result |
| --- | --- |
| Focused native intake tests | **17/17 passed:** eight existing tests plus nine new prefix tests. Includes legacy output, custody, gaps, noise, raw-byte authority, adopted-input replay and guard controls. |
| Initial-base full native suite | Base `2350b555`: **1,308 total; 1,307 passed; one optional skip**. The skipped case is not counted as passed. |
| Composed full native suite | Concurrent PR #350 main `6a3dcf48`, tree `03012e3f`: **1,310 total; 1,309 passed; one optional skip; zero failures**. Both launched smokes passed. |
| Original browser barrier | Baseline `2350b555`: **two groups passed**, reproducing the missing-rate refusal using the exact pinned notebooks. |
| Candidate browser 01 | **Exit 0; 12 functional groups passed.** Covers ordinary Motion intake and forecast, exact prefix/suffix/source custody, invalid numeric input, actual SVG pointer selection, a real pending pair-digest retirement, legacy supplied rates, original Motion save/reopen, Trajectory session replay, gap rejection and future-only falsification. |
| Candidate browser 02 | **Exit 0; all 12 groups passed** with the packaged-fixture default and revised receiver. The exact numerical results and future-control forecast SHA above were unchanged. |
| Visual acceptance and revised capture | **Passed after repair.** The lead inspected all four revised actual images: readable source axes and complete observed/predicted forecasts at desktop and 390-pixel widths. Earlier inspection found a real desktop prefix-axis readability problem, and the first narrow forecast image was incomplete; both failed visual attempts remain part of the record. |
| Package and publication record | Exact artifact/commit identities, package results and native PR/merge receipts belong in the linked [#349 issue / PR receiving record](https://github.com/Jacob-Met/worldlaw/issues/349). No unreported result is inferred here. |

Lead-relayed Renpō command identities:

- Focused: `hamon-9e5183-motion-prefix-focused-20261026-01`.
- Composed suite/smokes: `hamon-9e5183-motion-prefix-compose-verify-20261026-01`.
- Original browser: `hamon-9e5183-motion-prefix-baseline-browser-20261026-01`.
- Candidate browser 01: `hamon-9e5183-motion-prefix-candidate-browser-20261026-01`.
- Candidate browser 02: `hamon-9e5183-motion-prefix-candidate-browser-20261026-02`.

Candidate-browser 02 used receiver SHA-256 `e5b60efe8ae066e07d8989f7a054dc2b5334ca43173f34fff77857c74f441983` and final intake-panel SHA-256 `649dd6bb0a5ca72e968fd43916c28b4de92ab05a0357c0f74d0ce488e387305f`.

All runtime statements above come from those integration-lead receipts. The document author performed source inspection and local syntax checks only. Commit/tree prefixes are those supplied with the receipts; full final publication identities belong in the native PR record.

## Reproduction

From the candidate checkout, run the existing and new focused cases:

```sh
node --test tests/motion-intake.test.mjs tests/motion-start-intake.test.mjs
```

The maintained receiver is `scripts/motion-prefix-browser.mjs`. Its default input directory is the exact packaged `examples/motion-prefix`; `MOTION_PREFIX_NOTEBOOK_DIR` optionally overrides the directory, while the receiver still checks the pinned hashes. Use an artifact directory outside the checkout:

```sh
WORLDLAW_SOURCE=/absolute/candidate-checkout \
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/chrome \
BROWSER_ARTIFACT_DIR=/absolute/receipts/motion-prefix \
SOURCE_COMMIT=exact_candidate_commit \
node scripts/motion-prefix-browser.mjs
```

The repaired receiver identified above passed candidate-browser 02; its hash is not attributed to candidate-browser 01's earlier execution. For baseline reproduction, use that receiver against a preserved baseline checkout and explicitly point to the candidate's pinned notebook directory:

```sh
WORLDLAW_SOURCE=/absolute/baseline-2350b555 \
MOTION_PREFIX_NOTEBOOK_DIR=/absolute/candidate-checkout/examples/motion-prefix \
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/chrome \
BROWSER_ARTIFACT_DIR=/absolute/receipts/motion-prefix-baseline \
SOURCE_COMMIT=exact_baseline_commit \
node /absolute/candidate-checkout/scripts/motion-prefix-browser.mjs --baseline-only
```

`--baseline-only` uses the prior intake UI and requires no new helper or controls. These commands describe reproduction; package and final publication qualification are recorded separately in the linked native receiving record.

## Limits

Local-cubic rates can be biased, including when a longer window reports a smaller conditional sigma. Clock/reference errors, correlated image measurements, unsupported physical structure and source authenticity remain unresolved. Choosing a window after examining challenge errors is exploratory reuse. This feature makes no new physical-acquisition, calibrated-uncertainty, law-identification accuracy, human-acceptance or submission claim.
