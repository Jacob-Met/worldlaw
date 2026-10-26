# WORLDLAW

**An experimental workbench for learning executable torque models and testing what changes your explanation.**

Import observations, compare competing law structures, choose a discriminating input, obtain a new measurement, and watch the model and its held-out predictions change. The browser workbench includes a reproducible virtual instrument, a dynamics solver, residual plots and a portable notebook that replays its evidence history.

Current scientific scope: **finite-library scalar torque discovery**. The default instrument and supplied examples are synthetic. The larger goal remains an autonomous physical scientist that discovers mechanism structure from real observations and transfers explanatory models to unfamiliar conditions. [The full product canon](docs/PRODUCT_CANON.md) remains open.

## Open-ended research direction

[UNKNOWN LAB exploration](docs/UNKNOWN_LAB_EXPLORATION.md) develops the existing ambition toward discovering useful representations, questions, measurements and experiments. It is a seed for further invention, not a fixed endpoint or a claim that the current finite-library workbench already provides those capabilities.

The UNKNOWN LAB probe chooser also compares [two-state acquisition courses](docs/PROBE_COURSES.md): one coefficient per law must explain both proposed readouts, so a course can discriminate hypotheses even when each state alone has overlapping predictions. Requests preserve training and declared assumptions; they do not acquire observations.

The same probe instrument can explicitly compare [declared saturated-rate alternatives](docs/PROBE_SATURATION.md). It retains the original four-law failure, the entire offered scale grid and separate future-readout challenges; choosing a larger family does not establish a physical mechanism.

## Run locally

With Node.js 20 or newer, from this directory:

```sh
npm start
```

Open **http://127.0.0.1:4193**. No package installation, cloud account, model download or API key is needed. The server binds to loopback and serves maintained application assets. Observations and model computation stay in your browser. Stop the server with Ctrl+C.

## Compare coupled responses

Open **Coupling Lab** from the Studio header or visit `/coupling.html`. Compare
independent, reciprocal and directional two-coordinate torque responses; choose
an explicitly permitted discriminating input, add a separate response, inspect
the frozen prediction error and replay the resulting notebook. The default
instrument is synthetic and retains its first-probe loss before a second probe
changes the selected family. Imported measurements stay local and preserve
supplied units, source and quasi-static assumptions. [The contract, controls and
receiving](docs/COUPLING_LAB.md) describe the numerical scope and physical limits.

### Execute conditional coupled motion

In Coupling Lab, **Let the laws move** compares the current fitted responses as
two-coordinate trajectories under explicitly declared constant diagonal inertias,
viscous damping and initial conditions. Inspect the coupled path or aligned angle
traces, scrub computed time, retain numerical failures and observed-range
extrapolation, and save/reopen the evidence plus dynamic inputs. Quasi-static
measurements alone do not establish these dynamic assumptions. See
[the execution contract and receiving](docs/COUPLED_DYNAMICS.md).

Choose **Symmetric inertia matrix** to explore a declared cross-coordinate
inertial coupling with the same fitted torque evidence. The actual motion,
mode coordinates and versioned input-only notebook retain the full matrix;
[the declaration and numerical contract](docs/COUPLED_INERTIA.md) explains
what this conditional experiment establishes.

After comparing an observed closed loop in Coupling Lab, open **Does circulation
survive coordinate measurement uncertainty?** to inspect signed polygon work
under explicitly declared paired angular reading bounds. The inspector reuses
the maintained exact scalar endpoint solver, preserves original readings and
shows simultaneous extremal witnesses. Save/reopen retains inputs, not cached
conclusions. This is separate from the nominal fitted-law comparison; see
[the coordinate-box contract and limits](docs/COUPLED_COORDINATE_BOXES.md).

## Measure recorded motion

Open **Motion Lab** from the studio header, or visit **http://127.0.0.1:4193/motion.html**. Load a local WebM/MP4 mechanism video, mark a fixed pivot and a stable visible marker, then track a selected time interval. The pixel view, angular plot and measurement ledger show what was accepted and where tracking stopped. Correct the marker to resume; missing frames remain visible and split the evidence into separate segments.

