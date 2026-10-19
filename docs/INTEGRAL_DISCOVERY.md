# Integral angular-trajectory discovery: experimental contract and evidence

`src/trajectory/integral-discovery.mjs` adds a dependency-free browser ESM route
from angular runs to the existing executable scalar torque models. The trajectory
challenge consumer can fit training runs, then evaluate unchanged candidate models
on separate, altered-start challenge runs with `src/trajectory/forward.mjs`.

This is **finite-library scalar torque structure and coefficient fitting**. It
uses the existing seven `TERMS` (`command`, `rate`, `coulomb`, `spring`, `gravity`,
`quadratic`, `bias`). It does not infer mechanism topology, unknown inertia, camera
calibration, arbitrary equations, or physical laws beyond that supplied library.
The experiments below use controlled synthetic data. Physical-source receiving
remains unqualified.

## Callable interface

```js
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {predict} from '../src/science/torque-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

const discovery = discoverIntegral(trainingRuns, {
  noiseSigma: 0.01,       // assumed position sensor sigma, radians
  maxTerms: 4,
  ambiguityDelta: 6,
  rateWindowSize: 9,     // odd, 5–31; only used for Coulomb/quadratic features
  rowStride: 1,          // retain every nth cumulative equation plus final endpoint
  // terms: ['command', 'rate', 'spring', 'gravity', 'bias'],
});
const torque = predict(discovery.selected, {command: 0.2, position: 0.3, rate: -0.1});
const independentCheck = rollout(discovery.selected, challengeRun, {maxStep: 0.005});
```

Each training run is:

```json
{
  "id": "training-1",
  "label": "Calibrated angular run",
  "kind": "measured",
  "inertia": 0.8,
  "initialRate": 0.3,
  "source": {"label": "Caller-provided provenance"},
  "samples": [
    {"time": 0, "position": 0.5, "command": 0.1},
    {"time": 0.025, "position": 0.507, "command": 0.1}
  ]
}
```

The two rows illustrate the shape; an actual run needs 5–4,096 rows. A call
accepts one to eight runs, with unique nonempty IDs and at most 8,192 total rows.
There must be at least eight retained integral equations across the runs. Times
are strictly increasing, the maximum run duration is 10,000 s, positions are
already **unwrapped radians**, commands are N·m, supplied initial rates are rad/s,
and known positive inertias are kg·m². Magnitude bounds match the executable
predictor for position, command, and rate (10⁶); inertia and timestamps are bounded
by 10¹². `kind` is `synthetic`, `measured`, or `unknown`. Provenance is caller-declared,
not a verification claim.

The returned object has `schema: 'worldlaw.discovery/v1'`, method
`double_integral_position_regression`, `selected`, `candidates`, `competitive`,
normalized `options`, `diagnostics`, copied `trainingRuns`, and `fitEquationCount`.
It intentionally has **no torque `observations` array**. Original labels and the
source label are copied; arbitrary source metadata is not retained by this fitter.
The session/import layer is responsible for preserving complete source records.
No caller object is mutated.

Each candidate remains a `worldlaw.torque-model/v1`, accepted by `predict` and
`rollout`, with full-precision coefficients and the same coefficient units as the
existing `TERMS`. Display equations round coefficients for readability only. JSON
save/reopen preserves execution. The fitted model's domain describes raw observed
position and command ranges. Its rate domain records estimated rates when nonlinear
rate terms are offered; otherwise it is explicitly marked
`declared_initial_rates_only`, not a claimed full velocity domain.

### Units are deliberately different from torque regression

- `metrics.rmse`: **radians**, the raw integrated training-equation residual.
- `metrics.whitenedRmse`: **radians**, after the shared-initial-position noise
  transform described below; this value drives scoring and training adequacy.
- `metrics.maxAbsResidual`: **radians**, raw integrated training residual.
- `noiseSigma`: **radians**, a caller assumption about independent raw position noise.
- `predict(model, input)`: **N·m**, the executable net torque law.
- `rollout(...).metrics.positionRMSE`: **radians**, a separate free-running prediction
  error; subsequent measured positions never reset the simulated state.

`residualUnits`, `noiseSigmaUnits`, and each model's `residualMeaning` make the
training distinction machine-readable. The legacy torque `evaluate`, `revise`,
and `planExperiment` helpers expect torque observations/noise and must not be
called directly on this discovery object. To revise an integral fit, the session
constructs a new training-run set and calls `discoverIntegral` again. A trajectory
challenge is evaluation evidence until explicitly reclassified; it must never
silently enter fitting or change candidate ordering.

## Physical equation and numerical method

For a run with known constant inertia I and supplied initial rate ω₀, the identity
is

