# Successor experiment: choose a useful probe under declared effort

This finite probe chooser reuses the reviewed probe-response fitter and complete coefficient intervals. It proposes an investigator-reviewed acquisition request from offered states; it does not operate an instrument. Native ownership: WORLDLAW #46.

## Actual decision demonstrated

Authored small correlated training angles/rates retain rate and sine response. Three caller-offered probes differ:

| Angle / rate | Declared effort | Complete prediction-set gap |
| --- | --- | --- |
| 0.6 rad / 0.6 rad/s | 1 | 0 N·m |
| 0.6 rad / 0 rad/s | 2 | 0.3807738063 N·m |
| 0.6 rad / −0.6 rad/s | 4 | 0.7793493978 N·m |

At a declared future contrast radius of 0.01 N·m and budget 4, zero-rate is the cheapest complete separator. Maximizing disagreement alone would spend twice the effort. At radius 0.2 the zero-rate gap is insufficient, so reversed motion becomes the qualified option. Budget 2 at that radius admits no informative choice. Radius 0.4 leaves all three unresolved. These are conditional decisions about constructed data, not demonstrated physical savings.

## Reuse and selection

The maintained `src/experiment-design/interval-separation.mjs` owns pair screening and candidate selection. This chooser reuses both exports plus `fitProbeModels`/`PROBE_MODELS`, without copying gap or ranking code. A backward-compatible optional cost-field argument defaults to `costSeconds` for duration/recovery; this consumer supplies `cost` for generic effort. Six maintained duration-planner tests and nine maintained recovery-planner tests pass unchanged on the default cost field.

`planProbeAcquisition(training, settings)` accepts training-only studies, at most 32 distinct offered state/cost entries, future contrast radius and effort budget. It retains every candidate, full predictions, separated hypothesis pairs, cost refusal and angle/rate extrapolation. Complete separation wins over partial; at equal separated-pair count, lower cost wins, then stable identifier order. Partial stays explicitly partial. A single/no surviving hypothesis is unavailable for discrimination; missing training is not turned into a suggestion.

Signed features reorder prediction endpoints. Separability requires a strict gap greater than twice the future radius, with numerical slack preventing roundoff-only positive margins. Feasibility/costs are investigator declarations. No motion controller, route feasibility, actuation or sensor precision is inferred.

## Consumer controls

The consumer follows the existing duration panel/controller pattern: a copied study, explicit adoption function and study-change notification. The chooser reads training only; challenge changes do not alter suggestions. Training/preparation changes and edited assumptions invalidate export until recomputation.

Show offered angle, rate, effort, separated pairs, budget and extrapolation, with exact prediction intervals inspectable. A compact candidate table is preferable to a continuous heatmap: supplied isolated feasible states do not establish an interpolated physical action region. Request export includes training, assumptions and predictions, never observations. Measurement ingestion remains the current study import.

Label effort separately from seconds and assumed future contrast radius separately from measured bounds. At least four pairs per acquisition order and the same preparation/recovery/command are required by receiving. No automatic virtual acquisition: the initial probe fixture is not an authenticated arbitrary-state instrument recipe for imported studies.

## Executed controls

Nine local Node tests pass: cheapest useful versus largest gap; changed costs/budgets/radii; exact boundary refusal; three-model partial separation; no/single-model unavailability; training-only and future-value invariance; immutable inputs; bounded/deduplicated states; prediction-only export.

Actual CLI export/reopen reproduced the request byte-for-byte. Independent AFTERIMAGE review cleared the planner and shared-helper reuse. Focused local results are nine probe, six duration and nine recovery tests passed, with no failures or skips in those runs. No additional whole-suite run is claimed for this increment.

## Interface binding

The internal controller emits a study-change event and externally adopted requests increment the original panel file-read generation. Thus a newer reopened request supersedes an older pending study import. Training/preparation and assumption edits revoke export; challenge-only changes retain the training decision. Request reopening recomputes from inputs and ignores cached selections. The receiver covers both pending-request versus form edit and pending-study versus newer-request interleavings, monitors exact URL origins, and bounds CDP response waits.

## Actual browser receiving and limits

The Node 22 / Chrome 156 receiver ran on the assigned Linux receiving host, serving the candidate locally with monitoring enabled before navigation. Its 20 checks exercise keyboard activation, changed radius/budget decisions, stale export invalidation, request Blob content/reopening, ignored forged cached selections, both asynchronous import races, existing probe/challenge/refusal behavior, and 1440/390/320-pixel layouts. The receiver observed no runtime exceptions or requests to another origin. Export evidence concerns the generated Blob and reopened content, not separately downloaded file bytes.

The first 20-check run passed but visual inspection found the two-column effort/radius controls crowded the right edge at 320 pixels. Page-overflow checks alone had missed the input alignment defect. Scoped chooser CSS now uses shrinkable grid columns and stacks those controls at widths up to 520 pixels. Stronger receiving assertions check each input's actual rectangle against both panel and viewport, plus vertical separation on phones. The final narrow rerun passed all 20 checks, and independent visual review confirmed the controls remain aligned within the panel at 320 pixels. The final receiving log is `/tmp/hamon-06d8-worldlaw-choice/browser-mobile.log`, with screenshots in the sibling `receipts-mobile/` directory on the receiving host; the initial run is retained as `browser.log`.

Final received chooser panel SHA-256: `7feaea01e2e2f75c6a41eabd0c457b3ca0b2c773d47445f921ece7ce6462e91f`. Final receiver SHA-256: `93a7499b23ffc3710b2c32c026f179b9ac086d22f5b9b6937d9e69cef8bc9d4c`. These checks qualify the constructed-data software path only. Future uncertainty radius, effort, feasibility, model adequacy and physical transfer remain investigator assumptions; no physical acquisition or provider qualification occurred. Fresh-main composition and ordinary repository integration remain separate publication steps.