The notebook preserves the original video's SHA-256, decoded image coordinates, browser-reported frame timestamps, calibration, match diagnostics and corrections. Saving and reopening the notebook does not embed the video: reconnect the matching original file to inspect its frames. An optional synthetic instrument exercises the same pixel tracker and is labeled synthetic throughout.

**Export angles** requires an explicit segment selection when a track contains gaps. **Studio observations** additionally requires your known constant inertia and applied torque declaration; the video does not establish either. The export uses the existing angular telemetry adapter and its disjoint derivative-window split. Import that file into the discovery studio to compare executable torque models. Coupled mechanisms such as the real double-pendulum verification video do not automatically satisfy the scalar-inertia assumption.

**Marker-first acquisition:** select and track one visible marker before supplying a pivot. **Infer a fixed reference from the marker path** compares the original continuous observations with a circle and a line, overlays a supported candidate on the source image, and applies it only after explicit acceptance. The fitted reference and its source observations survive notebook and angular export. [Method, receiving and limits](docs/MOTION_PATH_REFERENCE.md) explain why a circular image path is still a conditional reference.

Motion Lab currently assumes a fixed camera, a declared fixed pivot, approximately planar motion and a marker whose appearance stays stable. A high image-match score is not calibrated location confidence. Read [Motion Lab receiving and limitations](docs/MOTION_RECEIVING.md) and [the tracking contract](docs/MOTION_TRACKING.md) before interpreting video-derived physics.

## Try the complete experiment

1. The virtual notebook starts with 64 observations at small angles. Linear spring and sinusoidal gravity are competing explanations.
2. Select **Use suggested state**, then **Run virtual experiment**. A separate virtual instrument returns a fresh torque observation.
3. The selected restoring structure changes to sinusoidal gravity. The fixed 61-condition held-out error drops from approximately **1.6453 to 0.0009573 N·m** for the declared seed. These are synthetic instrument results.
4. Inspect another hypothesis to compare its fit and residuals. Its heading identifies inspection; planning continues to use the ranked competitive ensemble.
5. Change initial angle or inertia and select **Run dynamics** to execute the learned model. The schematic and trajectory are predictions. Invalid dynamics remove the prediction instead of displaying a substitute pose.
6. **Save session** downloads observations, supplied provenance, assumptions and revision events. Reload restores the browser notebook. **Open session** recomputes a downloaded notebook; **Undo** reverses its last revision.

### Automatic numerical refinement

The Studio now refines internal RK4 steps for smooth learned laws, so fast
responses no longer depend on manually choosing an integration step. The
existing output grid and physical assumptions remain visible. Discontinuous
sign-rate laws retain their labelled fixed-step interpretation; exhausted
numerical work removes the prediction. Read [the method, analytic controls
and display limits](docs/STUDIO_DYNAMICS.md).

### Investigate a different angular period

In the Studio residual view, **Discover a different angular period** fits a bounded training-only frequency profile, retaining nonperiodic and unit-frequency alternatives. Inspect original-coordinate response, separate receiving errors and conditional motion, then save/reopen the original inputs. [Method, authored controls and limits](docs/ANGULAR_FREQUENCY.md) distinguish a useful executable response from identified gearing or sensor calibration.

## Bring observations

Select **Import observations** and choose UTF-8 CSV or JSON. Supply 8–4,096 fitting rows, with each value bounded to magnitude 10⁶:

| Field | Meaning | Units |
|---|---|---|
| `command` | Applied torque command | N·m |
| `position` | Joint angle, consistent sign convention | rad |
| `rate` | Angular velocity | rad/s |
| `jointTorque` | Observed net joint torque | N·m |

CSV starts with `command,position,rate,jointTorque`. Extra metadata columns are allowed but are not retained as observation fields. JSON may contain an array, or a `worldlaw.observations/v1` object with `observations`, optional `heldOut`, and a `source` label and metadata. All supplied unit declarations must agree. Files are limited to 2 MB.

