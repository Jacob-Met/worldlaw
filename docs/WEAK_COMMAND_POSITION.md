# Position-dependent commanded torque

Trajectory Challenge offers **Test command × angle (uθ)** for known-inertia
Window fit. This deliberately expands the original seven-term torque library
by its existing optional executable interaction term. The default library is
unchanged. The consumer retains its existing maximum of seven terms per candidate
(default four), even when eight terms are offered. Unknown-inertia angular evidence and other fitting methods refuse
the enabled option. An enabled interaction exports notebook v2 so older readers refuse its expanded
model library instead of silently dropping the declaration. Ordinary notebooks
remain v1. A saved input notebook preserves the declaration and
recomputes the models and separate forecasts when reopened.

For each raw sample interval, the supplied command is held at its left value.
The interaction column integrates that command times the linearly interpolated
angle against the compact window polynomial. In particular, it does not
interpolate the product across a command discontinuity. The endpoint command
does not contribute to the preceding interval. Existing noise normalization,
rank diagnostics, training-only ranking and forward numerical checks apply.

The coefficient has units 1/rad under the declared N·m command convention.
This is a finite conditional torque hypothesis, not identification of an
actuator mechanism, physical calibration or a confidence interval. A constant
command makes this column proportional to the ordinary stiffness column;
the resulting lack of excitation remains explicit.

## Executed qualification

On Node 24.22.1, `node tests/weak-command-position.test.mjs` checks an
independent 100,000-point midpoint integral across a command jump, terminal
command invariance, analytic piecewise oscillator inference, separate free
prediction, additive-model failure, future-observation noninterference,
actual challenge export/reopen, unsupported-method refusal and rank ambiguity.
The analytic oscillator has torque `(-2 + 0.8 u) θ`; its independently
initialized challenge is predicted below 0.001 rad RMSE, with at least 100×
improvement over the fitted additive alternative. These are authored numerical
controls, not blind physical measurements.

Relevant regression commands also passed: `node tests/forced-weak-discovery.test.mjs`
(7 cases), `node tests/trajectory-angular-weak-92be.test.mjs` (12 cases), and
`node tests/trajectory-session-review-92be.test.mjs` (15 cases). The prior
test that forbade this newly supported term now checks an unknown term.
Browser receiving, current-main integration and publication are separate gates;
their exact receipts belong in the pull request. This document alone does not
claim those gates have run.
