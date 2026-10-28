# Compare retained timing and law alternatives

A timing hypothesis can support several executable laws. In the fixed-excitation study, constant command retained equally scored `command + rate + spring` and `rate + spring + bias` laws for each delay. Their agreement on training motion does not make their predictions equivalent when command varies. Rank-deficient subsets were counted separately; they were not fitted executable alternatives.

The optional joint-family diagnostic compares retained timing-and-law combinations on the same original separate recordings. It supplements the existing selected-law timing comparison. Original timing/model selection, source samples, fitting and input-only notebook format remain unchanged.

## Which combinations belong?

Within one completed study, take the lowest finite training score among all retained executable fitted laws across the offered timing hypotheses. Include a timing/law combination when its score minus that global best is no greater than the study’s original heuristic ambiguity difference.

This is one global threshold. Applying a separate threshold within every locally competitive timing hypothesis could admit a law as much as twice the declared difference above the global best. Separate-recording error, successful execution and visual appearance do not choose membership.

Each member keeps its delay, response time where offered, and law identity. The family is finite and training-selected; it is not a posterior distribution or calibrated confidence set. A law with unsupported or rank-deficient fitting has no executable forecast to add.

## Forecasts and resource limits

The additional diagnostic reserves its complete retained-family × recording × coarse/refined forecast work before execution. If the complete request exceeds its admitted budget, it must refuse the added diagnostic rather than show only a convenient subset. Existing default results remain available.

For each original recording, a member contributes its entire aligned finite forecast or none. Counts and reasons distinguish retained membership from executable receiving. A displayed span of available forecasts must state its complete/total count; unavailable members cannot silently narrow a claimed complete-family result. Predictions remain predictions, not added measurements.

Pointwise extrema may switch between laws. Their boundaries need not be one executable trajectory. Zero spread can result from one member or identical predictions; it does not imply zero residual error or certainty. Coarse/fine agreement assesses numerical sensitivity, not physical validity.

## What this helps inspect

Under constant command 0.2, authored gain 1.4 and bias 0.07 combine to 0.35. A gain-only law and a bias-only law can match that contribution yet disagree when command changes. Comparing retained laws makes this ambiguity inspectable without declaring which physical mechanism caused it.

This diagnostic uses existing recordings. It does not propose future command courses, alter clock-bound inference, refit a constrained-rate model, or change frozen recorded-experiment sessions. Input-only reopening must recompute results rather than trust saved forecasts.

## Received native behavior

The native candidate passed all **13 focused tests**, covering global-threshold membership, exact timing-pair identity, complete work reservation, immutable source snapshots, cached execution, whole-grid failure, refinement failure, empty families, gain/bias alternatives and actual additional-solver refusal. An earlier synthetic fixture was rejected for `shared_evidence`; that useful negative remains preserved rather than weakening source separation.

Reopening the exact three previously delivered input-only notebooks produced:

| Training inputs | Retained / complete / refined laws | Additional laws | Original + additional reserved steps | Maximum sampled spread (rad) |
| --- | --- | --- | --- | --- |
| Constant | 12 / 12 / 12 | 6 | 12,175 + 12,175 = 24,350 | 0.4506013972001931 |
| One switch | 1 / 1 / 1 | 0 | 12,175 + 0 = 12,175 | 0 |
| Pulse sequence | 1 / 1 / 1 | 0 | 12,175 + 0 = 12,175 | 0 |

The shared declared limit was 500,000 steps. All reserved added work completed in these examples; no failed-run work was reported. Whole-budget refusal is covered by the focused test course, not inferred merely from these successful requests.

The constant family now includes six gain-based and six bias-based timing/law combinations. At delay 0.12 s, the retained gain law has separate RMSE 0.048144225164801956 rad, while the equal-score bias law has RMSE 0.19249132937732708 rad. Original selected delays remain 0 s for constant training and 0.12 s for switch and pulse.

The larger constant span reveals more of the declared executable alternatives. It is **not** calibrated uncertainty, improved prediction, or an enumeration of a continuous coefficient nullspace. The two fitted structures are finite retained laws; rank-deficient subsets remain excluded diagnostic counts. Switch and pulse each retain one law, so zero family spread still does not imply zero prediction error or certainty.

## Qualification and provenance

The complete native candidate run exercised 224 test files: **1,585 tests, 1,584 passed, zero failed, one skipped**. Both maintained launched-product and trajectory smokes passed.

The actual browser receiver passed six check groups in each served and standalone mode using sandbox-admitted Chrome 156. It exercised the real file chooser, keyboard computation and opening/closing the initially closed accounting disclosure, all 12 constant-family members, a same-delay gain-versus-bias forecast contrast, source/export preservation, 1440/390-width layouts, profile return, settings/source retirement and all three original notebook reopenings. A 24,349-step declared budget refused the complete 24,350-step family while retaining the original comparison; reopening the original input restored execution. No page errors, failed requests, HTTP failures or external network requests were recorded.

The standalone build contains 75 captured source inputs and 1,057,718 bytes, SHA256 `1399ab5acb08cd1faf2237af524741588c6102a7f1cb5383527bb97006637413`. All expected input hashes matched. It was built in an exported source root: `sourceHead` and `sourceStatus` remain null, rather than claiming an in-worktree build.

Root and product inspected and accepted the final 1440/390 screenshots: the closed accounting disclosure reduces bulk, the bias-law explanation clarifies that displayed command is unused, and controls/chart remain contained while preserving source, training-choice and original-table context. This is UI acceptance, separate from scientific/native qualification. Browser and native results do not by themselves establish maintained source-package receiving, committed-source identity, or downloaded-release identity. Those require separate qualification receipts. The preceding default comparison’s maintained legacy receiver separately passed all eight groups in each served and standalone mode on the same final build.

The initial Linux preflight detected stale ancillary `scripts/package.py` bytes and stopped before copying or building; all 74 prior application-input hashes matched. That failed attempt and its original exported tree remain preserved. The successful receiving used a separate copy with freshly pinned ancillary source. No package-policy change was needed.

The earlier browser03 attempt failed an overbroad receiver assertion that demanded fitting-inventory counts beyond the displayed exclusion accounting. The product was unchanged for that correction: the receiver now checks named rank-deficient, unexecutable and failed-timing counts with their labels. Browser04 passed the corrected receiver; browser03 remains retained negative evidence. Earlier screenshots motivated the final accounting disclosure; the final screenshots were subsequently inspected and accepted.