Try [the independent synthetic quadratic-drag fixture](examples/synthetic-quadratic-drag.json): 64 fitting and 31 held-out rows select actuation, linear spring and quadratic drag. Imported observations create an instrument notebook: virtual measurement generation is disabled and controls accept a measured torque result from your own instrument. Without an explicit offered course, proposed states remain within the baseline's input ranges. A versioned JSON source can instead declare input-only states beyond that range; those extensions remain visible. The application does not control hardware.

Held-out rows are excluded from fitting, ranking and acquisition. Source hashes and derivation assumptions are retained as supplied evidence, without independent authentication. CSV export contains numeric rows only; keep the notebook when provenance and history matter. Failed imports preserve the current valid notebook. Late file reads cannot replace a newer notebook.

### Compare a different reading-loss assumption

In the Discovery Studio's **Fitting assumptions**, explicitly choose **Soft-L1**
and a transition scale in N·m to reduce the influence of large torque residuals.
Refitting compares the same finite feature library, retains the original
least-squares history, and executes the resulting law through the existing
dynamics and experiment path. Every reading, raw residual and training error
remains visible; reduced influence does not establish a bad sensor or a correct
physical law. Downloaded v3 notebooks replay the actual loss and scale choices.

Try [the authored reading-spike control](examples/synthetic-reading-spikes.json).
See [the numerical contract, controls and retained failures](docs/SOFT_L1_DISCOVERY.md),
including coordinate-leverage failures and complete-search refusal when the
optimizer cannot finish. The original least-squares choice remains the default.

### Angular telemetry

The optional Node CLI derives torque from time/angle telemetry with explicitly declared inertia:

```sh
node scripts/derive-telemetry.mjs --input examples/synthetic-angular-telemetry.json --inertia 0.8 --position-sigma 0.0001 > derived-observations.json
```

Import that output into the same workbench. Read [the trajectory adapter contract](docs/TRAJECTORY_ADAPTER.md): numerical differentiation amplifies noise and introduces smoothing bias. Excellent error on derived data does not establish exact physical-law recovery.

### Restore missing input excitation

When current observations never vary an input independently, fitted models can all agree while missing its effect. In **Ask a better question → Plan by**, choose **Missing input excitation** to inspect whether any offered state adds a numerical input direction. The finite library stays fixed; no future torque or held-out reading is used. Use the suggested coordinates, then record a separately obtained instrument outcome through the existing notebook.

A `worldlaw.observations/v2` source supplies up to128 unique `offeredInputs`, each containing only `command`, `position`, and `rate`. The complete course and original precision survive save/reopen. Try [the authored unexcited-command example](examples/scalar-unexcited-command.json) and read [the method, source contract and negative controls](docs/INPUT_EXCITATION.md). Numerical rank does not establish an adequate physical law.


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

### Experimental cubic restoring laws

In Trajectory Challenge → Investigate the angle reference, explicitly enable **Offer cubic restoring law θ³** to test a larger finite library. The maintained fitter and executable solver learn its coefficient from training motion; a purple trajectory preserves the matched training winner without cubic on each separate recording. Existing default libraries remain unchanged. Save/reopen preserves the offered terms and recomputes both comparisons. Small-motion data may not distinguish linear, sinusoidal and cubic restoring behavior, and a shifted cubic depends on the chosen origin. See [scientific evidence and receiving limits](docs/CUBIC_RESTORING.md).


## Stiffness Lab — investigate a changing response

Open **Stiffness Lab** from the studio header or visit `/stiffness.html`.
Compare a global torque slope with one continuous change at a declared grid
of possible angles, keeping the same explicit command/rate/offset terms.
The complete profile retains ambiguous and unsupported knots. Frozen
training explanations face separately supplied check observations; no check
values enter fitting or selection. Save/reopen preserves source inputs and
search settings.

