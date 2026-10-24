# UNKNOWN LAB duration-response hypotheses

Open `/unknown-lab.html` through `npm start`. **How does the past accumulate?**
extends the existing paired-history apparatus with separate duration acquisitions.
**Run independent virtual duration series** acquires training at 0.3, 1 and 3 s,
and challenges at 0.6, 2 and 6 s, with distinct seeds and 32 pairs per run.
Alternatively add currently executed/imported pairs to either role. Virtual
durations use their acquisition metadata; measured durations are user-declared.
Export/Open duration study preserves inputs and recomputes results. No automatic
saving occurs. Removing training explicitly recomputes models; challenge outcomes
never fit or rank them.

## Mechanism

The existing counterbalanced screen supplies a contrast y and bound b = 3 SE.
The new module intersects feasible amplitude intervals across every training run
for zero response, constant preparation artifact a, and saturating response
`a (1 - exp(-t / tau))`. The finite tau grid is 0.2, 0.4, 0.8, 1.3, 2, 4 and 8 s;
the offered amplitude range is −100 to 100 N·m. Both limits are visible. At zero
duration, the saturation hypothesis predicts zero exactly. At least three distinct
training durations and four pairs per acquisition order per run are required.
None-compatible, ambiguous and insufficient-training remain explicit outcomes.
Zero response does not identify a time constant.

All challenge prediction intervals use the frozen training amplitude ranges.
Challenge compatibility compares these intervals against observed screen bounds.
The joint challenge check requires one amplitude to explain every qualified run;
it cannot choose a different parameter for each challenge. A qualified
contradiction survives the addition of an unqualified run. Otherwise unqualified
runs make the joint result incomplete. The joint check never narrows future
predictions or refits the training model.

The plot displays midpoint curves and observed bounds, not confidence envelopes.
The table retains full feasible training amplitude intervals. Three-SE screens
are not calibrated confidence intervals. Finite-grid compatibility is not unique
physical identification. Nonlinear drift, duration-dependent instrumentation,
preparation artifacts, carryover and custody remain unresolved even after a
successful saturation forecast.

Exact repeated observations are rejected even if pair labels change. Virtual
runs with simulation metadata require distinct random seeds. Synthetic/measured
runs cannot mix. These safeguards cannot authenticate physical independence or
prevent deliberate input tampering.

## Receiving

Local Node v24.19.0 uses explicit `--test-isolation=none` for actual individual
case execution. Ten new analytic controls pass, covering independent saturation,
zero/constant/negative/omitted laws, high noise, coverage/order refusal, challenge
invariance, roundtrip, source separation, virtual seed/duration provenance,
per-challenge parameter switching and mixed qualified/unqualified contradiction.
The existing 25 Unknown Lab cases also passed before the final mixed-status fix.

The UI's distinct-seed virtual series retains only saturation-1.3 with amplitude
interval [0.6962130634998733, 0.7038521876709265] N·m; all three challenge runs are
compatible. This is synthetic receiving only.

The first full local run had 234 passed, one browser skip and one pinned-fixture
hash failure among 236 tests. The hash failure came from connector snapshot
trailing newlines. Original fixture bytes were restored against Git blob SHA,
and the affected 10-test angular suite passed. No fixture change belongs in this
feature. Local HTTP smoke cannot bind (EPERM), and local Chrome is unavailable.
Remote launched receiving is required before merge:

```
npm run smoke
node scripts/unknown-lab-browser.mjs
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-duration-evidence node scripts/unknown-duration-browser.mjs
```

The new browser harness checks actual acquisition, plot/table, export and file
reopen, malformed import atomicity, duplicate refusal, keyboard focus and
1440/390/320 px layouts. Harness existence is not a passing result.

## Grounded next capability

A training-only duration planner can compare complete surviving prediction sets
under declared noise and acquisition budget, refusing overlap rather than ranking
midpoint disagreement. The frozen finite fit already supplies its required
intervals. Physical reference-channel acquisition is a separate follow-on needed
to distinguish duration-dependent instrument drift from mechanism response.
