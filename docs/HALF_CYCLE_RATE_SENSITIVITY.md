# Receiving half-cycle sensitivity to local-rate windows

After inspecting observed receiving half-cycles, use **Compare rate-window sensitivity** to ask whether their signed residuals change when the local rate estimate uses a different number of adjacent samples. The original half-cycle ledger remains visible and unchanged. The recording and cycle selectors above it also select the cycle shown in the sensitivity cards; the separate frozen-law selector changes only which law is displayed.

The default offered set is 5, 9, 17, and 31 samples. The maintained centered cubic estimator supports odd windows from 5 through 31. Browser receiving explicitly adds 33 as an unsupported control after checking the useful initial defaults. You can declare up to six distinct integer offers; unsupported offers remain visible, and do not disappear from coverage.

## What stays fixed

The inspector replays the original source investigation once, then preserves its training laws, loss coefficients, receiving positions, complete-cycle endpoints, retained minimum, potential changes, and sample-distance work. It varies only centered local-rate windows and the resulting endpoint kinetic correction and trapezoidal rate-dependent work. It does not search for better endpoints, change a reference origin, fit a receiving law, choose a window, or rank the laws.

For each half, observed loss is energy before minus energy after. Predicted loss is the dissipative work under the frozen law. Residual is observed loss minus predicted loss. Cards show both signed half residuals and their sum in normalized rad²/s². Opposite signs can cancel; neither cancellation nor its persistence identifies a physical cause.

These are numerical choices, not independent observations or calibrated uncertainty bounds. The displayed set is finite. It does not bound all possible estimators, sampling patterns, endpoint rules, quadratures, or measurement errors. The original endpoint choice is deliberately held fixed, even when another numerical choice might have selected another extremum. Source position resolution is not treated as a sensor accuracy calibration.

## Population and finite work

Every original complete cycle and every frozen candidate appears under every offer. Original refusals remain refused. Insufficient centered support, a too-short original half, a numerically unavailable rate estimate, nonfinite energy, or a whole-population work reservation failure are disclosed.

Finite endpoint energy is shared support. Unavailable viscous or cubic work is represented explicitly; it refuses only comparisons that depend on that feature. A finite restoring-only or Coulomb comparison can therefore survive unavailable viscous work. Quadratic families retain the original conservative rule requiring available cubic work.

Additional work is reserved **per offered window**, in declared order, before that window is evaluated. The reservation conservatively counts all originally supported half intervals and endpoints, including duplicate shared endpoints. The maximum is 32,768 rate windows and 32,768 adjacent intervals for the additional diagnostic pass. Later offers can be refused after earlier complete offers consume the reservation. A refused offer retains its full population and consumes no additional numerical work. Original replay and half-cycle extraction have their existing separate bounds; these additional counters do not pretend to measure them. Execution is synchronous after yielding one animation frame; this is not an interruptible computation or a responsiveness guarantee.

## Source export and reopening

**Export sensitivity source inputs** saves `worldlaw.cycle-work-half-sensitivity/v1` with only the original cycle-work source notebook and declared window/budget options. Reopen it through the existing cycle-work file input. Reopening recomputes the original investigation and sensitivity; derived cards, scores and claimed results are not accepted as evidence. Changing window declarations clears the old sensitivity result before another export. Replacing the selected law or source invalidates the original and sensitivity results together.

The native API is `inspectHalfCycleSensitivity(cycleWork, options)`; `replayHalfCycleSensitivity(inputs)` accepts its source wrapper. The canonical original half-cycle inspector is unchanged.

## Executed controls and limits

The retained PASCO receiving input has 17 complete cycles and six frozen comparisons per cycle. All 102 pairs retain opposite half-residual signs at windows 5, 9, 17, and 31. The maximum absolute change in a half residual relative to the original window 9 is approximately 0.0263476231, 0.0106016781, and 0.0212088711 for windows 5, 17, and 31 respectively. Window 33 retains and refuses all 102 comparisons. This shows persistence across these numerical choices, not the origin of the observed discrepancy. The original measured provenance and calibration qualifications remain in `ANGULAR_CYCLE_WORK.md` and the PASCO example source metadata.

An authored offset-cosine spring control gives opposing residuals +0.56 and −0.56 with zero sum. A separate authored receiving curve `0.7 cos(2t) + 0.01 sin(17t + 1)` changes the first ascending restoring-only residual from approximately −0.003523353 at window 5 to +0.004134301 at window 17, while preserving the same original endpoints. This is a deliberately constructed numerical sensitivity control, selected after bounded exploratory controls; it is not a claim that the measured apparatus contains this harmonic.

Additional raw-source controls exercise finite opposite residuals whose product underflows, and unavailable viscous work with finite restoring-only/Coulomb support. A zero additional budget retains every row and performs zero additional fits or integrations. Portable tests use the existing repository PASCO example and authored positions, rather than a temporary local receipt.

## Receiving qualification

The repaired numerical API passed seven actual native cases. The integrated isolated consumer passed 18 actual full-sandbox Chrome groups, including the existing half-cycle consumer, 144 displayed sensitivity quantities, all offered populations/refusals, an unchanged original ledger/export, actual source download and fresh-page reopening, declaration invalidation, zero-budget refusal, desktop and 390 px receiving, and actual keyboard family selection. Source, test, harness and input hashes were recorded before the browser run. These are isolated candidate results, not a release or a new full repository-suite claim. The previous half-cycle delivery remains independently qualified at its original source pins.

Reproduce from the repository root:

```sh
node --test --test-reporter=tap tests/angular-cycle-work-half-sensitivity.test.mjs
CHROME=/path/to/sandbox-capable/chrome node scripts/angular-cycle-work-half-sensitivity-browser.mjs . /new/receiving/output
```

The final default-only correction was then received separately in four full-sandbox groups: four supported initial offers, actual keyboard compute and four-offer download, desktop/390 px layout, explicit addition of unsupported 33, and reset to supported defaults. The earlier 18-group receipt remains pinned to its original source. Current main b1562c3195ed6b8e17ee336c449e0e0f5b4daf6b was composed with no candidate overlap; both maintained launched smokes passed. This does not relabel the prior native run as a current full-suite run.

The browser receiving requires an unprivileged process and a working Chromium sandbox. It never adds `--no-sandbox`. Its output folder holds local receiving evidence; the browser performs no acquisition, tracking, hardware action, or external source request.