The authored examples include a located change, a globally linear response,
a smooth omitted-law counterexample and a change outside the observed range.
Conditional response curves and a torque-gauge inspection are computed from
the actual fitted models. A fitted kink does not establish contact topology,
physical stiffness or causation. See [the mechanism, evidence and receiving
limits](docs/STIFFNESS_LAB.md).

The same lab can now run a sequential experiment: declare finite input states,
inspect the training-model forecast spread, freeze a request, receive a separately
labelled reading, score its earlier forecasts and refit. The complete input-only
experiment saves and reopens its original training, acquired observations and
pending request. Separate checks remain excluded from planning; input declarations
stay fixed after the first acquisition. Explicit authored courses demonstrate
both narrowing ambiguity and an omitted smooth response. See [sequential stiffness
experiments](docs/STIFFNESS_EXPERIMENTS.md).

### Explicit smooth-family revision

When the original global and one-hinge alternatives fail the observed response, STIFFNESS LAB can add one explicitly declared linear-plus-cubic alternative about a fixed origin. It preserves the original failure and earlier frozen errors, applies the revision to subsequent forecasts, and keeps separate checks outside fitting. See [explicit family revision](docs/STIFFNESS_REVISION.md) for the recorded boundary, saved replay, finite-model limits and receiving evidence.


```sh
node --test tests/stiffness.test.mjs
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-stiffness-receipts node scripts/stiffness-browser.mjs
```


### Change angles between grid points

In Stiffness Lab, **Search between grid points** profiles one-hinge responses
within the observed training range. Inspect the computed torque curve beside
the declared-grid winner, retain separate-check failures, and explicitly add a
useful angle to the editable declaration. The existing fit/save/reopen path
then carries that angle and the original evidence. This optional search reuses
the maintained fitter and leaves the current experiment unchanged during
inspection. It retains rank/support/work refusals and does not claim a certified
continuous optimum or physical cause. See [the mechanism and actual receiving
course](docs/STIFFNESS_KNOT_PROFILE.md).

## Cycle Work

Open `/cycle-work.html` from the workbench to inspect signed polygonal work from ordered torque–angle return paths. Explicit exact-angle assumptions, torque-error bounds and an integration allowance are retained in input-only export/reopen. The nonlinear conservative control demonstrates a quadrature artifact: nonzero polygonal work alone does not identify continuous-path work or dissipation. See [Cycle Work](docs/CYCLE_WORK.md). Run `node --test tests/cycle-work.test.mjs` and `node scripts/cycle-work-browser.mjs` (the browser command uses the existing `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE_PATH` conventions).

## Held-out prediction sensitivity

The scalar model inspector can now compare every retained held-out torque reading with the prediction interval induced by shared bounded training-reading errors. It keeps the original inputs and inspected structure fixed, exposes each query's training-offset witness and contrast with an independent coefficient box, and marks numerical boundaries and coordinate extrapolation. Source notebooks reopen through the existing workflow; both error radii are explicitly redeclared. These per-row ranges do not establish joint feasibility, confidence or physical validity. See [the model and controls](docs/PREDICTION_SENSITIVITY.md) and [executed receiving](docs/receipts/prediction-sensitivity-195c0e2a/verification.json).

## Shared-training receiving contrasts

The held-out prediction sensitivity inspector also receives every unordered pair under one shared training-reading perturbation. Marginal ranges remain visible. Inspect signed pair ranges and witnesses, including contradictions hidden by individually overlapping intervals; passing all pairs does not establish joint feasibility. The complete 128-row limit includes all 8128 pairs. Numerical and source qualifications, examples and receiving commands are in [the contrast model](docs/PREDICTION_CONTRAST.md).

### Shared training-reading evidence

The Studio can separately search for one bounded training-reading perturbation that receives the complete held-out course, or a checked weighted separator for the computed linear envelope. It retains all source rows, original error radii, complete witness vectors and raw-source replay. Budget exhaustion remains unresolved. See [the scientific and replay contract](docs/SHARED_TRAINING.md).