\[
\theta(t)-\theta_0-\omega_0 t
  = \frac{1}{I}\int_0^t(t-s)\,\tau(\theta(s),\omega(s),u(s))\,ds.
\]

Time is relative to the first sample. Substituting a candidate's finite torque
library produces a linear regression in the torque coefficients, normalized to
position residual units. The target never contains an estimated angular
acceleration or a second derivative of noisy observations.

For a feature that is linearly interpolated between adjacent observations, the
first integral A and double integral B update over interval h as

\[
A_{i+1}=A_i+h(f_i+f_{i+1})/2,\qquad
B_{i+1}=B_i+hA_i+h^2(2f_i+f_{i+1})/6.
\]

This is exact for the **interpolated feature**, not for an unknown continuously
varying physical feature. Command uses `f_{i+1}=f_i`, so the observed command at
row i is held over `[time_i,time_{i+1})`. That convention agrees with the forward
solver, including at command switches. The final sample's command has no fitting
influence because it has no following interval. Bias integrates exactly to t²/2.

The linear rate feature uses the identity

\[
\int_0^t(t-s)\omega(s)\,ds
  = \int_0^t\theta(s)\,ds-t\theta_0,
\]

with a trapezoidal position integral. **Linear damping therefore requires no
numerical derivative.** Only offered `coulomb` and `quadratic` terms trigger local
cubic first-derivative estimation. These estimates use centered, time-scaled,
twice-reorthogonalized QR windows and one-sided endpoint windows; the first rate
is the supplied `initialRate`. Small runs use the largest available odd window.
No measured positions are interpolated across missing timestamps, and no angle
unwrapping is performed.

### Shared initial-position noise treatment

If the raw angular measurement errors are independent with common standard
deviation σ and ω₀ is exact, the target errors at retained positive times have
covariance σ²(I+11ᵀ), because every equation subtracts the same noisy first
position. Per run, the fitter applies its inverse square root to the target and
all design columns:

\[
Wv=v-\left(1-\frac1{\sqrt{n+1}}\right)\operatorname{mean}(v)\,\mathbf 1.
\]

This addresses that **one known source** of correlation. It does not account for
the integrated errors in feature columns, nonlinear transformations of noisy
rates, uncertain initial rate, timing, input alignment, inertia, drift, or
quadrature error. Those errors remain correlated and can bias coefficients and
selection. Treating the transformed rows as independent physical experiments
would be incorrect.

### Bounded search and diagnostics

Every offered subset with at most `maxTerms` terms is considered, including the
zero model. Column normalization and twice-reorthogonalized modified Gram–Schmidt
QR avoid normal equations. The relative rank threshold is 10⁻⁸; coefficients
above 10¹⁸ or nonfinite candidate metrics are rejected. Stable norms handle
extreme but representable column scales. Unrepresentable equations or diagnostics
throw a typed `DiscoveryError` rather than returning success-shaped NaNs or
infinities.

The heuristic score is

\[
n\log\max(\mathrm{whitened\_MSE},\mathrm{noiseSigma}^2)
 + k\log n,
\]

where n is the retained equation count and k is the term count. Models within
`ambiguityDelta` of the best score are competitive. Enumeration order breaks exact
ties; it is not evidence of a uniquely identified physical structure. Full-library
rank, discarded candidates, scaled QR diagonal ratios, regressor column norms,
run sampling gaps, possible wraps, and derivative usage remain inspectable. Column
norms have different units (`rad per coefficient unit`) and are not directly
comparable measures of physical importance across terms. The QR diagonal ratio
is not a full condition number.

Neither this score nor competitive-model spread is a calibrated likelihood,
posterior, confidence interval, or proof of physical validity. Correlated
regressor errors can make the heuristic strongly prefer extra terms. The
`not_falsified_on_training` status means only that the whitened training RMSE did
not exceed three times the supplied σ. Independent free-running challenge error
is the consumer's stronger check.

## Reproducible tests and measured observations

Run:

```sh
node tests/trajectory-integral-92be.test.mjs
node experiments/integral-discovery-92be.mjs
node tests/trajectory-forward-92be.test.mjs
```

On Node 24.19.0, the integral suite reports **13 passing tests**. Coverage includes
exact switched-command acceleration, representable absolute timestamp shifts,
known-inertia damped spring coefficients, nonlinear pendulum transfer, positive
and negative drag, first-derivative-free linear damping, insufficient excitation,
JSON execution, immutable inputs, extreme column scaling, typed sparse-array
validation, and finite numerical failures. The separate forward suite reports
**11 passing tests** when executed directly.

The reproducible comparison uses three independent training starts per case,
6 s duration, 0.025 s sampling, inertia 0.8, command gain 1.3, damping 0.22, and
restoring coefficient 2.2. The spring source is a closed-form underdamped analytic
solution. The pendulum source is an independent explicit-equation RK4 simulator
with steps no larger than 0.0005 s; it does not import the fitting feature
library or learned-model rollout.

