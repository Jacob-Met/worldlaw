# Product acceptance and source of truth

Status: independently received runnable increment on 2026-10-19. The application completes a bounded observation → competing models → proposed experiment → measured outcome → revision → held-out comparison loop. Receiving used declared synthetic mechanisms, imported fixtures, and a real browser. Physical mechanism acquisition, unrestricted law discovery, human acceptance, category qualification, and official submission remain open.

## Full user story

Give unfamiliar mechanism observations -> propose competing models -> select informative experiment -> run it -> compare model predictions to measured outcome -> revise executable law -> demonstrate improved out-of-sample prediction.

## Integration owner
The HAMON team `288492d6ffef` root integrates this first runnable increment. The direct `worldlaw_models` worker produces the scientific modules and independently receives the root-owned application. Ownership is limited to this increment; repository-wide work remains open to complementary contributors. Coordination is recorded in [issue 1](https://github.com/Jacob-Met/worldlaw/issues/1).

## Clean build, sample inputs, actual output
With Node.js 20 or newer, run `npm start` and open `http://127.0.0.1:4193`. No npm installation is required. Run `npm run verify` for the native tests and real launched-server smoke. Optional `npm run browser` uses separately supplied Playwright and Chrome paths; see the README.

The default notebook contains 64 fitting rows and 61 fixed held-out rows from a separately implemented virtual instrument. In the received default run, one proposed observation changed the selected restoring structure from spring to gravity and reduced held-out RMSE from 1.645293629135742 to 0.0009572816573700754 N·m. This is an observed synthetic result, not a physical experiment or a general accuracy guarantee.

See [receiving evidence and limits](RECEIVING_20261019.md), [scientific details](SCIENTIFIC_CORE.md), [telemetry conversion](TRAJECTORY_ADAPTER.md), and [runnable source distribution](DISTRIBUTION.md). Exact published commit/tree and archive pins belong in the integration and distribution receipts. Source-local commits reconstructed before publication are not represented as remote history.

## Current integrated coverage

| Capability | Demonstrated increment | Remaining scope |
| --- | --- | --- |
| Evidence ingestion | Validated CSV/JSON observations with declared units, portable provenance, held-out rows, and a calibrated trajectory adapter | Real sensor/vision acquisition and independently verified physical datasets |
| Structural discovery | Selects subsets of seven declared torque terms and estimates their parameters | Discovery beyond the finite term library and broader mechanism classes |
| Executable models | Browser-consumed prediction and RK4 trajectory simulation with explicit refusal states | Fidelity against independently measured physical trajectories |
| Active experiment design | Ranks declared candidate inputs by disagreement between plausible models | Safe hardware execution, continuous design spaces, and calibrated uncertainty |
| Experiment execution | Executes the independent virtual instrument; imported sources accept supplied measured outcomes | Physical actuator/instrument integration |
| Revision | Appends evidence, refits, compares fixed held-out predictions, undoes, and replays notebooks | Transfer across real mechanisms, drift adaptation, and broader falsification |
| Interactive comparison | Actual plots, model inspection, solver-driven scene, keyboard controls, imports, downloads, and mobile layout | Human usability acceptance and richer mechanism representations |

The full-vision checkboxes below remain open. The bounded results above do not redefine those requirements as complete.

## Vision requirements

- [ ] actual_mechanism_observation_and_evidence_ingestion
- [ ] candidate_structural_and_parameter_model_discovery
- [ ] reproducible_executable_physics_models
- [ ] active_discriminating_experiment_design
- [ ] actual_experiment_or_solver_execution
- [ ] prediction_residual_based_model_revision
- [ ] interactive_model_comparison_and_visualization

## Research obligations

- [ ] inferring_structure_not_just_fitting_known_parameters
- [ ] identifiability_and_uncertainty
- [ ] closed_loop_active_discovery
- [ ] physics_transfer_and_model_generalization

## Submission
Not submitted. Complete official category requirements, demo video, and confirmed contest receipt.

## Motion Lab additive increment (2026-10-19)

Team `15cc377ad586` owns the complementary local-video measurement route and its independent tests. Open `/motion.html` from the studio header. The current route supports actual video decoding, fixed-pivot calibration, marker tracking, explicit gaps, manual correction, bounded time intervals, decoded-frame timing, a source-bound portable notebook and export into the existing studio. The original observation-to-experiment studio remains the default entry point.

The first real Chrome receiving run followed 161 frames of an encoded synthetic film, exported 106 fitting and 43 held-out observations, imported them into the studio, and exercised correction, reopening, file-digest refusal, occlusion, blank input and 320–1440 px layouts. Peer review additionally repaired stale callback/raster association and oversized-notebook mutation atomicity; focused tests and actual Chrome timing probes cover those repairs. Exact final candidate/source hashes and subsequent browser results belong in [Motion Lab receiving](MOTION_RECEIVING.md) and its publication receipt.

The original luminance mode still produces honest low-texture/ambiguous refusals on the licensed real double-pendulum sample. The optional color-aware increment below improves its first association and retains the later failure. Neither result qualifies arbitrary mechanism discovery, calibrated uncertainty or scalar-inertia physics. The full-vision requirements above remain open.

### Motion observation continuation (2026-10-24)

PR #99 adds the optional same-frame tracked pivot, independent point diagnostics and v2 notebook, with explicit refusal of unsupported moving-pivot torque derivation; see [tracked-pivot receiving](MOTION_TRACKED_PIVOT.md). The maintained patch tracker now also supports explicitly selected color features while preserving the original luminance default and rejection gates. On the unchanged source-declared real movie, color resolves the first red/yellow marker ambiguity, accepts four subsequent sampled frames, then preserves a lost measurement at0.20s instead of inventing continuation. Both tracked points consume the same selected algorithm and decoded raster.

The controlled candidate on parent `20f252133f08630d24950bd7d1afa46756f7013c` passed582 of583 native tests, with0 failures and1 inherited optional skip, plus both launched product smokes. It also passed4 actual real-video browser groups and8 tracked-pivot groups in color mode, including source-bound reopen and independent occlusion. This is actual image-association receiving, not physical ground truth. Exact math, source/media attribution, commands, observed scores, screenshots and the retained later failure are in [the tracking contract](MOTION_TRACKING.md#optional-color-aware-appearance). Published-head and merged-source receipts belong to the native PR; do not equate a locally tested candidate with deployment or submission.

## Trajectory and measured angular launch increment (2026-10-19)

The standard studio header now opens **Trajectory Challenge** on the same local server. Team `92be8b055703` owns this trajectory increment. PR 4 and PR 6 preserve the accepted Motion/studio implementation and add input-based notebooks, free-running forward predictions, numerical step sensitivity, sampled error inspection, and a distinct measured angular mode with unknown physical inertia.

The delivered measured example contains three pinned PASCO recordings with original CSV files, full Apache 2.0 license, extraction/receiving scripts and [scientific audit](../research/PHYSICAL_TELEMETRY_92be.md). A cumulative-fit failure remains visible. The experimental window estimator predicts the reused third recording at approximately 0.323 rad RMSE, while training mismatch remains 7.55 assumed noise units. A lower-ranked alternative is not silently promoted. These results do not establish a uniquely identified law or blind validation.

[Launch and receiving details](TRAJECTORY_LAUNCH_92be.md) identify the source composition, real entry point, package contents and remaining scope. The full-vision requirements above remain open.

## Screened trajectory experiment increment (2026-10-19)

The actual trajectory app now plans a whole bounded release from its training
hypotheses, checks the proposal at two solver steps, acquires an independent
synthetic recording, and waits for explicit application before learning from
that run. Portable notebooks preserve pending observations, applied history,
source identity, settings and the fixed before/after evaluation recording.

The served application passes 21 browser groups and the frozen standalone passes
23 independent offline groups. The ordinary example applies 201 new samples,
changing 322 training samples to 523 and displayed reused-recording RMSE from
about 0.5644 to 0.000442 rad. The high-noise counterexample retains its applied
failed prediction; no better-looking alternative is substituted. A real
threshold-sensitive proposal is refused, while a previously acquired recording
remains learnable after the same refusal.

These are controlled synthetic acquisitions with finite-library alternatives.
The screen is a two-step sensitivity check, not convergence, calibrated
uncertainty or physical validation. The measured PASCO example has no connected
acquisition instrument and retains its prior mismatch and unknown scale.
[The exact release record](TRAJECTORY_EXPERIMENT_RELEASE_92be.md) separates
component, browser, artifact and integration evidence. The full-vision
requirements remain open.