### Challenge the additive law library

The scalar Studio now inspects four-corner contrasts from its original observation
rows. Choose two varied inputs, an exactly fixed third coordinate, and an explicit
absolute torque-reading bound. Compare every complete matched rectangle and
inspect its original readings. A contrast excluding zero challenges the additive
assumption shared by the default additive scalar library; incompatible repeated readings
remain a separate outcome. No new physical cause, interaction model or observation
is asserted. See [the mechanism, authored controls and receiving](docs/ADDITIVE_SEPARABILITY.md).
## Receive a closed two-coordinate path

In Coupling Lab, **Take the response around a closed path** compares supplied paired-angle/torque readings with every fitted affine law using signed polygonal work. Inspect the numbered loop, shared reading-error bounds, model disagreements and coordinate extrapolation. Input-only save/reopen retains the original training and path without refitting on receiving evidence. The nonlinear conservative control exposes a quadrature artifact; nonzero polygonal work does not prove dissipation. See [the circulation contract](docs/COUPLED_CIRCULATION.md).

## Revise an additive scalar explanation

In the Studio, explicitly admit **command × position (uθ)** beside the current
model, then refit the original observations through the maintained discovery
engine. The initial fit, separate held-out evidence and revision history
remain visible. Nonzero fixed-command dynamics makes the revised executable law
inspectable. Default additive notebooks remain v1; histories using this option
export v2 so older readers refuse rather than silently lose the model choice.
See [the authored course, compatibility and receiving](docs/SCALAR_INTERACTION.md).
### Inspect what integrated work hides

After a coupled-loop comparison, **Inspect responses hidden by integrated work** confronts every individual torque reading with the retained fixed models. It preserves explicit contradictions that cancel in the signed integral, identifies symmetric affine fields that no closed-work probe can separate, and shows the maintained training-only point proposal as a different observable. It reuses the same source inputs without refitting or treating the two summaries as independent evidence. See [the observable comparison](docs/COUPLING_OBSERVABLES.md).

### Useful coordinates for conditional coupled motion

After a Coupling Lab motion comparison, **Find coordinates for this motion** derives inertia-scaled orthogonal directions for each symmetric fitted affine law and displays the retained trajectory in those coordinates. The original laws, evidence and solver remain unchanged. Damping cross terms, affine bias, asymmetric-model refusals and repeated-axis ambiguity remain visible. The stated frequencies are conditional and undamped; the feature does not identify inertia, bodies or topology from quasi-static evidence. See [the equations and receiving scope](docs/COUPLED_MODES.md).

### Joint response regions from retained training

A completed coupled circulation comparison now offers **Inspect the joint response region**. Declare a training torque-reading perturbation radius and inspect whether each supplied two-torque reading lies outside the computed shared-error region, even when both separate sensitivity bands overlap. The torque-plane plot retains marginal bands, the supplied reading rectangle and an extremal source-reading witness. Save/reopen retains original training, loop readings and the setting only. This is fixed-coordinate, fixed-structure least-squares sensitivity; agreement for every row does not establish a shared perturbation explaining the whole course. See [the geometry, source custody and limits](docs/COUPLED_RESPONSE_REGIONS.md).

The coupled retrospective receiver can inspect [shared training changes across selected receiving rows](docs/COUPLED_RESPONSE_CONTRASTS.md), retaining original source rows and a necessary-condition contrast rather than asserting whole-course feasibility.

[Complete coupled-course shared-training evidence](docs/COUPLED_SHARED_COURSE.md) searches for one source-checked common offset or a separating output combination using the maintained bounded search and independent refit checks. Exhausted search remains unresolved.

### Inspect encoder calibration dependence

After comparing a closed loop in Coupling Lab, open **Does the encoder calibration act together or separately?** Compare explicitly declared shared versus independent positive gain hypotheses against the same original readings, inspect attaining mathematical witnesses, and save/reopen source-only calibration inputs. Constant per-coordinate offsets cancel; this does not infer sensor calibration or refit physical laws. See [the calibration contract](docs/COUPLED_CALIBRATION.md).

