# WORLDLAW

**An experimental workbench for learning executable torque models and testing what changes your explanation.**

Import observations, compare competing law structures, choose a discriminating input, obtain a new measurement, and watch the model and its held-out predictions change. The browser workbench includes a reproducible virtual instrument, a dynamics solver, residual plots and a portable notebook that replays its evidence history.

Current scientific scope: **finite-library scalar torque discovery**. The default instrument and supplied examples are synthetic. The larger goal remains an autonomous physical scientist that discovers mechanism structure from real observations and transfers explanatory models to unfamiliar conditions. [The full product canon](docs/PRODUCT_CANON.md) remains open.

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

The program searches subsets of seven declared terms and distinguishes some alternative structures. It fits coefficients with scaled QR and ranks models with a noise-floor information criterion. Model spread is a heuristic, not calibrated probability. [Scientific details and retained counterexamples](docs/SCIENTIFIC_CORE.md) cover rank deficiency, an omitted cubic law, parameter drift and a 40-case active-versus-passive experiment.

Video reconstruction, arbitrary mechanism topology, calibrated uncertainty, physical instrument receiving, broader generalization, provider/GPU qualification and contest submission remain open. This usable increment preserves the full original goal.
