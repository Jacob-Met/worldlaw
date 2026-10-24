# Experimental cubic restoring-law discovery

This increment adds an **explicitly offered** θ³ feature to the maintained finite-library discovery and executable forward solver. It extends the model class instead of interpreting residual mismatch as evidence of a coordinate defect. Existing torque and angular default libraries remain unchanged; users opt in from the angle-reference apparatus. Physical inertia and absolute torque remain unknown for angular evidence.

## Scientific contract

The feature is θ³ in the current candidate reference coordinate. Its acceleration coefficient has units `1/(rad²·s²)`; known-torque APIs use `N·m/rad³`. No dissipativity, sign or mechanical-origin constraint is imposed. A fitted negative coefficient can resemble a restoring force but does not establish a specific spring or mechanism.

Weak windows, scaled QR, rank checks, candidate scoring and step-resolution qualification reuse the maintained implementations. Integral and pointwise torque discovery also accept the explicit feature so models remain executable across the shared kernel. The existing six angular/seven torque terms stay the defaults. Cubic increases available subsets only after explicit opt-in.

When cubic is offered alongside other terms, the reference investigation performs a matched training-only ablation: remove cubic, preserve the training evidence, coordinate grid, noise, window settings and effective maximum term count, then freeze each library's own winning coordinate and model. The later challenge is never accepted by either fit. The two winners may have different coordinates. This comparison estimates predictive consequences of the declared library change, not a causal contribution of cubic at a common coordinate. The original zero-offset prediction remains separately visible.

Export stores only source bundle and declared settings. Reopen computes both models, audits and predictions again. Changing the offered terms invalidates visible results. Replacing source evidence resets opt-in. A caller offering **only** cubic has no nonempty no-cubic subset, so the matched ablation is omitted; no artificial comparison is fabricated.

A shifted cubic is not a complete polynomial model: expanding `(θ−δ)³` produces a quadratic-position term not generally present in this library. Origin uncertainty and missing terms can therefore remain confounded. At small angles, sin(θ), θ and θ³ can approximate one another; rank heuristics and favorable residuals cannot establish physical uniqueness. Large cancelling coefficients and poor extrapolation remain possible.

## Reproducible evidence

Run `node experiments/cubic-restoring.mjs`. The versioned `evidence/cubic-restoring-results.json` contains a fixed 12-case matrix, two predeclared training releases and a separate 2.1-radian release. The independent explicit-equation oracle already existed and integrates at ≤0.0005 s; it does not import fitted feature/model code. Cases cross cubic strengths 0/.4/1.2, noise 0/.001 rad and initial positions .05/1.5 rad. Initial rate remains .3 rad/s; “small release” describes a starting position, not zero velocity. Every setting is fixed before observing challenge results.

For the noiseless 1.5-radian starts, cubic strengths .4/1.2 improve separate-release RMSE from approximately .06163/.13899 rad to 8.60e−8/1.60e−7 rad. The pure-gravity control retains rate+gravity without a needless cubic term. These are matched-model-class synthetic controls, not unknown real-world mechanism validation.

The negative cases matter: small-release training fails to reveal the relevant nonlinearity and later errors reach 1.355 rad; adding the feature does not fix this. With .001-radian noise and the larger release, the .4 case still has .0373-radian challenge error and retains extra terms. A high-frequency unsupported perturbation remains a training residual mismatch in the focused tests.

The retained PASCO recordings were repeatedly used during method development. With the original two training recordings, a predeclared ±.5-radian grid at .05 steps and .01-radian noise assumption, the extended library chooses spring+gravity+bias+cubic at −.2 rad. Third-recording RMSE changes from .253525 to .174539 rad, whereas step-refinement differences are about 3.8e−6 rad. This is exploratory improvement on a reused recording, **not blind validation or calibration**. The selected spring/gravity coefficients are approximately +722/−765, with cubic −112: large cancellation strongly cautions against assigning individual physical meaning. A substantial prediction error remains.

## Actual receiving and design

The existing instrument panel now offers one opt-in control and overlays the matched no-cubic prediction in purple on the existing observed/forecast canvas. A separate law-picker page was considered but would sever comparison from the source and reference uncertainty; the compact apparatus keeps both frozen predictions in their original observation coordinates. No additional dashboard shell was introduced.

`scripts/cubic-browser.mjs` launches the actual local app and tests source import, default opt-out, keyboard toggle, inference, actual solver overlays, input-only export, invalidation, recomputing reopen, source replacement, and retained measured PASCO input. Desktop and 390-pixel screenshots were inspected; tables remain horizontally scrollable and labeled. The remaining design weakness is the long narrow scientific panel before the trajectory, inherited from the existing audit. The source-specific canvas remains grounded in solver output.

Focused controls are in `tests/cubic-restoring.test.mjs`: independent coefficient/prediction recovery, absence of cubic, preserved defaults for all fit paths, correct units/sign through integral and shared execution, challenge mutation invariance, input-only reopen, declared coordinate recovery, weak excitation, and unsupported dynamics. Run with `node --test --test-isolation=none tests/cubic-restoring.test.mjs` (also tested with `--no-opt`). Maintained launched product and trajectory smokes remain the integration gates.
