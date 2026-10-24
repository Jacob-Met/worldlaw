# WORLDLAW

**An experimental workbench for learning executable torque models and testing what changes your explanation.**

Import observations, compare competing law structures, choose a discriminating input, obtain a new measurement, and watch the model and its held-out predictions change. The browser workbench includes a reproducible virtual instrument, a dynamics solver, residual plots and a portable notebook that replays its evidence history.

Current scientific scope: **finite-library scalar torque discovery**. The default instrument and supplied examples are synthetic. The larger goal remains an autonomous physical scientist that discovers mechanism structure from real observations and transfers explanatory models to unfamiliar conditions. [The full product canon](docs/PRODUCT_CANON.md) remains open.

## Open-ended research direction

[UNKNOWN LAB exploration](docs/UNKNOWN_LAB_EXPLORATION.md) develops the existing ambition toward discovering useful representations, questions, measurements and experiments. It is a seed for further invention, not a fixed endpoint or a claim that the current finite-library workbench already provides those capabilities.

## Run locally

With Node.js 20 or newer, from this directory:

```sh
npm start
```

Open **http://127.0.0.1:4193**. No package installation, cloud account, model download or API key is needed. The server binds to loopback and serves maintained application assets. Observations and model computation stay in your browser. Stop the server with Ctrl+C.

## Measure recorded motion

Open **Motion Lab** from the studio header, or visit **http://127.0.0.1:4193/motion.html**. Load a local WebM/MP4 mechanism video, mark a fixed pivot and a stable visible marker, then track a selected time interval. The pixel view, angular plot and measurement ledger show what was accepted and where tracking stopped. Correct the marker to resume; missing frames remain visible and split the evidence into separate segments.

The notebook preserves the original video's SHA-256, decoded image coordinates, browser-reported frame timestamps, calibration, match diagnostics and corrections. Saving and reopening the notebook does not embed the video: reconnect the matching original file to inspect its frames. An optional synthetic instrument exercises the same pixel tracker and is labeled synthetic throughout.

**Export angles** requires an explicit segment selection when a track contains gaps. **Studio observations** additionally requires your known constant inertia and applied torque declaration; the video does not establish either. The export uses the existing angular telemetry adapter and its disjoint derivative-window split. Import that file into the discovery studio to compare executable torque models. Coupled mechanisms such as the real double-pendulum verification video do not automatically satisfy the scalar-inertia assumption.

Motion Lab currently assumes a fixed camera, a declared fixed pivot, approximately planar motion and a marker whose appearance stays stable. A high image-match score is not calibrated location confidence. Read [Motion Lab receiving and limitations](docs/MOTION_RECEIVING.md) and [the tracking contract](docs/MOTION_TRACKING.md) before interpreting video-derived physics.

## Try the complete experiment

1. The virtual notebook starts with 64 observations at small angles. Linear spring and sinusoidal gravity are competing explanations.
2. Select **Use suggested state**, then **Run virtual experiment**. A separate virtual instrument returns a fresh torque observation.
3. The selected restoring structure changes to sinusoidal gravity. The fixed 61-condition held-out error drops from approximately **1.6453 to 0.0009573 N·m** for the declared seed. These are synthetic instrument results.
4. Inspect another hypothesis to compare its fit and residuals. Its heading identifies inspection; planning continues to use the ranked competitive ensemble.
5. Change initial angle or inertia and select **Run dynamics** to execute the learned model. The schematic and trajectory are predictions. Invalid dynamics remove the prediction instead of displaying a substitute pose.
6. **Save session** downloads observations, supplied provenance, assumptions and revision events. Reload restores the browser notebook. **Open session** recomputes a downloaded notebook; **Undo** reverses its last revision.

## Bring observations

Select **Import observations** and choose UTF-8 CSV or JSON. Supply 8–4,096 fitting rows, with each value bounded to magnitude 10⁶:

| Field | Meaning | Units |
|---|---|---|
| `command` | Applied torque command | N·m |
| `position` | Joint angle, consistent sign convention | rad |
| `rate` | Angular velocity | rad/s |
| `jointTorque` | Observed net joint torque | N·m |