Each family has position noise σ = 0, 0.0001, 0.001, or 0.01 rad, and three base
seeds (11, 29, 73), with offsets +100/+200 for other training runs. Both methods
search the same seven-term library with at most four terms. The derivative
baseline uses the existing cubic derivative adapter, window 9, the supplied
position σ, and the median propagated torque σ (floor 10⁻⁶ N·m). Integral scoring
uses the supplied position σ (floor 10⁻⁶ rad). The zero-noise floor is numerical,
not a claim of sensor accuracy; quadrature bias remains visible.

The withheld run starts at θ=2.15 rad, ω=−0.65 rad/s with command −0.18 N·m,
runs for 8 s, and has no injected measurement noise. Both methods are tested by
the same free-running forward solver at maximum step 0.005 s. **Held-out errors
never select or reorder the models.**

Median held-out angular RMSE over the three seeds:

| True family | Position σ, rad | Integral RMSE, rad | Derivative-fit RMSE, rad |
|---|---:|---:|---:|
| Damped spring | 0 | 0.000384367 | 0.006170741 |
| Damped spring | 0.0001 | 0.000476074 | 0.006207074 |
| Damped spring | 0.001 | 0.001310577 | 0.006373093 |
| Damped spring | 0.01 | 0.009943790 | 0.715702118 |
| Damped pendulum | 0 | 0.000323452 | 0.004305860 |
| Damped pendulum | 0.0001 | 0.000396997 | 0.005874620 |
| Damped pendulum | 0.001 | 0.001172385 | 0.006446903 |
| Damped pendulum | 0.01 | 0.008589711 | 0.744670736 |

Integral fitting has lower independent trajectory RMSE in **24/24** of these
specified cases. However, **23/24 integral selections include a spurious fourth
term**. Useful forward prediction here is much stronger evidence than exact
structure recovery. The result is sensitive to σ, initial-state accuracy,
quadrature, sampling rate, and correlated feature noise; it does not establish
universal superiority. The derivative baseline's high-noise floor can legitimately
favor underfitted models; those choices and all coefficients are retained in the
experiment's JSON output.

### Retained counterexamples

1. **Incorrect supplied initial rate.** Adding +0.25 rad/s to a training run's
   declared initial rate yields integral held-out RMSE **0.128282884 rad** versus
   derivative-fit **0.002567829 rad**. Integral fitting's initial-rate assumption
   is a real failure mode, not just a UI field.
2. **Coarse quadrature on fast dynamics.** A spring coefficient of −35 N·m/rad,
   sampled every 0.15 s, is fitted as approximately **−37.954625**. Independent
   fine-sampled challenge RMSE is **0.294179690 rad**. Integration avoids second
   derivatives but does not remove undersampling bias.
3. **An omitted cubic restoring torque.** With a true extra −0.8θ³ term absent
   from the library, narrow training starts yield raw integrated RMSE
   **0.000818580 rad** and whitened RMSE **0.000381659 rad**. The fit is
   `not_falsified_on_training` at assumed σ=0.001, but the altered-start challenge
   gives **0.307385891 rad**. The fitted spring/gravity combination does not make
   the missing cubic law discovered.
4. **Inertia miscalibration can survive trajectory validation.** When true inertia
   is 0.8 but both training and challenge declare 1.0, the learned spring coefficient
   is approximately **−2.750393624** instead of −2.2. Free-running challenge RMSE
   remains only **0.000160536 rad**, because the torque/inertia ratio is preserved.
   Correcting only the challenge inertia exposes **0.230936943 rad** error. Angular
   trajectory agreement alone cannot identify an absolute torque scale without
   independently known inertia.

The drag fixtures further isolate nonlinear-rate behavior: quadratic drag uses
the closed form `theta0 + sign(omega0)*I/c*log1p(c*abs(omega0)*t/I)`, and Coulomb
fixtures remain away from zero velocity so their acceleration is constant. Both
positive and negative training rates and an altered-start holdout are exercised.
Quadratic drag retains small smoothing/quadrature bias; the tests do not qualify
stiction or discontinuous zero-crossing friction.

## Remaining scientific limits

The current evidence supports an additive, executable alternative to noisy
second-derivative torque targets on these declared scalar fixtures. It leaves
unknown-body reconstruction, arbitrary topology, latent forces, nonlinear or
unknown inertia, uncertainty calibration, correlated sensor errors, clock error,
contact transitions, active safe physical interventions, and actual measured
apparatus receiving open. The next defensible improvement is a noise-aware or
compact-support weak-integral formulation that reduces cumulative-regressor and
initial-state sensitivity, compared against these retained failures and the same
independent-run forward checks.
