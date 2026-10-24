# Cross-probe preparation response

UNKNOWN LAB → **Does the effect reverse with motion?** tests what a preparation contrast depends on. It reuses the maintained matched-pair validation and counterbalanced history estimate. Training and challenge runs vary probe angle/rate while holding the declared command, preparation identity/duration and recovery delay fixed. Duration/recovery solvers and planning remain unchanged.

## Scientific decision

A pooled history contrast does not say whether preparation changes an additive torque, a rate-dependent response or an angle-dependent response. Four explicit hypotheses predict conditioned minus reference torque:

| Hypothesis | Prediction | Coefficient units |
| --- | --- | --- |
| No change | 0 | N·m |
| Offset | a | N·m |
| Rate response | a × rate | N·m·s/rad |
| Sine response | a × sin(angle) | N·m |

For every training run, the maintained counterbalanced estimate supplies its three-standard-error screen. The coefficient interval intersects all training constraints and declared −100 to 100 bounds in the listed units. Negative features reverse interval endpoints; zero features cannot identify the coefficient. Unexcited hypotheses stay marked. At least three training runs spanning two probe states are required, with at least four pairs in each acquisition order per run.

Separate challenges use frozen training intervals. Their measured values cannot change fit or forecasts. Each row shows interval overlap; the joint verdict requires one coefficient to explain all qualified challenges simultaneously. A qualified contradiction remains visible when another run lacks usable order. Compatibility and a unique surviving offered hypothesis do not establish the physical mechanism.

The authored **ambiguous** example correlates small training angles and rates. Rate and sine predictions remain compatible there; reversing that relationship in separate probes contradicts sine while rate transfers. An authored mixed offset-plus-rate control rejects every offered family. These are constructed oracles, not measured physics, blind science, calibrated confidence or general hidden-state discovery.

## Input and actual consumers

Open `/unknown-lab.html` from the normal server. Select an authored control or use **Open probe measurements**. Export saves actual inputs; reopening recomputes results. Nothing is automatically persisted. Invalid imports preserve the previous study, and a late read cannot replace a newer authored choice.

```sh
node scripts/probe-study.mjs --example ambiguous
node scripts/probe-study.mjs --export-example drag > probe-study.json
node scripts/probe-study.mjs --input probe-study.json
```

Exported examples provide complete input templates. The top-level object has `schema: "worldlaw.probe-response/v1"`, `preparation: {id,duration,recovery}` and at most 24 `runs`. Each run has a distinct safe `id`, `role` (`training` or `challenge`), matching `preparation`, a `probe` containing `command`, `position`, `rate`, and an existing `worldlaw.history-challenge/v1` `notebook`. Units are N·m, rad, rad/s and seconds. Duration/recovery are 0–30 seconds. Every trial must match its run's declared fixed probe to 1e−9; mixed-state pooled runs cannot stand in for a probe response.

Measured and synthetic evidence cannot mix. Virtual metadata, if present, must agree with the preparation duration. Command stays fixed. Exact normalized readings cannot recur across runs, even in subsets or with renamed pairs/changed acquisition indices. This conservative overlap rule can refuse independent identical quantized readings: preserve those outside this qualified study rather than altering evidence to bypass it. Distinct numbers and labels do not authenticate independence or preparation.

## Experience decision

Two alternatives were considered: another duration-like continuous response curve, or side-by-side frozen interval confrontations at actual challenge states. The latter is implemented because angle and rate vary together and no single continuous x-axis is justified. Amber observed intervals confront colored model intervals; numeric rows retain exact probe states and failures. This extends the existing apparatus without changing paired-history or duration views. No animation is claimed.

## Verification and limits

```sh
node tests/unknown-probe.test.mjs
node --test --test-isolation=none tests/*.test.mjs
BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/probe-receipts node scripts/unknown-probe-browser.mjs
```

Native controls cover all three transferring responses, omitted mixtures, small-angle ambiguity, held-out invariance, zero excitation, signed intervals, joint consistency, missing order, source/scope mismatch, subset reuse and replay. The browser receiver uses the actual server, controls, file input, export, keyboard, pending-file race and narrow layouts. Browser execution evidence is recorded separately; the receiver alone is not proof that it passed.

Physical replication, source authentication, correlated-noise calibration, nonlinear drift and richer latent-state models remain open. Rate response can be instrumental; sine response need not be a restoring force. Contrasts alone cannot infer these causes.

### Native receiving, 2026-10-24

