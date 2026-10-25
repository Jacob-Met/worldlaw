# Recovery on common original readout support

In UNKNOWN LAB, expand **Does recovery survive the same readout-state population?** inside **Does the response recover?** Import an ordinary recovery notebook, compare its common support, inspect the original pair ledger, and export/reopen the unchanged original recovery evidence.

The ordinary recovery calculation aggregates paired preparation contrasts. A change in the distribution of observed command, angle or rate between recordings can therefore imitate recovery when preparation response depends on that state. This inspector preserves that original calculation and compares a second, explicitly retrospective population. It does not replace the notebook, change the acquisition planner, identify a physical cause, or silently choose a better law.

## Original pair selection

The complete original notebook first passes the maintained recovery validator, including source classification, recording identity, reuse, byte, delay and protocol checks. Each usable pair must have exactly equal recorded command, position and rate on both histories, plus recorded adjacent acquisition indices. The ordinary paired validator's small mismatch tolerance does not imply exact support here.

Training pairs are partitioned by the exact three coordinates and acquisition order (reference-first or conditioned-first). A stratum's frozen count is the minimum original count across **all training recordings**. A zero minimum removes that stratum. Within each stratum, the earliest original pairs by their first sample index are retained. No torque value, residual, fitted law, challenge coordinate or challenge outcome participates in choosing these counts or identities.

The selected population must contain at least four pairs in each order. Every training recording then has the same coordinate distribution within each acquisition order. Those distributions may differ between orders; both are unchanged across training and supported challenges. The existing half-sum of order-group means and inherited screening calculation receive the retained original trials without new weights or interpolated observations.

Each challenge must supply every frozen stratum with at least its frozen count. Missing support makes that **entire challenge unavailable**; an incomplete partial population is never compared. Such a challenge cannot turn an untested or compatible aggregate into success. Contradictions from other supported challenges remain contradictions. The original full challenge remains visible in the baseline.

The same maintained recovery fitting and receiving arithmetic serves both populations. The small source-selection entry point admits the complete original recordings before selecting original complete pairs. Numeric equality of two selected subsets is allowed because the original recordings, not a retrospectively reconstructed fake recording, remain the custody boundary. Existing original-recording reuse refusal is preserved.

## Executed counterexample and limits

The authored control uses a preparation contrast equal to observed rate, with no time dependence. At delays 0 and log(7), high-rate fractions 56/64 and 8/64 in each acquisition order produce aggregate contrasts 0.875 and 0.125 N·m. The original finite library admits only decay with tau = 1 s; a separate population with contrast 0.5 at log(1.75) also receives that decay.

Common support retains eight low-rate and eight high-rate pairs per order in every recording. Both training contrasts become 0.5 N·m. The misleading tau = 1 decay is contradicted, and persistence is compatible. Tau = 2 also remains compatible under the inherited broad screens: this is an informative change in explanation, **not unique identification**. Five additional authored mixture controls preserve equal common-support means. A separate actual-decay control retains its exponential explanation; changed receiving outcomes contradict it without changing its frozen fit.

Exact overlap is restrictive. Continuous random coordinates can leave no common support; nearby coordinates are not rounded or interpolated into agreement. Selection can discard substantial evidence, increase uncertainty, and limit the result to a narrow observed population. Earliest-pair selection does not correct chronology-dependent drift, carryover, hidden variables, sampling bias or true-coordinate error. Conditional screens retain their original heuristic interpretation; no calibrated uncertainty, causal adjustment, physical independence or authentic acquisition is established.

## Source and experience

Every recording exposes retained and excluded original pair identities and exclusion reasons. Frozen strata expose actual coordinates, units, order and counts. Source replacement clears the comparison; failed imports preserve the accepted source. Original recovery export contains inputs only; reopen and compare recompute all selections and model results.

The interface stays inside the maintained recovery apparatus. An adjacent contrast plot was chosen over another independent model dashboard: amber full-course and cyan common-support readouts confront the population change at the same recorded delays, while the original recovery curves remain visible above. The small horizontal mark separation distinguishes overlaid observations and is not a time offset. Marks are discrete observations, with inherited screening bars; no intersample motion is drawn. The result table keeps all candidate statuses and ambiguity, and source ledgers remain expandable beneath it.

## Verification

```sh
node --test --test-isolation=none tests/recovery-support.test.mjs tests/recovery-response.test.mjs tests/recovery-planner.test.mjs
BROWSER_SESSION_MODULE=/absolute/path/to/maintained/browser-session.mjs \
CHROME_BIN=/absolute/path/to/chrome node scripts/recovery-support-browser.mjs
```

The browser receiver uses an externally supplied maintained browser-session helper and requires its observed Chromium sandbox admission. It starts the actual documented WORLDLAW product server, imports original files, operates the keyboard comparison, checks the live model/plot results, downloads source-only evidence, refuses absent support, invalidates source replacement, and reopens the downloaded original. Desktop and 390px captures are retained in the reported task-owned temporary evidence directory. This is local software receiving, not a deployment or physical instrument qualification.
