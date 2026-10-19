# Trajectory-level informative release planning

V3 increment after frozen v2 `f7c94fa1e788bc4dbabd348d01221e8e6727cb12`. The planner proposes a bounded synthetic experiment from training-model predictions; the application screens its numerical sensitivity before a separate instrument supplies the actual new synthetic run. Explicit application then refits the evidence and compares the revised law on the same reserved recording. It does not operate physical hardware or establish general mechanism discovery. Component, controller, browser and packaged-artifact receiving are distinct gates; exact publication and distribution pins belong in the release record.

## API

```js
import {planTrajectoryExperiment} from './src/trajectory/planner.mjs';

const plan = planTrajectoryExperiment(trainingDiscovery, {
  inertia: 0.8,
  bounds: {
    initialPosition: {min: -2.2, max: 2.2}, // rad
    initialRate: {min: -0.6, max: 0.6},    // rad/s
  },
  duration: 8,
  sampleInterval: 0.04,
  command: 0,                            // constant N·m
  positionCount: 9,
  rateCount: 3,
  maxModels: 8,
  maxStep: 0.01,
  maxTotalSteps: 250000,
  minDisagreement: 0.01,                  // heuristic rad threshold
  predictionBounds: {
    position: {min: -3.2, max: 3.2},
    rate: {min: -8, max: 8},
  },
});
```

Known positive inertia and explicit release bounds are required. Remaining values above are defaults except `predictionBounds`, which is optional. The initial-position and initial-rate grids include their endpoints; a one-point grid uses the midpoint, and a collapsed interval produces a single value. There are at most 81 distinct designs and 16 considered models. A scheduled run has 2–2001 samples, duration 0.1–30 s, and a whole number of sample intervals. The complete reserved integration budget cannot exceed two million RK4 steps. The normal UI consumer uses the tighter virtual-instrument contract.

The result schema is `worldlaw.trajectory-plan/v1`:

- `status`: `proposed`, `uninformative`, or `no_feasible_design`.
- `selected`: proposed initial position/rate, duration, sampling, inertia, command, score, acquisition request, and candidate prediction curves. It is null only when every design is ineligible. An `uninformative` result can still contain the best available design; it is not a recommendation to acquire.
- `ranked`: compact grid designs, scores, eligibility and explicit prediction refusals, sorted by decreasing score with original grid order for exact ties.
- `provenance`: training run IDs, considered model IDs, deterministic model/evidence revision fingerprints, and their interpretation.
- `diagnostics`: candidate truncation, scheduled sample/work counts, limitations, and explicit `acquisitionPerformed: false` / `predictionsAreObservations: false`.

Only the selected design has full forecast curves, each `[{time, position, rate}]`. They contain no observed future positions or residuals. The internal integrator's unused post-initial position placeholders never leave the planner. They are scheduling arguments, not sensor evidence.

`TrajectoryPlanningError` returns typed `invalid_design`, `invalid_discovery`, `missing_training_provenance`, `resource_limit`, or `numerical_failure` refusals. Invalid numerical candidate rollouts are retained per design instead of becoming infinite scores.

## Selection uses training hypotheses only

The planner accepts known-inertia `worldlaw.discovery/v1` torque discoveries. Angular-only unknown-scale models are explicitly refused in this first increment. It requires declared training-run identities; integral training runs or derivative-fit provenance supply them. It reads model coefficients, IDs, candidate order and competitive-set membership. It never reads observations, raw training samples, source/oracle metadata, challenge runs, or challenge errors. A retained test installs throwing getters on those fields to verify that boundary.

The considered ensemble is the first `maxModels` competitive candidates in the **original training candidate order**. Reordering the competitive-list display does not change this prefix. No challenge error selects candidates. This is intentionally bounded: the original small-angle fixture offers 22 competitive candidates, and the default plan considers eight. Omitted hypotheses can change the result; their count is explicit.

Fingerprints use deterministic FNV-1a64 over model contents and declared training IDs. They detect ordinary changes and associate a preview with its fitted evidence revision. They are not cryptographic authenticity claims or a hash of every raw source sample. A receiving controller should recompute a plan from its current evidence/settings rather than trusting imported cached forecasts.

## Disagreement score and numerical limits

For `M` considered models and `N` scheduled future timestamps, let `θₘ(tᵢ)` be a model prediction. The score is

\[
D=\sqrt{\frac{1}{N\binom{M}{2}}
\sum_{i=1}^{N}\sum_{a<b}\bigl(\theta_a(t_i)-\theta_b(t_i)\bigr)^2}.
\]

