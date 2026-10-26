# Coupled viscous-loss comparison

Open **Coupling Lab → Estimate inertia from a separate motion record → Can drag act across the two coordinates?** The instrument compares the maintained five-coefficient diagonal-loss balance with a six-coefficient symmetric-loss alternative:

`M q″ + D q′ = supplied torque`

Both use a constant symmetric inertia. The original baseline fixes D01=0; the alternative infers D01 together with the other coefficients from the original synchronized angle/torque rows. The same endpoint-vanishing weak operator and normalized QR are reused. No pointwise acceleration is synthesized, no challenge reading fits the law, and neither hypothesis is automatically adopted.

## Using real source inputs

Open a `worldlaw.coupled-viscous-study/v1` JSON file containing `training: {record, settings}` and either `challenge: null` or `challenge: {record, settings}`. Use the authored example's **Save comparison inputs** output as a complete schema example. Records explicitly declare `worldlaw.coupled-viscous-observations/v1`, `compare-diagonal-and-symmetric-viscous-loss`, seconds/radians/N·m, a synthetic or user-declared measured source, complete torque semantics, and original courses. The separate source additionally declares correspondence and two weighted-balance tolerances.

The original `coupled-inertia-observations/v1` reader and default fit stay unchanged. New records explicitly offer the additional family; old declarations are never silently broadened. Exports contain only original inputs and settings, and reopening computes both complete fits again. An altered or excessive input refuses atomically.

## What is retained

- Both training fits, rank failures, unconstrained coefficients outside the supported family and original/coarser source results.
- A symmetric positive-semidefinite damping admission alongside the maintained positive-definite inertia admission. An unconstrained inadmissible fit does not exclude every admissible explanation.
- Original window/course indices, weighted source torques and both predicted balances.
- Frozen training coefficients on the separately supplied motion and its coarser source. Declared tolerance is a receiving criterion, not a calibrated confidence interval.
- A complete quadrature reservation, including both legacy and alternative calculations, before fitting.

Source labels and changing-block repetition screening do not authenticate independence. Sensor mixing, missing forces, nonconstant inertia or nonlinear drag can invalidate both offered laws. Overlapping weak windows are correlated. Smaller training residual alone is not evidence for a physical cause. This increment compares executable balances using supplied angles; it does not yet propagate the learned cross loss into future-motion simulation.

## Executed evidence

On 1,201 authored training rows and 1,201 separately generated different-frequency rows:

| Hypothesis | Training balance RMS, N·m | Separate balance RMS, N·m |
| --- | ---: | ---: |
| Diagonal loss | 0.1049437426 | 0.1387189268 |
| Symmetric loss | 5.03084e-9 | 6.84433e-9 |

The alternative recovers authored `[M00,M01,M11,D00,D11,D01]=[1.8,.32,1.25,.35,.52,.19]` within 3.42e-8. The original input JSON SHA-256 is `27f1354bf64439c7d816410534347d03d076cb81d4f1544c5cba5872e3bb641d`. A single observed Node22 run took 54.50ms; this is not a throughput benchmark. The complete calculation reserves 10,440 of 100,000 quadrature segments.

Ten focused native groups include six unfamiliar matrices/frequency courses, no-cross parity, wrong-force and asymmetric counterexamples, rank/PSD refusals, clock/coordinate transformations, challenge-value invariance, replay and work limits. Together with existing affected inertia tests, 37 tests passed on Linux/Node22. The maintained launched smoke passed after completing its source assets. The actual maintained browser harness passed 24 groups, including the original Coupling/Studio journeys and nine new comparison groups.

The first desktop/narrow rendering revealed hard-to-read light traces and horizontally hidden narrow comparison columns. The adopted composition uses the established dark instrument surface with original and competing torque traces; narrow tables expose all results vertically. This was preferred over a decorative animated mechanism because no observed geometry or forward simulation is supplied here. Actual desktop and 390px views were inspected after correction. Screenshots and the browser receipt are in [the retained receipt directory](receipts/viscous-70fa/).

```sh
node --test tests/viscous-comparison.test.mjs tests/inertia-identification.test.mjs tests/inertia-challenge.test.mjs tests/inertia-record.test.mjs tests/inertia-investigation.test.mjs tests/coupling-inertia.test.mjs
npm run smoke
BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-viscous WORLDLAW_VISCOUS_RECEIVING=1 node scripts/coupling-browser.mjs
```

Base source: `176b0827c4132f7543b91ae425ceabd87d9fe183`. The native issue and PR carry exact published and merged pins. These are authored numerical and actual-browser receiving results; physical acquisition, deployment and general mechanism discovery are not established.
