# Conditional angular-period discovery

The ordinary Studio's **Discover a different angular period** instrument tests whether an observed scalar response needs a different periodic coordinate from the fixed `sin(θ)` / `cos(θ)` library. Original angle, command, angular rate and torque readings stay unchanged. The inferred coefficients and frequency describe a conditional executable torque response; they do not identify gears, instrument calibration, inertia or physical cause.

## Method and custody

`src/science/angular-frequency.mjs` reuses the maintained column-normalized QR. At every offered frequency it fits sine and cosine jointly, together with every subset of an explicit nuisance library (default command, rate and bias; optional linear spring in the source-only contract). Both periodic coefficients count as parameters. The unit-frequency family is always included, as is a separately fitted nonperiodic family. Non-unit frequencies pay one extra fitted-parameter penalty. Ranking uses the existing style of noise-floor score, `n log(max(MSE, noise²)) + parameterCount log(n)`; this is a heuristic, not calibrated statistical confidence.

A complete coarse grid spans the explicit range, with the unit-frequency baseline inserted exactly. Two 17-point local grids refine the smallest training-residual basin. Every sampled fit, rank refusal and coefficient set is retained. This is not exhaustive continuous optimization; an unresolved narrow basin can lie between samples. Competitive frequency samples are not an enclosing confidence interval. Large aliased periods and physically different explanations may agree on every supplied angle.

The fitter accepts training only. Separate receiving predictions happen after the selected model is frozen. Every original row remains in the least-squares objective; declared reading ratios and nonordinary Studio losses are refused rather than silently reinterpreted. A complete work reservation precedes fitting. The browser performs the profile in a dedicated module Worker, terminates it on cancellation/source changes and never accepts partial results.

The input-only `worldlaw.angular-frequency-inputs/v1` envelope retains an ordinary original Studio notebook and explicit profile settings. It stores no fitted conclusions. Reopening recomputes the notebook and requires explicit fresh inference. It does not change the existing session schema or apply a generated library to the Studio's model-selection history.

## Executable motion

Response evaluation uses original angle/rate coordinates. For motion, the implementation conjugates `q = kθ`, `q′ = kω` into the maintained adaptive RK4 solver: rate and spring coefficients are divided by `k`, the solver inertia is `I/k`, and output positions/rates are divided by `k`. Sine/cosine coefficients retain their original torque scale. This exactly preserves `θ″ = τ(u,θ,ω)/I` algebraically; no second dynamics engine or observation reset is introduced. Solver bounds can still refuse the transformed state. Physical inertia, starting state and constant command remain explicit Studio declarations.

## Executed authored controls

On source baseline `176b0827c4132f7543b91ae425ceabd87d9fe183`, the focused native suite uses 73 training readings and separately generated 83 receiving states per mechanism, all with varied command/rate and unfamiliar frequency/phase. The comparison baseline searches all eleven incumbent terms with at most four terms, while the new profile uses its explicitly documented sine/cosine and nuisance family. These are authored numerical courses, not independently measured physical mechanisms.

| True authored k | Selected sampled k | Incumbent receiving RMSE | Revised receiving RMSE |
| --- | --- | --- | --- |
| 1.713 | 1.71240234375 | 0.6328266540 | 0.0011370094 |
| 2.371 | 2.37060546875 | 0.7862499974 | 0.0008896513 |
| 3.427 | 3.42626953125 | 1.1895126594 | 0.0016139206 |

Errors are in N·m. Each profile reserves 2,987,160 work units. These cases establish a useful extension of the representable family, not universal superiority over the incumbent library. A response outside the frequency range and a quartic-plus-oscillation omitted law retain mismatch. A nonperiodic course prefers its nonperiodic alternative. Uniformly spaced angles retain aliases near k=.3 and k=2.3. A fixed-angle course retains periodic rank refusals. Work exhaustion refuses before fitting; challenge mutation changes no frozen training result; source-only replay reproduces the profile. A separate small-step midpoint calculation agrees with the conjugated adaptive motion within 1e-8 on the tested damped sinusoid.

Native command: `node tests/angular-frequency.test.mjs`. Browser command: `node scripts/angular-frequency-browser.mjs`, with the existing `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH` and `BROWSER_ARTIFACT_DIR` environment conventions. Actual browser and published-source results must be recorded on the native PR after execution, not inferred from these authored native checks.

## Experience decision

Two approaches were considered: a separate frequency-analysis page, and an instrument inside the existing Studio residual/model journey. The integrated instrument preserves the original observed apparatus and keeps the training frequency profile, unit-frequency/selected response confrontation, separate receiving residuals and executable motion together. It reuses the maintained chart grammar and source custody rather than inventing another general dashboard. The wider Studio's accumulated diagnostics remain a navigation/design limitation; this increment does not claim a redesigned complete experience.
