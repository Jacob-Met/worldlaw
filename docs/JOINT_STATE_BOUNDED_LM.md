# Joint-state fitting continues at coefficient bounds

The joint supplied-position/rate fitter now uses the maintained bounded LM helper shared with the position-only and condition-specific fitters. Previously, an accepted proposal clipped to a coefficient bound left no central finite-difference interval. The next iteration stopped all coordinates with `jacobian_unresolved`. The helper uses inward differences at a boundary and a reduced step for the currently free coordinates, allowing a constrained spring coefficient to remain fixed while the rate coefficient continues improving.

The runtime change is confined to optimizer delegation in `src/joint-state/fit.mjs`. It preserves the joint-state scientific work established in [issue 282](https://github.com/Jacob-Met/worldlaw/issues/282), including original attribution, source admission, fixed starts, supplied-rate provenance and dependence declarations, declared objective scales, and separate position and rate numerical screens. The shared helper is unchanged.

## Independent authored comparison

The native comparison used Node 24.22.1 and public source pinned to `0a7ba12e58d714a52fd8f5385b87a1a8600c927e`. Three analytic damped-oscillator courses each contain 126 original position and supplied-rate rows over 0–5 seconds at 0.04-second intervals. Their initial position/rate pairs are `(1, 0.2)`, `(-0.7, -0.1)` and `(0.5, 0)`. The exact analytic rates belong to the same authored trajectories; independence is not assumed.

The true rate and spring coefficients are `[-0.2, -4]`. The declared seed is `[-0.3, -3.6]`, with bounds `[[-1, 0], [-3.85, -2]]`. The spring box deliberately excludes the true coefficient. Both versions use eight iterations, a 0.02-second maximum integration step, separate position/rate numerical screens of 0.001, and explicit channel scales of 0.1.

| Result | Previous loop | Shared helper |
| --- | ---: | ---: |
| Dimensionless weighted training RMS | 0.7996830295007916 | 0.6772447091845787 |
| Actual evaluations | 8 | 41 |
| Maximum evaluations | 65 | 65 |
| Reserved integration steps | 186,810 | 186,810 |
| Reserved prediction rows | 24,570 | 24,570 |

The previous loop stopped after boundary entry. The shared helper continued accepted progress, reducing both position and supplied-rate errors on every course. All trial parameters remained inside the declared bounds; final position and rate numerical screens passed; original inputs were unchanged. The joint residual budget continues to account for two channels.

This is a local constrained training improvement. It does not establish measured physical validity, independent held-out improvement, a global optimum or a speedup. The spring mismatch remains. Channel scales are objective weights, not independently estimated noise or a likelihood. Counts near floating-point ties may vary by runtime; the reservation remains fixed.

The [native comparison receipt](receipts/joint-state-bounded-lm-7912183a/native-comparison.json) records the configuration, exact source identities, both-channel results, numerical screens, strict-rate refusal and input-preservation checks. The analytic fixture is maintained in `tests/joint-state-boundary.test.mjs`. The comparison input SHA-256 is `86efee448961acd995afe70ef052837d071a00ab39392f738d30281bd6d60a89`; the original native result SHA-256 is `62cdcb2b023ff9dc93ce2cc763a3e3d19b95ce2ba35a9075285fd71fc7c6198c`.

## Regression and receiving

The maintained regression exercises the actual joint-state fitter. It requires accepted progress after the first accepted spring-boundary trial, material improvement in the declared objective, lower errors in both channels, unchanged source/model/options, bounded trial values and the unchanged complete reservation. It does not pin the actual evaluation count.

A separate control tightens only `rateScreen` to `1e-16`. Both versions refuse the seed after one evaluation despite passing the position screen. Supplied-rate provenance, dependence declarations, fixed starts and both numerical screens remain enforced.

Against the untouched baseline, the new boundary regression failed at the missing post-boundary progress assertion and the strict-rate control passed. The candidate passes both tests and all eight focused joint-state tests. The full candidate serial Node suite reports 2,222 tests: 2,221 passed, zero failed and one inherited skip. Both maintained launched smoke tests pass. An earlier baseline run with concurrency four had a worker-file failure in `tests/geometry-law-transfer-consumer-source.test.mjs`; the same file passed in isolation. Its cause remains unexplained, and the failure is retained.

These results qualify the numerical consumer and launched smoke paths. Browser qualification is pending and is not claimed here. The fitter-level analytic control is not an end-to-end notebook fixture: the joint session derives its seed from the preceding position-only study and retains its existing strict seed-admission contract.