CSV starts with `command,position,rate,jointTorque`. Extra metadata columns are allowed but are not retained as observation fields. JSON may contain an array, or a `worldlaw.observations/v1` object with `observations`, optional `heldOut`, and a `source` label and metadata. All supplied unit declarations must agree. Files are limited to 2 MB.

Try [the independent synthetic quadratic-drag fixture](examples/synthetic-quadratic-drag.json): 64 fitting and 31 held-out rows select actuation, linear spring and quadratic drag. Imported observations create an instrument notebook: virtual measurement generation is disabled and controls accept a measured torque result from your own instrument. Proposed states remain within the baseline's input ranges; the application does not control hardware.

Held-out rows are excluded from fitting, ranking and acquisition. Source hashes and derivation assumptions are retained as supplied evidence, without independent authentication. CSV export contains numeric rows only; keep the notebook when provenance and history matter. Failed imports preserve the current valid notebook. Late file reads cannot replace a newer notebook.

### Angular telemetry

The optional Node CLI derives torque from time/angle telemetry with explicitly declared inertia:

```sh
node scripts/derive-telemetry.mjs --input examples/synthetic-angular-telemetry.json --inertia 0.8 --position-sigma 0.0001 > derived-observations.json
```

Import that output into the same workbench. Read [the trajectory adapter contract](docs/TRAJECTORY_ADAPTER.md): numerical differentiation amplifies noise and introduces smoothing bias. Excellent error on derived data does not establish exact physical-law recovery.

## Verify

```sh
npm run verify
node tests/torque-discovery.test.mjs
node tests/trajectory-observations.test.mjs
node tests/session.test.mjs
node experiments/active-discovery.mjs
```

