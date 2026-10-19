# Executable torque discovery: current scope and contract

`src/science/torque-discovery.mjs` is a dependency-free ES module consumed by the
WORLDLAW workbench. It accepts observations, searches the **structure of a scalar
torque law within a declared seven-term library**, fits coefficients, proposes a
discriminating state, revises after new observations, evaluates withheld data,
and executes learned rotational dynamics. It does not infer body/joint topology,
read video, control hardware, or establish a generally valid physical law.

## Observation and model semantics

Each observation contains finite numbers:

```json
{"command":0.2,"position":0.1,"rate":-0.3,"jointTorque":0.4}
```

`command` is input torque in N·m, `position` is radians, `rate` is rad/s, and
`jointTorque` is net joint torque in N·m, using a consistent caller-defined sign
convention. Rows are compatible with the fields used by the HAMON Engine torque
sweep; these SI units are explicit in this standalone consumer. Extra row fields
are ignored and not retained. At least eight and at most 4,096 observations are
accepted. Inputs have a magnitude limit of 10⁶, observed torque of 10¹².

The library is `command`, `rate`, `coulomb` (sign of rate), `spring` (position),
`gravity` (sin of position), `quadratic` (rate times its magnitude), and `bias`.
All subsets with at most `maxTerms` terms are searched, including a zero model.
The default is four terms. This can distinguish a linear restoring term from a
sinusoidal term or linear drag from quadratic drag; it cannot discover a term
that is absent from its library. Coefficient signs and passivity are unconstrained.

Fitting uses column-normalized, twice-reorthogonalized modified Gram–Schmidt QR,
with a relative pivot threshold of 10⁻⁸. Rank-deficient subsets are rejected.
Fitted candidates requiring coefficients above 10¹⁸ are counted as
`unexecutableCandidates` and omitted, so a tiny irrelevant column cannot prevent
other structures from being fitted. Reported `conditionEstimate` is the ratio of extreme scaled QR diagonal entries,
**not the full matrix condition number**. The rank of the complete offered
library is also reported; insufficient excitation remains an ambiguity warning
even when only one fitted model survives. A finite predictive model does not
establish parameter uncertainty or global physical identifiability.

## Callable API

```js
import {discover, predict, evaluate, planExperiment, revise, simulate}
  from './src/science/torque-discovery.mjs';

const discovery = discover(fitSamples, {
  noiseSigma: 0.01, maxTerms: 4, ambiguityDelta: 6,
});
const predictedTorque = predict(discovery.selected, {command, position, rate});
const report = evaluate(discovery.selected, heldOutSamples);
const plan = planExperiment(discovery, permittedCandidateInputs);
// Obtain the actual observation from a separate instrument or declared simulator.
const updated = revise(discovery, [newObservation]);
const trajectory = simulate(updated.selected, {position: 1, rate: 0}, {
  duration: 4, dt: 0.01, inertia: 1, command: 0,
});
```

`discover` returns `worldlaw.discovery/v1` with `selected`, all estimable
`candidates`, `competitive`, copied `observations`, normalized `options`, and
`diagnostics`. Executable models have schema `worldlaw.torque-model/v1`, a stable
term-set `id`, full-precision `{id, coefficient}` terms, a display-only equation,
training domain, units, and metrics. These values survive JSON save/reopen.

The ranking score is
`n * log(max(training_mse, noiseSigma²)) + term_count * log(n)`. It is an explicit
noise-floor information-criterion heuristic, not a calibrated Bayesian
posterior. `noiseSigma` is a caller assumption in N·m. Models within
`ambiguityDelta` of the lowest score are competitive. Exact ties retain the
library enumeration order. In particular, selecting a spring before gravity on
narrow-angle data does **not** assert that the spring is physically correct.

`evaluate` returns count, RMSE, maximum absolute residual, and individual rows
with prediction and residual (`observed − predicted`). No evaluation row enters
fitting. An empty evaluation has `rmse: null`, not zero evidence of error.
`revise` appends copied observations, reruns the original search, and records
the prior selected model's residuals on the new observations in `revision.before`.
It leaves the old discovery untouched. It does not silently remove conflicting
measurements or claim that a time-varying parameter has been solved.