The initialized first sample is excluded. `D` is in **radians**. All model pairs receive equal weight; there is no posterior or calibrated information gain. A one-model ensemble has zero disagreement. A selected score must exceed `minDisagreement` to receive `proposed` status; this threshold is a caller-controlled heuristic, not statistical detection power and not a conversion of derivative-fit torque-noise units.

The planner evaluates complete candidate trajectories, not instantaneous torque differences. It uses the same forward numerical kernel as the product, with fixed-step RK4 and a declared maximum step. It does not claim a numerical error bound. Numerical error and nonsmooth rate terms can affect the ranking.

Every considered model must finish for a design to be eligible. A candidate runaway or refusal is recorded and excludes that design; it is never scored as maximal information. Optional predicted-state envelopes are checked **only at scheduled sample timestamps**. They are not continuous containment guarantees. The initial release bounds and predicted envelopes are computational/design constraints, not hardware safety authorization.

The full scheduled work is calculated before prediction. The default example reserves 976 RK4 steps per rollout × 27 designs × 8 models = **210816 steps**, within 250000. Early-failing models can consume less work, but the planner still reserves their complete allowance. An insufficient budget refuses the whole comparison before a partial result can bias selection toward early grid points.

### Retained sampling counterexample

Two harmonic candidates with frequencies `2π` and `4π`, initial position zero and rate one, complete one/two full cycles during a one-second sampling interval. Their sampled positions are close to zero and pass a ±0.01 rad sampled-position screen. The first model's exact intermediate position at 0.25 s is `1/(2π) ≈ 0.15915` rad, outside that envelope. Between-sample motion and disagreement can therefore be missed. Independent review found that the initial wording failed to qualify the sampled check; diagnostics, failure messages, documentation and a retained test now make it explicit.

## Separate acquisition contract

`selected.acquisitionRequest` contains exactly:

```js
{initialPosition, initialRate, duration, sampleInterval}
```

The receiving controller adds a **fresh seed and explicit noise setting**, then calls the separate `acquireVirtualPendulum` instrument with all retained training/challenge/acquired runs as history. The instrument never receives a learned candidate or fitted coefficients. It integrates a separately implemented fixed explicit pendulum equation and returns an entire synthetic run, with canonical identity and seed provenance. The controller appends that run only to training evidence, refits from the complete training set, and compares before/after models on the original unchanged challenge.

This instrument currently has fixed inertia 0.8 kg·m² and zero torque command. A controller must verify that the generic plan's inertia/command and schedule match that instrument's published contract before acquisition. The acquisition request intentionally omits those fields because the instrument refuses physical-parameter overrides. The planner itself does not acquire, reset observations, inspect truth coefficients, or label simulations as physical recordings.

Replay checks prevent ordinary repeated recording/noise-stream counting, including original fixture seeds. Distinct seeds are controlled pseudorandom realizations, not proof of independent physical apparatus. All results below are synthetic and concern one fixed instrument family.

## Received controller workflow

`src/trajectory/experiment-session.mjs` connects the existing challenge session, planner and independent instrument. Its functions return new opaque workflow objects with `.current` containing the actual evaluated trajectory challenge. Callers retain those objects rather than rebuilding or editing their scientific state. The model/run display selection and positive position tolerance remain editable through `.current`; they do not change fitted evidence or planning.

```js
import {createChallenge} from './src/trajectory/session.mjs';
import * as ownerExperiments from './src/trajectory/experiment-session.mjs';
import {withNumericalScreen} from './src/experiment-design/screened-controller.mjs';

// The actual application creates this wrapped namespace once.
const {
  createExperimentSession, planNextExperiment, acquireNextExperiment,
  applyNextExperiment, experimentView,
  exportExperimentSession, restoreExperimentSession,
} = withNumericalScreen(ownerExperiments);

// bundle is the supported controlled synthetic pendulum example.
let workflow = createExperimentSession(createChallenge(bundle, {
  method: 'integral', noiseSigma: 0.01, maxTerms: 4,
}));
workflow = planNextExperiment(workflow); // explicit bounded controller defaults

if (experimentView(workflow).acquisitionAllowed) {
  workflow = acquireNextExperiment(workflow, {
    seed: 10001, noiseSigma: 0.00002,
  });
  // The complete acquired run is pending; workflow.current is still unchanged.
  const pendingNotebook = exportExperimentSession(workflow);
  workflow = restoreExperimentSession(pendingNotebook); // still pending
  workflow = applyNextExperiment(workflow);              // explicit refit
}

const view = experimentView(workflow);
const portableNotebook = exportExperimentSession(workflow);
```

