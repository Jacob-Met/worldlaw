# Propose a release that separates fitted loss hypotheses

In Coupling Lab, open the motion investigation, **Can drag act across the two
coordinates?**, then **Which permitted release could separate these loss
hypotheses?**. Load original viscous observations and declare their correspondence
with the current response notebook. The instrument compares every permitted
angle pair from rest. There is no list of guessed inertia/damping values or
manually selected response family.

## What is compared

Original motion training fixes the independent-loss and symmetric-loss weak
balance fits. Original response training plus explicitly admitted revisions
fixes all executable quasi-static response families. Separate response and
motion observations are preserved in replay but never fit, select or rank a
release. Both fitted families can differ in inertia as well as damping: this
compares complete fitted hypotheses, not an isolated intervention on cross drag.

For each permitted release and each response law, the maintained RK4 solver
executes both loss fits with the same zero initial rate, duration, output clock,
step and numerical tolerances. A course's separation is the maximum sampled
Euclidean angle difference between loss hypotheses. A release's score is the
minimum of those peaks across every retained response law. This conservative
score asks for separation that persists across the offered response library.
Each response can peak at a different time; this proposes a whole observation
course, not a common optimal measurement time or continuous-time maximum.

All releases are retained. A failed, step-sensitive or unavailable response
cannot contribute a winning score. If no complete release exceeds the declared
minimum separation, there is no informative proposal. Near ties remain explicit;
a tied release below the threshold is not proposed. No loss family is selected.
The thresholds are comparison declarations, not measurement-error estimates.

## Whole-comparison work and source custody

The planner shares the solver's exact grid reservation: output intervals ×
coarse substeps ×3 for coarse/refined runs ×response laws ×2 loss hypotheses
×all permitted releases. The complete cross-product must fit the existing
120000-step ceiling before any trajectory executes. No prefix of the release
set substitutes for the whole proposal. Training quadrature retains its separate
maintained complete-work bound.

`worldlaw.viscous-release-study/v1` contains only `response`, `viscous` and
`settings`, plus its schema discriminator. Original-source download/reopen
recomputes both fits and all courses. Reopened sources remain an independent
investigation and do not overwrite the active notebooks. Copying a release into
the maintained motion experiment requires the same sources to be current,
explicit source correspondence and an explicit loss-family choice. The copied
initial state, fitted parameters and settings still require review and the
existing motion declaration before execution. Source and setting changes retire
old proposals; a delayed file read cannot restore one.

## Meaning and limits

The permitted positions come from the quasi-static notebook. Dynamic
reachability, safety, apparatus correspondence, observability and physical
validity remain unestablished. Trajectories can leave the response's observed
position range; the visible detail retains that departure. Agreement between
two step sizes is a numerical screen, not a bound on numerical error. Neither
fit parameters nor release scores are confidence regions. This source does not
create a prospective recording protocol or perform a physical acquisition.

On the authored cross-drag example with the default response notebook, the
complete nine-release, three-response, two-loss comparison reserves77760steps.
Release[-1,-1] scores0.23044117816066148rad;[0,0] scores0.002222587919864059rad.
These are software controls, not measured information gain.

## Reproduce

`node --test tests/viscous-release.test.mjs` checks independent symmetric and
antisymmetric closed forms, an unfamiliar unequal cross-inertia affine matrix
exponential, complete population/budget refusal, source/replay invariance,
thresholds/ties, zero-cross equivalence and retained failures.

Set `WORLDLAW_VISCOUS_RELEASE_RECEIVING=1` with the maintained
`scripts/coupling-browser.mjs` receiver. Its ordinary journey exercises trusted
keyboard activation, all release rows/curves, explicit family copy, actual
motion playback, real raw download, independent reopen, changed unfamiliar
permitted inputs, budget/unsupported controls, delayed-read retirement and
desktop/narrow rendering. Execution receipts belong to the native PR; these
commands alone do not assert an unrun test or deployed result.
