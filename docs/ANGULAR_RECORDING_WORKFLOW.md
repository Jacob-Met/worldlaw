# Compare the next angular recording

**Status:** planning components and a local consumer-panel composition have been
received. This document does not claim remote-main availability,
physical acquisition, or a completed observe → acquire → refit loop. The numerical
results below were independently reproduced from local commit
`3087ee57cf9e095c20afd5cdd90b7e9fefa4b3e5`, tree
`2eaeb04e9476147f539b06e7cca580482cda7cb0`.

## What the workflow does

Starting with fitted angular observations, compare a finite set of requested
release states and recording durations. The score is sampled RMS disagreement
between the considered training-derived models, in radians. It asks where those
models predict different angular motion. It is not observed improvement,
calibrated information gain, sensor detection probability, or value per second.

1. Fit the supplied training recordings. Keep challenge recordings reserved for
   prediction comparison; they do not choose releases, durations, or models.
2. Declare initial-angle/rate bounds, candidate durations, sampling interval and
   sampled prediction envelopes. These are supplied limits, not verified physical
   feasibility. An initial target outside the training state range is identified.
3. Compare the finite-grid winner for each duration. The same fit and considered
   model ensemble are used throughout. A winner that fails numerical screening
   stays unresolved; a different runner-up is not silently substituted.
4. If an informative, screened winner exists, export its manual recording request.
   It contains requested initial angle/rate, duration and sampling interval.
   Record the actual starting state, calibration, source identity and departures
   from the request when independently collecting a new run.

The output is a **requested protocol**, not observations. No instrument or
actuator is controlled. Predicted rows must never be imported as measured evidence.
New acquisition and subsequent refitting require their own receiving evidence.

## Three separate judgments

| Result | Meaning for the user |
| --- | --- |
| `proposed` with a recording request | An original duration winner exceeds the declared disagreement threshold and passes the numerical screen; a manual protocol can be exported. |
| `uninformative` | No eligible duration clears the declared disagreement threshold. A winning grid row may still be inspectable, and its numerical screen may pass. No request is issued. |
| `numerically_unresolved` | Step sensitivity, comparison failure or the threshold margin prevents a reliable numerical decision. Do not present this as a confident below-threshold conclusion or enable a request. |
| `no_feasible_design` or a refused search | The declared numerical/envelope/budget constraints prevented a usable design. This does not establish physical impossibility. |

The screen compares solver steps. It does not prove convergence, bound the true
numerical error or validate the physics. Request availability follows the overall
decision and `recordingRequest`, never merely a non-null selected row. A successful
screen also does not erase training residual mismatch: keep the fit adequacy and
its mismatch ratio visible beside the proposed or withheld decision.

## Unknown physical scale stays unknown

The angular mode learns acceleration models. Physical inertia remains `null` and
absolute torque remains unidentified; neither a torque input nor a physical
inertia is invented for the public protocol. Angles use radians, rates rad/s, and
times seconds. Unforced scalar rotation is an experimenter-declared assumption;
missing actuator data does not verify that assumption. A comparison with training
state ranges is not a hardware authorization or a feasibility assessment.

## Exact fixed-settings examples

Reproduce the receipts with the existing scripts:

```sh
node experiments/angular-duration-design.mjs
node experiments/angular-recording-design.mjs
```

Both receipt generators make challenge access throw. Their base planner is the
explicitly frozen, unpublished test-support implementation, original SHA-256
`63d5161e39fa592d90f4b06efe8569879cf5b2b66db309d0e9acc65ec0300f10`.
Consumer integration must use the existing owner's approved planner through the
injected interface and receive that exact composition.

**Synthetic small-angle recording, physical torque scale withheld.** The fixed
2/4/8-second comparison selects **4 seconds**, initial angle **−2.2 rad** and initial
rate **−0.6 rad/s**, at **0.04-second** sampling. Disagreement is
`1.3259465961090533` rad and pairwise step sensitivity is
`0.000017599064098289284` rad. All three duration winners pass screening; 27 release
designs are evaluated per duration. Eight of 22 competitive models are considered,
with 14 omitted. The target and predicted ranges extend beyond training; this is
a controlled synthetic proposal, not a qualified physical release.

**Measured PASCO training recordings.** With unchanged weak-fit settings and
0.01 rad assumed noise, the declared initial-angle range is [−0.3, 0.3] rad and
initial-rate range [−0.2, 0.2] rad/s. Five competitive models and 15 release designs
are compared per duration. The sampled prediction envelope is [−0.6, 0.6] rad and
[−5, 5] rad/s; sampling is every 0.04 seconds.

| Duration | Winning sampled disagreement, rad | Decision |
| --- | --- | --- |
| 2 s | `0.000850333052118297` | Uninformative |
| 4 s | `0.0016441598885423836` | Uninformative |
| 8 s | `0.003345749935047749` | Uninformative |

Each winning row passes its step screen, but all scores remain below the **0.01 rad**
disagreement threshold. Overall status is `uninformative`, selected duration is
null, and no recording request is issued. The training residual remains
**`7.552353266677547` times the assumed noise**. The reused PASCO benchmark is not
fresh blind validation.

The separate hypothetical wider 4-second grid, [−1.2, 1.2] rad, also remains
uninformative at `0.008007819007945246` rad. Its winning initial angle of 1.2 rad and
predicted motion extend beyond training ranges. Those wider bounds are unverified;
this result does not justify a physical intervention. The negative outcomes are
retained without lowering the threshold or changing fit noise to obtain a proposal.

The complete duration search reserves all component budgets before evaluation.
Resource refusal yields no recommendation. These are finite-grid, finite-library
planning results with declared assumptions, omitted models and sampled-time limits;
no new recording was acquired in either example.

## Separate local consumer checkpoint

The independent receiver exercised the actual product server and angular panel at
local consumer commit `d6068a781d98ebc664896714bdd3bf707c0389b6`, with a clean source
state, Chromium 131.0.6778.204 and Node v24.19.0. That composition injects the
existing owner's planner through the public interface; it is separate from the
`3087ee5` experiment snapshot above.

All six focused browser groups passed: the fixed-noise PASCO refusal, synthetic
manual-request export, independence from altered reserved observations,
invalidation after release/duration/fit edits, notebook reopen and request-import
refusal, and keyboard/error/layout behavior. The synthetic browser course uses a
5 × 3 release grid, retains the four-second choice, and exports only requested
conditions. It does not add observed rows. PASCO remains below threshold at all
three durations, with the mismatch banner visible and export disabled.

A separate visual review inspected the measured and synthetic desktop captures
and synthetic captures at 390 and 320 pixels. The receiver measured no page
overflow; the decision, step check, source classification, unknown scale,
extrapolation and export states remain visible. These frozen captures precede
the follow-up wording corrections for unknown ranges, per-release eligibility,
manual recomputation, default bounds and the forecast's visible angle unit.
They establish neither remote publication nor receipt of a later edited source.
