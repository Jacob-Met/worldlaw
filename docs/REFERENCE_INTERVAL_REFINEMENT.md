# Refinement with a finite reported reference interval

The UNKNOWN LAB refinement panel can compare future observations whose reference channel has a declared finite interval. Start or reopen a retained reference sequence with one surviving fixed-tau additional-response family, enter the target duration and point reference, and declare each offer's duration, reported reference center/half-width and MAIN contrast half-width. The declaration is conditional: the instrument does not control or authenticate a future reference reading.

## What the width means

Each current explanation has one fixed gain and amplitude shared by all admitted source records. A future reference interval gives that explanation a range of possible MAIN readings, widened separately by the MAIN contrast half-width. Two explanations remain jointly possible after some common future MAIN reading exactly when those ranges overlap in the real-arithmetic model. They may use different latent reference values inside the same reported interval. The display identifies both coefficient explanations, both reference witnesses, the common MAIN reading and both residuals.

The comparison reports the largest target-prediction separation retained by any such pair. Its target reference remains the separately declared point value. Thus it compares worst remaining target ambiguity conditional on the offered observation bounds, not forecast accuracy, a probability, calibrated uncertainty or an achieved physical intervention.

Finite reference uncertainty can prevent improvement even at zero MAIN half-width. For gains [1,2], a reported reference interval [0.5,1.5] admits a shared MAIN reading under distinct latent references, preserving target width 1. Forcing both alternatives to use one exact latent reference would incorrectly eliminate that ambiguity.

## Complete components and numerical limits

Every original gain-sign component remains separate. For each component pair, the implementation intersects its four-dimensional product with two overlap halfplanes. A new vertex can lie only on an original product face of dimension at most two. The implementation enumerates product vertices, edges and two-faces, then checks original inequalities. It never convexifies the disconnected union or changes the retained coefficient family.

Optimization is binary64 screening. Exact dyadic predicates only distinguish zero versus nonzero rank of stored linear forms; they do not certify widths, source enclosures or the exponential basis. Unsafe small determinants/orientations, nonfinite values, failed witness checks or exceeded work bounds produce an explicit numerically unresolved offer. Such offers prevent a unique recommendation. At most two components with 64 vertices each and 100,000 reserved candidate checks per offer are admitted, with at most 32 explicit offers. Work is reserved before enumeration; no partial search is reported as complete. Displayed near-zero reductions are labeled within the comparison guard, with signed raw values retained in numerical details.

All attaining explanations are rechecked against original components and every admitted training or qualified actual source interval under the maintained screening slack. A later actual acquisition may only narrow the original family. No new tau, row-specific coefficient or fitted response is introduced.

## Retained source and actual receiving

Save/reopen contains complete original sequence source, target and offers, with no derived predictions. The complete canonical account is bounded at 4 MB. Existing exact-point refinement accounts remain replayable through their original implementation and are exported unchanged. Comparing newly edited controls explicitly creates an interval account; zero reference half-width is an explicit limiting assumption, never a replacement for a blank input.

Selecting an offer freezes its full reference interval and MAIN precision through the existing sequence receiver. It does not manufacture an actual acquisition. Failed offers, unqualified actuals, original observations, frozen prefixes and joint shared-coefficient conditioning retain their existing meanings. Parent changes mark the accepted refinement stale and cancel pending imports while preserving accepted source/report/export; failed imports and failed comparisons retain the prior account. A new child draft also cancels a pending parent read without silently changing source.

## Reproduction

Run `node test-interval-refinement.mjs` for analytic/source/replay controls and `node test-interval-oracle.mjs` for 42 independent generic four-dimensional exact stored-value oracle comparisons. The oracle fixture records its conditional stored-value scope and does not certify the upstream model. `node test-refinement.mjs` retains the exact-point baseline controls. The maintained HTTP smoke is `node scripts/unknown-reference-receiving.mjs`.

For the actual consumer course, set `BROWSER_EXECUTABLE_PATH` to an installed sandboxed Chromium executable, set `BROWSER_ARTIFACT_DIR` to an owned new receipt directory, and run `node scripts/reference-interval-browser.mjs`. The course checks the Chromium sandbox and refuses an unqualified browser. It retains failures/cleanup and exercises point-account replay, finite-interval comparison, unchanged interval request freezing, source-only download/reopen, blank-field refusal, parent/child import races and desktop/narrow keyboard interaction. The final publication evidence records actual results and source hashes separately from this reproduction instruction.

## Received increment

The source qualified on 2026-10-28 uses Node 22.23.4 and installed Google Chrome with the maintained strict sandbox admission. The analytic/source/replay course, 42 independent stored-value oracle comparisons, unchanged point-refinement regression, 94 exact served resources and 40 actual browser groups passed. A separate exact-runtime capture course passed three finite-witness viewport checks at 1440, 390 and 320 pixels. This is an authored-source consumer qualification, not physical instrument validation. Both earlier receiving setup failures stopped before tests and remain in the history. Current-source identity proofs allow unrelated later mainline changes to be composed without relabeling those executions.

The product-specific interaction stays inside the retained scientific apparatus: original evidence determines shared coefficient explanations, finite observation bounds change their prospective separation, and an explicit selected request returns to the existing sequence receiver. Human-readable attaining explanations and reference/MAIN witnesses remain ahead of nested numerical details. Actual source, conditional forecasts and later acquisitions are labeled separately.
