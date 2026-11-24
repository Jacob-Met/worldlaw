# Initial-state fitting from a fixed noisy prefix

A correct dynamical law can make a poor free forecast when its initial state is copied from one noisy reading. WORLDLAW now offers a bounded trajectory fit that estimates the initial state from a fixed opening prefix while keeping the candidate law and coefficients unchanged. Its future prediction is evaluated only after the prefix ends.

## Use the maintained product

The existing application starts with `npm start`. Send state recordings to `POST /api/trajectory/operator-discovery` with the ordinary `training` and `selection` arrays, and select:

```json
{
  "options": {
    "forecastInitialization": "prefix-shooting",
    "prefixPoints": 17
  }
}
```

This is an options fragment for the documented discovery request, not a complete request without recordings. Model selection uses the suffix of each selection recording; these selection recordings therefore cannot also count as an external test set.

The public predictor supports the same initialization:

```js
const forecast = forecastStateTrajectory(model, independentRecording, {
  initialization: 'prefix-shooting',
  prefixPoints: 17
});
```

The finite field-law consumer supports `identify(training, verification, method, {initialization:'prefix-shooting', prefixPoints:17})`. The earlier first-observation field initializer and local-cubic symbolic initializer remain the defaults, preserving the original experiments.

## What the estimator can see

For a 17-sample prefix, the optimizer receives copied observed state vectors at indices 0 through 16. It simulates the fixed candidate model over those same times and recorded commands. It has no latent initial state, no supplied derivative labels, and no observed suffix states.

The field path also receives the declared channel measurement scales. In the registered synthetic generator, those scales are defined from each clean trajectory's centered signal standard deviation and the nominal SNR. They are supplied synthetic sensor calibration, not information estimated solely from prefix bytes. The public symbolic path currently gives the state channels equal weight.

The general trajectory preparation still validates the whole recording and estimates a reported noise scale. Those later state values and prepared smoothing arrays do not enter the shooting initializer. With model, prefix, commands and supplied scales fixed, changing future measured states must leave the fitted initial state and every predicted state unchanged.

## Numerical and scoring boundary

The shared `fitPrefixState` routine uses four bounded Gauss–Newton iterations by default, finite-difference state sensitivities, the maintained normalized QR solver, a fixed small ridge, and four fixed step fractions. It starts from the first observed state. A stopped search reports its reason; it does not certify stationarity or a global optimum. Nonfinite trajectories, invalid scales and exceeded work budgets produce explicit failures instead of fabricated initial states.

The symbolic predictor resumes integration at the last fitted prefix state, index 16. The finite field predictor replays the same fixed model from the fitted time-zero state. Both score only indices 17 through 128 in the registered 129-sample course: 112 untouched suffix times. The old initializer is evaluated over this identical suffix for a paired comparison. A lower training-prefix residual alone is never the acceptance criterion.

The verification threshold remains a standardized suffix RMS of 3. A bounded twin-reset contradiction can veto every finite Markov candidate. That witness retains its original synthetic exact-reset assumptions; absence of a contradiction is inconclusive.

## Prospective course and interpretation

The protocol in `experiments/noisy-prefix-initialization/protocol.json` was registered before implementation or outcomes (taskboard message 194619). It contains two fresh parameter/initial-condition worlds for all 22 registered families, the two hidden-dynamics controls, and 15/25/40 dB nominal measurement levels: 132 in-roster and 12 outside cells.

Every arm receives independent Gaussian draws at each time and channel. Noise is not centered or rescaled using the complete record, so the prefix and suffix noise draws remain independent conditional on the synthetic calibration. Actual realized SNR is retained separately from nominal expected SNR.

The four existing acquisition arms are unchanged: two-contender weak, committee weak, random weak, and passive finite-template differential fitting. Each has the old and new initializer on the same acquired recordings and the same suffix. Each sham plans from its own permuted pilot, acquires its selected drive, and permutes the response and verification while preserving commands.

The primary gate requires strictly more correctly admitted laws for the new contender than for new random and new passive, with zero wrong, sham and outside admissions. A separate estimator gate compares new and old contender initialization on identical suffixes. Passing the estimator gate cannot replace the active-superiority gate. Ties and losses remain failures.

This is a finite synthetic law dictionary, not unrestricted SINDy or physical-world qualification. The existing #893 144-cell result and retrospective drive ceiling remain historical diagnostics. The original course has completed: the estimator gate passed and the strict active-superiority gate failed. See [the full original result and qualification limits](NOISY_PREFIX_RESULTS.md).

## Reproduce and receive

```sh
node --test tests/prefix-state-fit.test.mjs tests/field-prefix-fit.test.mjs tests/state-operator-prefix-http.test.mjs
node scripts/noisy-prefix-course.mjs prefix-output
node scripts/receive-noisy-prefix.mjs prefix-output
npm run verify
```

The course retains all raw pilot, response, verification, sham and twin-reset observations, protocol and source hashes, per-cell decisions, paired counts, initialization failures, realized SNR and execution metadata. Partial failed originals are retained but cannot enter complete-cohort scores. The receiver replays every decision, recomputes suffix errors and counts, and checks future-state invariance in all three measurement layouts.

The workflow's Node heap cap is recorded as a heap cap; it is not represented as an aggregate kernel memory guarantee. The usual release workflow separately checks full scientific regressions, launched application smokes, actual browser paths and the source distribution.