The smoke command starts the actual server and exercises discovery, virtual experiment execution, revision and notebook reopening. Optional graphical receiving needs a separately installed Playwright package and Chromium-compatible browser:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
BROWSER_ARTIFACT_DIR=/absolute/path/to/receipts \
npm run browser
```

This browser course checks rendering and canvas output, keyboard experiment execution, an actual download, reload/reopen/undo, a second mechanism, measurement recording, dynamics refusal, responsive layout and file-read ordering. [Product acceptance](docs/PRODUCT_ACCEPTANCE.md) records the receiving boundary. GitHub Actions is unavailable; these checks run directly.

## Scientific interpretation

Trajectory Challenge includes **Investigate the angle reference** for angular
recordings with unknown torque scale. It compares a declared offset grid using
training evidence, freezes the candidate, and tests separate recordings without
changing the original notebook. The measured PASCO example retains substantial
error even when a shifted coordinate improves average error. An offset does not
identify a sensor defect or physical cause. See [the contract and receiving](docs/ANGLE_REFERENCE.md).

The program searches subsets of seven declared terms and distinguishes some alternative structures. It fits coefficients with scaled QR and ranks models with a noise-floor information criterion. Model spread is a heuristic, not calibrated probability. [Scientific details and retained counterexamples](docs/SCIENTIFIC_CORE.md) cover rank deficiency, an omitted cubic law, parameter drift and a 40-case active-versus-passive experiment.

Video reconstruction, arbitrary mechanism topology, calibrated uncertainty, physical instrument receiving, broader generalization, provider/GPU qualification and contest submission remain open. This usable increment preserves the full original goal.


## UNKNOWN LAB — matched-history challenge

Open **Unknown Lab** from the main WORLDLAW header, or visit `/unknown-lab.html`.
This is a complementary structural falsification instrument, not a replacement for
the finite-library Discovery Studio, Motion Lab, or Trajectory Challenge.

Run paired virtual experiments with *identical* command, angle and rate, but
different declared preparation histories. The virtual oracle has a bounded
hidden-memory torque term with an explicit decay time; its coupling and
duration controls are simulation parameters. Toggle the coupling to zero to
see how the same screening method can remain inconclusive. The apparatus
displays each pair's two torque readings, the assumed independent sensor noise,
the signed mean difference and a deliberately conservative three-standard-error
screen. **CHALLENGED** means a memoryless deterministic torque relation is
incompatible with the paired readings under those assumptions; it does *not*
establish physical memory, causal history or calibrated probability.

**Bring measurements:** Click **Open measured / saved pairs** and supply local
UTF-8 JSON with the schema `worldlaw.history-challenge/v1`, `source:"measured"`,
a declared `noiseSigma` in N·m and 4–128 matched pairs. Each pair contains
one `history:"reference"` and one `history:"conditioned"` reading with the
same `pairId` and numeric `command`, `position`, `rate`, `jointTorque`.
Command, position and rate must match within 0.001 in the declared SI units,
or import refuses; a small mismatch does not guarantee absence of confounding.
Imported evidence is user-declared and stays in this browser. Export JSON to
preserve exactly the imported trials, source classification and noise assumption.
Saving in local browser storage is **explicit**; Forget deletes that local copy.

```sh
node --test tests/unknown-history.test.mjs
npm run smoke
# Optional: Node 22+, installed Chrome/Chromium and a writable scratch location
BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-evidence npm run unknown:browser
```

The Chrome receiver exercises a real local HTTP server, paired synthetic
positive/negative interventions, user-declared import, mismatched-state refusal,
explicit local persistence, reload, narrow viewport and page exceptions. It
does not qualify a physical instrument or establish that preconditioning
actually altered hidden state. Physical replication, authenticated observations,
instrument drift, matched-history acquisition and held-out latent-law fitting
remain research work.

### UNKNOWN LAB — Counterbalance acquisition order against instrument drift

The **Simulated drift per reading** control adds a known linear sensor offset in N·m at each successive virtual observation, independently of the synthetic preparation-memory effect. **Counterbalanced AB/BA** alternates which history condition is read first. Set memory coupling to zero and drift to a nonzero value to observe why a one-direction acquisition can imitate memory, and why reversing the order changes the explanation.

Imported JSON can optionally include a nonnegative integer `sampleIndex` on **every** trial, with distinct indices globally and adjacent values within a pair. Four reference-first plus four conditioned-first pairs are required for a counterbalanced estimate. The order-corrected preparation contrast is half the sum of the two order-group mean differences; the linear per-reading drift estimate is half their difference. The displayed screen uses a conservative three-standard-error bound. If the declared reading order is insufficiently balanced, no history challenge is accepted even if the unadjusted differences look significant.

Legacy JSON without `sampleIndex` remains supported and is explicitly labeled *order not recorded*, without gaining retrospective drift qualification. Declared sample order is not verified clock evidence. Linear drift separation does not handle nonlinear drift, carryover, temperature shifts, measurement-time differences, instrumental autocorrelation or other unmeasured confounding.

Run `node --test tests/unknown-order.test.mjs` and `npm run unknown:browser` to receive the new behavior.

### UNKNOWN LAB — Test phase-locked artifacts with seeded order

A known counterexample to fixed alternation: a *purely simulated*, zero-memory sensor with a period-four reading artifact can make ordinary ABAB data look like a preparation-dependent law, even after the linear-drift correction. The workbench now lets you choose **Fixed alternating AB/BA**, **Seeded shuffled AB/BA** or **Reference first only**, and set a synthetic **Period-four sensor artifact** amplitude. The virtual sequence seed is editable so changing the schedule does not secretly change the mechanism, its true effect or its noise. Alternating and shuffled schedules remain exactly reproducible given the same seed. The virtual evidence JSON records the declared seed and simulation parameters in a clearly simulated-only object; user-declared measured JSON never inherits those oracle claims.

Shuffling the order breaks *this exact* phase-lock in the validated counterexample. It does **not** guarantee freedom from nonlinear drift, phase correlation with the new sequence, cross-over carryover, serial sensor noise, instrument heating or unsafe real-world randomization. Actual instruments require their own independent controls, timestamps, repetition, safety authority and source verification. A screening label never establishes physical causation.

Verify with `node --test tests/unknown-phase.test.mjs` and `npm run unknown:browser`.
