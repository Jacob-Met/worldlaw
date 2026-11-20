# Continuous bounded input and minimum readings

The hidden-state lab at `/active.html` can design an input inside independently
declared closed intervals for **two** linear dynamical hypotheses. Choose
**Design a bounded input for two coupling laws** in the source inspector, or
import a `worldlaw.active-linear-control-box/v1` source. The actual chosen
values, intervals and input ticks appear beside the experiment. Freeze the
plan, execute the declared course independently, and supply a separate reading
set. No physical sensor or actuator is attached to this source.

The existing fixed-course and finite intervention-menu schemas remain valid.
Historical plans and readouts retain their original exact contents, work
counts and replay behavior. All three routes use the same rational circuit
enumerator and the same byte-sealed browser/CLI notebook record.

## Source and objective

Each law declares `x[t+1] = A x[t] + B u[t]`, `y[t] = C x[t]` and its own
arbitrary unknown initial state. There is one scalar sensor and a common menu
of optional observation ticks. A new source supplies `controlBounds`, with
one `{min: [...], max: [...]}` object per input tick. Each coordinate is an
independent closed interval. Equal endpoints represent a fixed input.

The remaining fields match the fixed-course model: `source`, `hypotheses`,
`offeredTicks`, `maxReadings`, `costByTick`, `noiseBound` and `workLimit`.
Numbers must be safe integers or exact integer/rational strings. The same
state, horizon, channel and coefficient limits apply. Unknown fields,
competing `controls` or `interventions` declarations, reversed intervals,
and families with more than two hypotheses are refused.
Each hypothesis accepts only `id`, `A`, `B` and `C`; an additional initial-state
constraint cannot silently disappear. Reading-cost keys must be canonical
integer tick strings, so a key such as `"01"` is refused rather than ignored.

The objective is, in order:

1. Minimum number of readings guaranteeing separation for every independent
   initial state and every reading error within the declared bound.
2. Minimum sum of declared positive reading costs.
3. Numeric lexicographic tick order.
4. Greatest attainable separation distance on that selected support.

This objective does not optimize actuator energy, risk or input cost. For an
input coordinate with zero coefficient in the selected invariant, the
implementation chooses zero when permitted and otherwise the endpoint
nearest zero. The chosen input is deterministic and remains sealed into the
plan before any readout is supplied.

## Exact reduction

For a reading schedule, let `F` contain both laws' unknown-state observation
columns and let `D` contain their known-input response difference. Its affine
distance is

\[
d(u)=\min_z\|Fz+Du\|_\infty
=\max_{F^T w=0,\;\|w\|_1\leq1} w^T Du.
\]

Finite linear-program duality supplies the equality. The nonzero extreme
points of the feasible dual set are signed, normalized minimal-support
left-nullspace circuits. Both maximizations commute, so maximizing `d(u)`
over a box requires maximizing each circuit's linear functional over that
box. Each coordinate is chosen at its upper or lower endpoint according to
the coefficient's sign. Both signs of each circuit are required: with the
one-dimensional interval `[-3,-1]`, maximizing only the positive orientation
would choose `-1`, although `-3` gives the greatest absolute separation.

A schedule separates if and only if it contains a circuit whose best box
margin strictly exceeds `2 * noiseBound`. That circuit's support is itself
an allowed schedule. Therefore a minimum-cardinality schedule equals a
qualifying circuit support; an additional traversal of all reading subsets
is unnecessary. Reading costs and numeric tick order break ties. On a
minimal circuit support the annihilator is one-dimensional, so its chosen
box input also maximizes the selected schedule's distance.

The proof depends on optional readings that do not alter the dynamics, a
common input box independent of the reading schedule, and unconstrained
independent latent starting states. It does not establish a solution for
multi-hypothesis max-min discrimination, coupled actuator constraints,
mandatory reading patterns, bounded/coupled latent states or adaptive
closed-loop experiments. A zero-dimensional annihilator gives distance
zero. No full-column-rank assumption is made.

## Analytic anchors and noise

In the included coupled-position example, the two gains are 1 and 2. Inputs
at ticks 0, 1 and 2 may range from -1 to 1; tick 3 is fixed at zero. With
reading error at most `1/4`, the earliest minimum-cost robust schedule is
`[0,1,4]` and the designed course is `[1,1,1,0]`. The weights `[3,-4,1]`
remove both arbitrary initial states. The response gap is 6, the weight
norm is 8, and the exact affine distance is `3/4`, greater than the required
`1/2`. The full menu can attain distance 1 with a different support.

An independently calculated start `p0=3, v0=-2` yields selected readings
`[3,1,1]` for gain 1 and `[3,-1,-1]` for gain 2. These are synthetic analytic
controls, not evidence that either model describes a physical mechanism.
Readout evaluation permits a different unknown start for each law and can
leave one, several or no models consistent.

Closed error tubes that only touch overlap. Equality at `2 * noiseBound`
therefore never certifies a plan. An exhausted work limit returns
`search_inconclusive`, no chosen input and no optimal schedule. Partial
witnesses remain attainable lower bounds with explicitly inexact maxima.

## Reproduce and independently receive

```sh
npm run active:family -- --input examples/active-control-box-coupled-kinematics.json --output /path/to/new-plan.json
npm run active:family -- --input examples/active-control-box-coupled-kinematics.json --replay /path/to/new-plan.json --readings /path/to/readings.json
npm run active:family -- --notebook /path/to/exported-notebook.json
```

The readout schema and source/plan digest requirements are unchanged. The
frozen selected input is replayed before checking any values. Readouts may
contain a nonempty subset of the planned ticks, but cannot rename an
intervention or change the designed course. Notebook reopening recomputes
the original input bytes, exact plan, separate reading bytes and decisions.

The preregistered protocol is
`tests/fixtures/active-control-box-protocol.json`. Its 64 dynamics cases were
fixed before production edits. `scripts/active-control-box-receiving.py`
independently compiles the recurrences with rational arithmetic, enumerates
every box corner and every candidate reading subset, and solves primal
Chebyshev LPs using pinned NumPy/SciPy. It checks the full-menu optimum,
minimum schedule, exact selected-input feasibility and separate readout
decisions with absolute tolerance `1e-9`. No production circuit, nullspace
or state compiler is imported by that reference evaluator.

`scripts/active-control-box-benchmark.mjs` compares the existing fixed-course
planner applied to every box corner against the new entry point. The frozen
benchmark uses identical Node flags, fresh processes and three ABBA rounds
on the same runner. Report measured times and memory from those receipts;
do not substitute an asymptotic corner count for an observed speedup.

The maintained browser receiver exercises the visible input table, keyboard
freeze, three readout outcomes, exported-notebook CLI replay, modified-input
refusal, closed-noise contact and 1920/390/320 layouts. The same course runs
from the official fresh source package. These gates qualify this bounded
source-conditional capability. Physical actuation, noise calibration,
unknown-mechanism discovery and the full product research obligations
remain open.
