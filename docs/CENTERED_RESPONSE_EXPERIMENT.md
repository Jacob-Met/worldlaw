# Centered response receiving experiment

This is a local, opt-in science-consumer candidate. It does not change ordinary
structural discovery, adopt a new model into the workbench session, or claim a merged product. A narrow local Studio comparison is now browser-received.

The retained baseline is in `baseline/`; `source-manifest.json` records exact
bytes. Dependencies were copied read-only from a locally restored WORLDLAW
checkout during the shared GitHub rate-limit hold. Fresh upstream composition
and ownership reconciliation remain required before publication.

## Executed problem and mechanism

For a declared rate+bias structure, a 64-row course with slope 2 and sparse +100
outliers converges under soft-L1 scale 0.01 without a large constant origin.
At origin 1e8, ordinary coefficient arithmetic cannot meet the existing
stationarity tolerance. Simply centering and converting coefficients back does
not repair that original-space condition.

The experimental model instead retains a deterministic upper-median original training reading as output origin and an
executable delta model using the maintained feature evaluator. It requires a
constant feature, so subtracting the origin does not enlarge the hypothesis
family. Per-reading weighted fitting is unsupported and refuses explicitly.
Original v1 models retain their existing behavior.

Stable evaluation computes `(reading-origin)-delta`. The receiver separately
exposes `reading-(origin+delta)` and the corresponding rounded RMSE. These can
differ. At origin 1e8 the held-aside residual magnitude is
0.0014433756656018204, while the rounded residual magnitude is
0.0014433711767196655. Original source readings have not gained precision.

The actual prepared predictor and RK4 solver receive the rounded sum. They do
not acquire higher-precision dynamics from stable residual evaluation. Existing
model families and derivative-analysis consumers must not be relabeled as
supporting this experimental schema without explicit qualification. The generic
centered component's derivative helper consumes caller-supplied feature
derivatives; it does not infer or validate a physical coordinate derivative.

## Receiving

Run `node scripts/centered-torque.mjs authored-source.json` to fit original
training rows and evaluate separately supplied challenge rows. Source schema
`worldlaw.centered-torque-source/v1` retains only training/challenge observations,
term IDs and scale. Reopening rejects supplied derived model/result fields and
recomputes. An unresolved fit has no model or evaluation and exits CLI status 2.

Run `node test/centered-response.test.mjs` and
`node test/centered-source.test.mjs`. Ten tests cover offset parity through
1e11, untouched v1 evaluation, fixed-model receiving, missing-constant/rank
refusal, source replay, unsupported weights, nonlinear gravity-feature holdout,
and actual prepared-predictor/RK4 parity with rounded ordinary models. Authored
controls establish numerical behavior, not measured physical accuracy.

## Maintained Studio receiving

The copied maintained workbench exposes an opt-in comparison beside its residual instrument. It uses the inspected fixed structure, refuses missing bias, retains the selected law, and displays stable and rounded metrics separately. Source export reopens through the source receiver/CLI; there is no new UI file-open control.

Actual observation import at origin 1e4 and scale 1e-7, followed by selecting the existing rate+bias hypothesis, changes the unchanged baseline optimizer result from iteration-limit to centered convergence. Held-aside stable RMSE is 1.4433756689857802e-8; rounded RMSE is 1.4433680917136371e-8. Original imports above 1e6 remain refused. First-row-origin fitting failed this small-scale case; using the training median as origin resolves it without consulting challenge rows or changing tolerance.

Sandboxed Chromium receiving includes actual import and model selection, dual metrics, exact source replay, scale invalidation and inspected1280/390 screenshots after repairing table overflow. The earlier bias-only browser course was integration evidence only: its baseline already converged. Neither course establishes measured accuracy or unrestricted structural discovery.