### Numerical screen in the actual consumer

The application uses the shared qualifier and opaque-session adapter from
[PR 7](https://github.com/Jacob-Met/worldlaw/pull/7), reviewed at
`4b95fb8557c678ecd0dad5640c23ab6b01e7677c`. The underlying controller retains
ownership of its evidence, plan, acquisition and replay transitions. The adapter
checks each retained grid design and model at the stated maximum solver step
and half that step, preserving the original model set and ranking. A failed,
inconsistent or materially sensitive proposal blocks new acquisition. It does
not convert numerical failure into evidence of an informative experiment.

The 750000-step screening allowance is separate from the controller's
250000-step planning allowance. The ordinary 27-design, eight-model example
reserves 210816 planning steps plus 594432 screening steps: 805248 total across
those stages. A small two-step difference does not establish convergence,
physical accuracy or continuous containment between observations. See
`NUMERICAL_EXPERIMENT_SCREEN.md` for the numerical contract and analytic
false-disagreement counterexample.

Already acquired evidence remains applicable and exportable even when its
recommendation fails a new screen. Reopening recomputes qualification from the
replayed inputs; imported qualification claims never authorize acquisition.
In **Release limits and observation time**, the app preserves imported planner
settings and exposes **Maximum solver step** and **Minimum model spread** for
explicit recovery. Changing those fields affects a future plan, not retained
observations. A pending recording must be applied before another plan.

The actual served application has passed 21 browser receiving groups on
Chrome 155, including a threshold-sensitive recommendation, all eight retained
predictions, refused new acquisition, explicit threshold recovery, and a real
legacy pending recording that remains learnable through export and reopen.
The threshold case has score 1.303591552902 rad, sensitivity
0.0000265715723 rad and threshold margin 0.0000115529018 rad; the screen refuses
because sensitivity exceeds that margin. These are actual model/controller
outputs, not modified learned models or mocked browser state.

The controller checks that retained runs identify the supported synthetic instrument family: declared generator/instrument provenance, fixed apparatus coefficients, inertia 0.8 kg·m², and zero commands. This capability check reads declared source metadata to decide whether an acquisition instrument is connected. Those coefficients never become planner hypotheses or fitting observations. The planner receives the training-derived discovery and reads no oracle values. Unrecognized synthetic inputs and measured angular recordings have no connected virtual acquisition instrument in this workflow.

The observable transitions are:

| Action | Fitted challenge and evidence | Retained workflow state |
|---|---|---|
| Create | Recomputes the challenge from its source bundle/settings; ignores cached model/error claims | Immutable base-input notebook, no plan or acquisition |
| Plan | Leaves `.current` unchanged | Bounded grid proposal, training revision and model provenance |
| Acquire | Leaves `.current` unchanged | Complete raw synthetic run, request, source identity and plan settings, marked pending |
| Apply | Appends the whole acquired run to training and refits all training evidence | Applied raw-run history plus before/after prediction on the same reserved recording |
| Reopen | Reconstructs base and applied revisions; a pending run stays pending | Recomputed forecasts/comparison and preserved display selection/tolerance |

An uninformative proposal cannot be acquired. Acquisition checks the generic plan's inertia, command and schedule against the fixed instrument contract. Original training runs, reserved challenge runs and retained acquired runs all participate in the replay/noise-seed guard. Omitting a seed asks the controller to choose a fresh deterministic seed; it does not change the instrument's identity semantics. The interactive controller reserves at most 250000 planning steps and supports at most four training runs. It refuses another plan while a run is pending, preventing accidental loss of acquired evidence.

The reserved recording is fixed when the workflow is created. Changing the displayed candidate or recording does not change which recording supplies the before/after comparison. External edits to fitted evidence, model terms, plan, pending run, applied history, reserved-recording identity or comparison invalidate the workflow with a typed refusal. Independent review found that the first mutation guard omitted the reserved-recording ID and comparison: a changed ID could pair a before curve from one recording with an after curve from another. The repaired guard and regression preserve a same-recording comparison.

Apply always retains the newly training-selected model and evidence, including a worse or failed reserved prediction. It does not select the lowest challenge error or revert to a preceding model. The unchanged estimators impose no coefficient-sign or passivity constraint; cancellation or unstable extrapolation can survive training selection. A failed after-prediction has no fabricated after curve. Its error, raw acquisition and previous finite prediction remain reviewable and survive export/reopen.

### Notebook replay and raw observations

The portable trajectory notebook adds an `experiment` object with schema `worldlaw.trajectory-experiment-history/v1`:

```js
{
  schema: 'worldlaw.trajectory-experiment-history/v1',
  base: inputNotebook,
  history: [{planSettings, request, run}], // applied acquisitions in order
  pending: {planSettings, request, run},  // or null; never applied by reopening
  planSettings: currentPlanOptions,      // or null
}
```

Each `run` contains the complete recorded samples and source metadata. Reopen refits the base, replans each event from its then-current training evidence, and independently reconstructs the declared instrument protocol. Requests, source metadata, timestamps, commands and other non-position fields must match exactly after normalization. Only positions receive an explicit interoperability tolerance:

`abs(recorded − regenerated) ≤ 64 × Number.EPSILON × max(1, abs(recorded), abs(regenerated))`.

Different JavaScript engines can round elementary functions differently. This narrow allowance addresses numerical replay compatibility; it is not a sensor-noise tolerance, physical calibration or numerical integration error bound. The supplied recorded positions are preserved and used in the refit. Locally regenerated positions never replace observations merely because replay agrees within tolerance. Materially changed samples, a changed acquisition request or current evidence that does not match reconstructed history are refused.

Cached discovery objects, forecast curves, residuals, scores and before/after claims are not trusted. They are recomputed from the preserved source inputs and event order. Validation establishes consistency with a declared deterministic virtual protocol; it does not authenticate a source, prove independent apparatus, or verify real physical measurement. This rule applies to this virtual-instrument history and does not authorize reconstructing arbitrary measured data from a model.

The same reserved recording is deliberately reused after each acquisition. It does not enter fitting, planning, candidate ranking or the instrument equation, but viewing its before/after errors is **exploratory reuse**, not a fresh blind validation. Changing settings in response to those errors requires the same qualification.

## Original ambiguous fixture receipt

`experiments/trajectory-planning-92be.mjs` reproduces the complete comparison. The original two small-angle training runs and reserved wide-angle challenge come from `examples/trajectory-ambiguous-92be.json`. Fitting uses the unchanged cumulative estimator, assumed displacement noise 0.01 rad, and at most four terms.

The original selected law is `rate+spring`; its unchanged wide-angle challenge RMSE is **0.564395806 rad**. Planning uses only its training-derived ensemble. The default design selects:

- initial angle **−2.2 rad**;
- initial rate **−0.6 rad/s**;
- duration **8 s**, sample interval **0.04 s**;
- predicted pairwise position disagreement **1.303591553 rad**;
- 201 samples acquired by the independent virtual instrument.

Three separately seeded acquisitions were compared at equal duration/sampling/noise. The original challenge is identical before and after each refit.

| Additional run | Refitted structure | Original challenge RMSE |
|---|---|---:|
| Planned −2.2 rad / −0.6 rad/s | rate + gravity | **0.000419731 rad** |
| Passive small release 0.06 rad / 0 rad/s | rate + spring | **0.564024899 rad** |
| Fixed wide release 1.2 rad / 0 rad/s | rate + gravity | **0.000597341 rad** |

The planned acquisition resolves the small-angle ambiguity in this controlled receipt. A manually chosen wide release also does so. This is evidence for trajectory-level experimental discrimination within the declared library, not unique-law discovery or a globally optimal intervention.

## Fresh-seed comparison and retained failures

Sixteen additional cases use four fresh seed bases (20003, 30011, 40013, 50021) and four position-noise levels. Each case independently generates the two small training runs. Planning completes **before the reserved challenge is generated**. The challenge always uses initial angle 1.9 rad and rate zero; each strategy then acquires a separately seeded whole run. The challenge never enters planning or fitting.

The four seed realizations are reused across noise levels for a controlled amplitude sweep. These are 16 synthetic cases, not 16 statistically independent physical experiments.

| Noise σ, rad | Proposed / cases | Finite planned refits | Median planned challenge RMSE | Median passive-small RMSE | Median fixed-wide RMSE |
|---:|---:|---:|---:|---:|---:|
| 0.00002 | 4/4 | 4/4 | 0.000493815 | 0.554452256 | 0.000689233 |
| 0.0005 | 4/4 | 4/4 | 0.000781325 | 0.569305183 | 0.000995866 |
| 0.002 | 4/4 | 4/4 | 0.002223432 | 0.604230958 | 0.002696172 |
| 0.01 | 2/4 | 1/2 | 0.015365541* | 0.620595124 | 0.010934499 |

The starred high-noise planned value is its sole finite refit, not a four-case median comparable to the other strategies. Two cases receive no informative plan and acquire nothing; one proposed acquisition later gives a runaway selected law. Across all 16 scheduled cases, planning beats the passive-small result in 13 and the fixed-wide result in 10. Refused/no-acquisition cases are not counted as wins.

Concrete retained failure: at σ=0.01 and seed base 50021, the planner proposes angle zero with rate −0.6 rad/s. Adding the new run selects `rate+spring+gravity+bias`, whose original reserved prediction runs away. The fixed 1.2-rad release instead yields a finite **0.018997802 rad** error. At seed base 40013, both paths are finite but planning gives **0.015365541 rad** versus fixed-wide **0.011799273 rad**. More disagreement does not guarantee a better noisy parameter estimate.

Further retained limits:

- Restricting releases to ±0.08 rad and ±0.03 rad/s gives a best score **0.007154005 rad**, below the default threshold. It remains `uninformative`; no acquisition is silently forced.
- Considering the first 16 competitive candidates brings in ill-conditioned cancelling spring/gravity laws. Their failures eliminate most designs; the surviving near-zero release has only `1.20e−9` rad spread and is `uninformative`. Ensemble truncation materially affects actionable proposals.
- A single or identical wrong model has zero disagreement even when every forecast is physically wrong. Consensus cannot reveal omitted truths.
- The sampling-alias example above can hide both disagreement and envelope excursions.

No parameters or defaults were tuned against the 16-case challenge results. The high-noise failures are retained rather than replacing the training-selected law with a better-performing alternative after observing challenge errors.

## Reproduce and receiving status

```sh
node tests/trajectory-planner-92be.test.mjs
node experiments/trajectory-planning-92be.mjs
node tests/trajectory-virtual-experiment-92be.test.mjs
node tests/trajectory-experiment-session-review-92be.test.mjs
```

The current planner suite passes **11/11**. It covers the actual ambiguous fixture; exact analytic disagreement units; prohibited-evidence getters; immutable/deterministic behavior; stable candidate ordering and ties; finite-model/envelope refusals; whole-grid budget refusal; the sampled-bound counterexample; invalid physical/schema inputs; and the complete acquisition/refit/fixed-challenge comparison. Independent peer review received the initial nine tests, checked numerical/refusal/provenance behavior, and identified the sampled-envelope wording defect. The subsequent suite retains that regression and the full loop. The separate virtual instrument was independently read and received **10/10**, including exact reproduction of all three original unforced fixture recordings, replay/noise identities, fixed physics and bounded work.

Independent controller receiving passes **11/11** after the replay-portability repair. It exercises the actual `create → plan → acquire → apply → export → reopen` APIs, not a mocked transition. The suite verifies unchanged fitted state until apply; instrument-scale/command compatibility; original training/challenge seed protection; future-challenge poisoning isolation; pending raw evidence and selection/tolerance persistence; fabricated-cache recomputation; applied raw-run history and bounded work; edited-history refusal; stale-state refusal; the reserved-recording/comparison regression; and retained failed revision after reopen. Its two-acquisition history test explicitly uses a training ambiguity margin of 100 and a zero disagreement threshold to exercise the protocol; those settings are not proposed quality improvements. With the normal margin, the successful first acquisition leaves one competitive model and further acquisition is correctly uninformative.

The retained noisy failure is also received through the complete controller: seed base 50021 starts with `coulomb+spring` and finite RMSE **1.232186531 rad** at the controller's 0.01-second maximum solver step. Acquiring seed 50024 selects `rate+spring+gravity+bias`; its reserved prediction fails with `runaway_state`. The applied history keeps that run, the selected failure has RMSE `null` and no predicted curve, and reopening recomputes the same failure. This number differs slightly from the research experiment's 0.005-second-step result because the declared numerical settings differ.

The controller's end-to-end evidence is received at the API level, and the
screened consumer has its separate served-browser receipt described above.
Source packaging, offline receiving, publication and integration with other
WORLDLAW surfaces require exact release receipts; this document does not infer
them from component tests or claim completion of the full unknown-mechanism
product.