`planExperiment` ranks caller-supplied, permitted inputs by the range of
competitive-model predictions. It reports each prediction, extrapolated input
dimensions, and `status: proposed` only when at least two models disagree by
more than twice `noiseSigma`. Otherwise it reports `uninformative`. Model range
is **not** a predictive interval or expected information gain. The planner has
no torque/position actuator; it does not determine mechanical safety. A
rank-deficient library may need a caller-supplied pilot excitation before its
missing structures can be considered.

`simulate` executes θ′ = ω and ω′ = predicted net torque / inertia using
fixed-step RK4. Inertia is kg·m² and command is constant during the run. It
returns time, position, rate, and predicted joint torque including t=0 and the
requested final time. At most 10,000 steps are allowed. A finite output is not
a stability guarantee, especially at discontinuous Coulomb friction or outside
the observed domain. Invalid/nonfinite input, unknown model terms, excessive
step counts, and runaway states throw `DiscoveryError` with a code; no
success-shaped NaN result is returned.

## Reproducible virtual instrument

`src/science/virtual-lab.mjs` is a separate simulated instrument. Inference never
imports its oracle. `createLab({seed:17})` returns initial observations, a fixed
held-out grid, permitted candidate states, options and explicit synthetic
provenance. `executeLab(input, {experimentIndex,seed})` produces one simulated
measurement with reproducible small sensor perturbation. It is not a physical
measurement or a provider integration.

The declared oracle is τ = 1.7u − 0.25ω − 2.4 sin(θ) + 0.12. Sixty-four initial
observations vary command and rate while angles remain inside ±0.12 rad. The
candidate grid spans ±2.4 rad; 61 distinct held-out conditions span ±2.35 rad.
The held-out grid is never used by discovery, ranking, or acquisition.

On Node 24.19.0, the default experiment produces these observed results:

| Quantity | Before intervention | After one proposed observation |
|---|---:|---:|
| Selected restoring structure | linear position | sine of position |
| Training rows | 64 | 65 |
| Training RMSE, N·m | 0.000548326742 | 0.000542889488 |
| Held-out RMSE, N·m | 1.645293629136 | 0.000957281657 |

The proposed position is +2.4 rad (floating-point representation may differ in
its final digits), with a competitive-model prediction spread of 4.126376497
N·m. This is a falsifiable synthetic closed loop within the declared library,
not qualification on unseen physical mechanisms.

## Independent analytic fixtures and retained limitations

Run `node tests/torque-discovery.test.mjs` for the full individual test report.
The tests construct truth independently of inference feature evaluation and
cover spring plus quadratic drag, Coulomb plus gravity, coefficient scale,
held-out isolation, JSON reopening, rank-deficient excitation, and agreement of
RK4 with exact harmonic and constant-acceleration solutions. The virtual
closed-loop experiment checks structural revision and withheld improvement.

An omitted cubic restoring law intentionally remains `residual_mismatch`; a
parameter that changes between sweeps also remains a conflicting-data mismatch.
These counterexamples are retained. They motivate richer libraries, mechanism
structure search, calibrated uncertainty, temporal change detection, and actual
instrument integration. No research frontier is marked complete by these tests.

## Varied-mechanism active versus passive comparison

Run `node experiments/active-discovery.mjs`. The retained result in
`evidence/active-discovery-results.json` includes every coefficient, seed,
selected structure, proposed state, and measurement outcome. It compares one
maximum-disagreement observation with one fixed narrow-angle observation for
20 varied coefficient/noise seeds in each of two in-library families. There
are 100 independent held-out conditions per case.

| True family | Median initial RMSE | Median active RMSE | Median passive RMSE | Active better than passive |
|---|---:|---:|---:|---:|
| Linear spring | 0.001720925 | 0.000477411 | 0.001664080 | 17 / 20 |
| Sinusoidal gravity | 1.522433821 | 0.000747327 | 1.522478913 | 20 / 20 |

All RMSE values are N·m. Active acquisition recovers the restoring family in all
40 cases, but exact complete term recovery is **19/20 in each family**. Seed 7
in both families omits a true bias of −0.0000886323 N·m, below the assumed noise
scale of 0.008 N·m. Those counterexamples remain in the result. The planner also
does not improve every already-correct spring prediction after one noisy
observation. This experiment uses controlled synthetic additive noise and exact
inputs; it does not qualify real apparatus, input measurement errors, arbitrary
mechanisms, or calibrated uncertainty.
