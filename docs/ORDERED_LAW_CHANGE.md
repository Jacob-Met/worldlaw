# Ordered coefficient investigation — working evidence

This is a reviewed, unmerged consumer candidate mounted in the maintained Studio evidence view. Actual browser behavior and geometry receiving pass on the composed source described below; published-source receiving remains required.

The mechanism reuses maintained `predict`, `evaluate` and column-normalized QR. It holds one inspected structure fixed, enumerates all contiguous supported two-part splits, and compares their total original-reading squared error with one constant-coefficient fit. Its score is `n log(max(SSE/n, declaredNoiseSigma²)) + parameterCount log(n)`. The constant parameter count is k; a split uses 2k+1. This is an explicitly heuristic comparison, not a calibrated change-point likelihood or a physical identification method. The six-score-unit ambiguity band is similarly heuristic. Rank failures remain visible and withhold an overall preference.

Acquisition order requires a sourced declaration. All original values remain unchanged. The method neither authenticates order nor assumes arbitrary import order represents time. Its saved payload contains original inputs only. Later evaluation cannot change the cut or coefficients and does not establish that its source is independent or that the last regime persists.

## Use the Studio investigation

After importing original torque observations, inspect a model in the ordinary Studio and expand **Does one law survive the acquisition order?** beside its repeated-state diagnostics. Supply the basis for interpreting the original row order as acquisition order, and the minimum number of original rows on each side. **Investigate coefficient stability** refits only that inspected structure. It does not search for different terms or alter the active notebook model.

Compare the original-row residual overlay and constant/before/after coefficient table. Open **Inspect every supported cut** to inspect every admitted cut, including rank failures. The preferred cut is a heuristic proposal; competing cuts and the constant-law comparison remain visible. The declared Studio noise floor is shown explicitly and is preserved on save.

Paste separately obtained later torque observations as a JSON array to compare the frozen constant and last-segment predictions. This does not refit anything and does not authenticate independence or continuation of the last regime. The saved investigation contains original fitting rows and assumptions; separately pasted later readings are not included in that file. Preserve their original source separately. Reopen the downloaded investigation to recompute the original comparison. Changing the order basis or segment support clears its previous result.

## Executed local controls

`node tests/ordered-law-change.test.mjs`: nine tests pass on Node24.22.1, approximately120ms aggregate in the recorded run. These are authored tests, not measured physical trials.

- Constant and changed damping courses retain the proper heuristic preference; full65-cut enumeration finds cut48 for96 rows.
- Original-input JSON replay reproduces every result. Irrelevant challenge fields cannot affect the investigation.
- A deficient early rate population retains unestimable splits and withholds complete preference.
- A static quadratic response with a changed operating range produces a spurious split preference. This important failure is retained and shown in the consumer limitation.
- Reversing observations exchanges the two fitted populations. Interleaving the regimes destroys the clear cut and leaves substantial baseline mismatch.
- The earliest admitted16-row boundary is included. No cuts outside declared support are attempted.
- Absent order basis, invalid floor, weighted readings, unknown terms and complete searches exceeding3M reserved units refuse.

The earlier independently phased later-course probe gave constant versus last-regime RMS0.215058632 versus0.002090355N·m for changed damping; unchanged damping gives0.002087058 versus0.002087444. This does not establish blind physical generalization.

## Bounded runtime cost

A separate local complete four-term timing probe at96/256/400 rows took78/75/129ms, reserving101376/925696/2368000 work units for65/225/369 cuts. These are single-process Node24.22.1 timings, not browser latency guarantees.

## Candidate receiving and integration remaining

The mandatory design/capability/acceptance documents were read. The investigation is mounted beside the original repeated-state evidence with actual row residual overlays and coefficient comparison. Root received the full maintained product on current main `a2de248f026666bb1c9a560c960210d13ac45b93` plus this candidate, using Node22.23.4 and Chrome on the authorized Linux host. Nine numerical tests, the maintained launched-server smoke and three actual CDP browser groups passed. The browser groups cover original input recomputation, frozen later scoring, keyboard actions, actual download/source-only reopening, stale-result clearing and desktop/narrow operation. New DOM geometry assertions establish that all controls fit their host, all four coefficient columns are visible and the later textarea does not collide with its action.

Earlier screenshot attempts were not accepted as visual proof: smooth scrolling initially captured the main Studio instead of the investigation; a subsequent cropped capture exposed unstyled/colliding controls and a clipped narrow coefficient table. The source layout was repaired with scoped Studio controls, wrapping coefficient columns and accessible scroll containers. The receiver now captures separate actual viewport states for the heading/residuals, coefficients and later comparison, after verifying their positions. Those earlier failures remain failures, not retroactive passes. Final screenshot inspection and exact published-source checks belong to the native PR receipt.

## Maintained browser receiving command

Start the ordinary server from the candidate source, then run:

```sh
BASE_URL=http://127.0.0.1:4193 node scripts/receive-ordered-change.mjs /absolute/browser-session.mjs /absolute/chrome /fresh/receipt-directory
```

The harness checks the actual SVG residual population and visible height, independent authored later predictions without fitting, real keyboard download and input-only reopen, stale result clearing, desktop/narrow layout and page exceptions. Actual execution results belong in the published receipt; the existence of this script is not a passed browser check.
