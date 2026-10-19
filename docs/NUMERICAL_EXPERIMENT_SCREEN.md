# Numerical checks for trajectory experiment proposals

An unstable integration can make two nearly identical models appear to disagree.
The trajectory planner's disagreement score can then recommend a recording for
the wrong reason. This additive screen checks the existing proposal at its stated
RK4 step and half that step before a consumer acquires a new recording.

The existing planner still owns the candidate grid, model shortlist and ranking.
The screen does not fit models, use challenge observations, acquire evidence or
substitute another candidate after a failure. This is a numerical sensitivity
check, not convergence, a calibrated uncertainty estimate or physical validation.

## Reproduce the counterexample and ordinary case

From the repository root, using Node.js 20 or newer:

```sh
node --test tests/trajectory-plan-qualification.test.mjs tests/trajectory-planner-numerical-review.test.mjs
node experiments/trajectory-numerical-qualification.mjs
```

The analytic control has two scalar damping laws, net torque `-300 * rate` and
`-301 * rate`, with inertia 1 kg·m², initial angle 0 rad and initial rate 1 rad/s.
At 0.1 seconds, their exact angular separation is approximately 0.0000110742 rad.
With a 0.01-second RK4 step, the existing planner instead reports approximately
0.0122945 rad, exceeding its 0.01-rad proposal threshold. The screen refuses that
numerically sensitive recommendation. A finer 0.0001-second planning step makes
the proposal uninformative, consistent with the analytic control.

The tests also exercise the existing small-angle synthetic fixture, a failed
finer rollout, changed model identities, status tampering, workload limits,
immutable inputs and a between-sample aliasing counterexample. The original
planner is frozen only as an attributed test fixture until its owning team's
ongoing product increment is integrated; production code does not import it.

## Qualification contract

```js
import {qualifyTrajectoryPlan} from './src/experiment-design/qualify-trajectory-plan.mjs';

const qualification = qualifyTrajectoryPlan(trainingDiscovery, existingPlan);
```

Inputs use the existing `worldlaw.discovery/v1` torque model conventions and
`worldlaw.trajectory-plan/v1` plan. Angles and disagreement are radians, rates
are radians/second, time is seconds, inertia is kg·m², and command is N·m.
Unknown-inertia angular models need a separate explicit adapter.

The plan's model IDs, coefficients and declared training-run identities must
match the current discovery. Every evaluated grid design is checked with the
same fixed model subset. The entire coarse-plus-refined workload is budgeted
before execution; an inadequate budget refuses rather than returning a partly
checked search. Original ineligible designs remain ineligible.

For each model, the underlying resolution wrapper reports RMS position change
at the same scheduled timestamps, excluding initialization. Pairwise sums of
these changes bound the change in the sampled disagreement score between those
two executions. The default criterion requires that sensitivity be at most
0.0001 rad plus 10% of the original score, and that a proposed score clear the
original threshold by more than that sensitivity. These are explicit screening
settings, not empirically calibrated physical tolerances.

| Result | Meaning for a consumer |
| --- | --- |
| `screen_passed` | The original selected proposal passed this two-step comparison. |
| `numerically_unresolved` | The selected proposal had a failed, inconsistent or materially step-sensitive comparison. |
| `no_proposal` | The original planner found no informative or feasible recommendation. |
| Typed error | The inputs are stale, malformed, unsupported or exceed the complete-work budget. |

The output preserves per-model failures, candidate results, step sizes, work
budget, fixed model IDs and limitations. It does not rewrite the original plan
or treat failed models as high-information observations.

## Consume the check in the existing experiment workflow

The optional controller adapter accepts the established controller namespace:

```js
import * as experiments from './src/trajectory/experiment-session.mjs';
import {withNumericalScreen} from './src/experiment-design/screened-controller.mjs';

const screenedExperiments = withNumericalScreen(experiments);
```

The returned namespace retains the same session operations. Planning computes
the screen; `experimentView` adds a copied `numericalQualification`, an
`acquisitionAllowed` flag and a readable outcome. An unresolved proposal has a
view-only status that disables the existing panel's acquisition button. Calling
acquisition directly also requires a passed screen, after the owning controller
has validated its session. Changes to a displayed qualification cannot authorize
acquisition.

The owning controller still owns every session and evidence transition. The
adapter never changes its opaque session objects. Already acquired recordings
remain applicable and exportable: a numerically weak choice of experiment does
not erase independently obtained evidence. Reopening recomputes any current
pending proposal's screen from replayed inputs. Qualification claims are not
written into the portable notebook as trusted facts. Historical evidence and
the original replay validation remain with the owning controller.

This adapter requires the separately developed experiment-session consumer.
Its source presence alone does not claim default product adoption; the exact
consumer composition and its receiving result must be recorded when integrated.

## Remaining scientific limits

Two steps can share an error, miss stiff dynamics or alias motion between sample
times. The screen does not establish continuous feasibility or physical safety.
The existing bounded shortlist can omit plausible alternatives; the true law can
be absent entirely. A low training residual, a passed numerical screen and a
high model-disagreement score do not guarantee improvement on a new recording.
Those conclusions require their own empirical receiving.