### Inspect cross-channel encoder calibration

After comparing a loop in Coupling Lab, open **Could the encoder channels mix the two coordinates?** Inspect an explicitly declared orientation-preserving matrix box while preserving each original torque-reading error across its matrix contributions. Retain attaining matrix/reading witnesses and source-only replay. See [the matrix calibration contract](docs/COUPLED_MATRIX_CALIBRATION.md).

## Constructive fitting-support ambiguity

Coupling Lab can show distinct admitted affine response hypotheses with exactly identical predictions at every fitting coordinate when an offered family is refused for insufficient excitation. Explicit illustrative coefficient amplitude, materialized-coefficient checks, and original permitted-coordinate contrasts preserve the distinction between an exhibited null direction and global identification. See [the exact support contract](COUPLING_EXCITATION_WITNESSES.md).

## Position-only compatibility of original coupled readings

After a circulation comparison, inspect whether one single-valued paired-position response can fit every original torque-reading box under explicit coordinate-sensitivity limits. Exact contradictory pairs distinguish repeated-state failures from slope-conditional failures; compatible cases construct a response through all point boxes. Polygon work and between-reading interpolation remain separate. See [the point-response contract](COUPLED_POINT_RESPONSE.md).

### Investigate continuous saturation scales

The probe instrument can [profile a declared continuous saturation-scale interval](docs/CONTINUOUS_SATURATION.md) after finite offered scales fail. It distinguishes covered inner support, unresolved outer support, excluded regions and unevaluated inputs, then freezes a training witness before separate challenges. Source-only replay preserves the original finite-family result and declared numerical work limits.


### Compare separate Motion recordings as executable angular laws

Trajectory Challenge can now receive two saved Motion Lab notebooks directly. Choose continuous courses and explicitly declare starting rates, common angle coordinates and unforced dynamics. The existing angular fitter and forward solver retain source identities and compare a separate recording without invented physical inertia or torque. See [Motion-to-trajectory intake](docs/MOTION_TRAJECTORY_INTAKE.md) for the actual workflow, source/calibration limits and authored positive/failed-transfer receiving.


### Interpret planar motion through a declared camera calibration

Motion Lab can now map both marker and pivot through four source-bound metric-plane references before deriving angles. Numbered references stay on the original raster, and a paired trace compares the plane interpretation with the original image angles. Raw observations, gaps and revisions survive save/reopen and the separate-recording Trajectory workflow. The declaration remains conditional: four fitted points do not verify physical geometry, lens distortion or out-of-plane motion. See [the workflow, maintained homography reuse, authored movie results and limits](docs/MOTION_METRIC_PLANE.md).

If the pivot is hidden, track the visible marker first and stage the plane declaration. **Compare the rectified path** proposes a conditional fixed reference from one continuous original course; explicit acceptance carries it into the existing angular workflow. The projected path stays on the original video, and the notebook retains the observations used to fit it. See [hidden-reference receiving and its limits](docs/MOTION_PLANE_REFERENCE.md), including a wrong calibration with a small residual and an extra law term selected from the authored-video control.

### Compare cross-coordinate viscous loss

Coupling Lab can now infer a symmetric cross-loss coefficient beside its original diagonal inertia balance, then confront both frozen explanations with a separate motion. Original/coarser source rows, failed hypotheses and input-only save/reopen remain inspectable. Open the motion-identification instrument and choose **Can drag act across the two coordinates?** See [the equations, workflow and receiving evidence](docs/COUPLED_VISCOUS_LOSS.md).

An admitted symmetric fit can now be copied into **Let the laws move** after explicit source pairing. The existing solver executes the full loss matrix, the mode view retains its transformed coupling, and version-3 motion downloads reopen from source inputs. See [inferred-loss motion, compatibility and numerical receiving](docs/COUPLED_VISCOUS_MOTION.md).