On Node 24.19.0, the composed upstream 59fcbad6250b56a40e0a58bc2da73c22e75cf474 text/CSV source plus this increment passed 308 tests, with zero failures and one optional live Node/Chromium notebook exchange skipped. The focused probe course passed 12/12. The initial suite failed only because this receiving snapshot omitted pinned raw CSV files; after restoring their exact hashes, the ten angular tests and full suite passed. Independent review found a training-subset reuse loophole; normalized per-reading overlap rejection repaired it, and the reviewer separately reran the original counterexample and 12-test course.

Actual CLI execution of `--example ambiguous` retained drag and sine in training, then reported joint drag compatibility and sine contradiction. Exporting the drag example and reading the saved JSON returned a single compatible drag hypothesis. Empty JSON input returned exit 1 with `Invalid probe study JSON.` Local server smoke was attempted but the local sandbox refused loopback binding with `EPERM`; actual browser/server receiving uses a separately authorized execution host and must be recorded before integration.

### Actual browser receiving

The authorized receiving host ran Node 22 with Chrome 156 against the actual local product server. The first receiver run failed while activating the probe button by keyboard: the CDP Enter event omitted carriage-return text. The corrected receiver (SHA-256 `e10af80c347a164c76ddf32faa62ae9603d77314bf8adfc7dcd899f4f54ab4ce`) retained real keyboard dispatch and passed all 9 checks without changing product code. It attached to a blank page, enabled runtime/network monitoring before navigation, then exercised ambiguous training and reversed-probe challenges, exported Blob inputs and file-control reopening, declared-source handling, reused-training-subset refusal, pending-read ordering, and 1440/390/320-pixel layouts. It captured no script exceptions or external requests under its URL filter. This verifies the exported Blob and reopening path, not independently read bytes from the browser's downloaded file. Screenshot visual inspection is recorded by the integrating reviewer.

The integrating visual review then found an important failure that the first layout assertions missed: scaling the 820-pixel plot to phone width made its labels only about 5–6 pixels high. The panel now keeps a legible minimum plot width inside a named, keyboard-focusable horizontal-scroll region, with 14-pixel labels and visible scrolling instructions. New receiver checks measure on-screen text size and exercise ArrowRight scrolling at narrow widths. The corrected revision passed all 12 actual Chrome checks on the authorized receiving host, including measured text size and real keyboard scrolling. The integrating reviewer inspected the 390- and 320-pixel screenshots and confirmed readable plot labels and clear focus/scroll treatment. A no-horizontal-page-overflow assertion alone had not established usability. The final receiver SHA-256 is `1e7a0dc14479e39117b0481b40996e338ef006601171d74854a42b6834e207f6`; the final panel SHA-256 is `520c4afff511f6ab54d644fb5c8b965edd28224df4b472ef32d30a3d887b512f`. Remote receiving log: `/tmp/hamon-06d8-worldlaw/browser-mobile.log`; screenshots: `receipts-mobile/worldlaw-probe-{1440,390,320}.png`. These checks qualify the bounded authored/imported-input consumer, not physical law accuracy or instrument calibration.

### Fresh-main composition

Before publication, the probe import/mount was composed onto main `b53b34c4ba8416a71e0d9dec227094968ad8febd`, retaining its new recovery panel and all continuous/duration hooks. All maintained local UNKNOWN LAB runtime dependencies matched the current Git tree; the three new recovery modules were separately hydrated and their Git blob hashes verified. The composed app SHA-256 is `52b6041c116a83191f582feed7c5b8108710ed639e3e678ac0cc310431903520`.

This exact composition passed all 12 browser checks on Node 22/Chrome 156, including keyboard activation, input export/reopen, negative import, pending-read protection and legible keyboard-scrollable plots at narrow widths. Remote receipt: `/tmp/hamon-06d8-worldlaw/browser-current.log`, with screenshots under `receipts-current/`. The prior native suite and independent scientific review remain applicable to the unchanged probe fitting modules. No independent physical validation follows from this composition check.

During publication, main advanced to `736cd761ce15aa7e2e32b51af67a17cd7548381e` with the separately owned recovery planner. The normal merge correctly refused conflicting app hooks. The integrating reviewer retained that complete current app and added only the probe import/mount, hydrated all seven changed runtime dependencies with exact Git blob checks, and reran the actual browser receiver. All 12 checks passed again, including the mounted recovery-planner composition and no page exceptions. Composed app SHA-256: `6157f13c2f1d14b6c5d988768feb8287a628d213e4600253ac3b27400251ddcc`. Receipt: `/tmp/hamon-06d8-worldlaw/browser-merged-planner.log`; screenshots: `receipts-merged-planner/`. The PR branch incorporates both parent histories; no other contributor's planner source is replaced.
