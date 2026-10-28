# Observed receiving half-cycle work

A small maximum-to-maximum work residual can conceal opposite errors within the cycle. After comparing angular cycle-work laws, choose **Inspect receiving half-cycles**. Select a receiving recording and an original complete cycle: the observed angle trace locates its endpoints and retained minimum, and the signed ledger compares both halves under every frozen training law.

This optional instrument evaluates separately supplied receiving positions. It does not refit coefficients, choose a law, alter a restoring hypothesis, estimate a physical force or supply a statistical rejection threshold. The original trajectory comparison, including forward-rollout refusals, and the original source export remain available.

## What is compared

Each original complete maximum-to-maximum receiving cycle is partitioned at its contiguous interior minimum. Even-width plateaus use the earlier middle sample, matching the existing endpoint convention. Each half must span at least `windowSize` adjacent sample intervals, meaning at least `windowSize + 1` inclusive samples. “Descending” and “ascending” name the endpoint arrangement; intermediate samples need not move monotonically.

Observed loss is:

`E_before − E_after = V(q_before) − V(q_after) + (rate_before² − rate_after²)/2`.

The potential and coefficients stay frozen from training. Rates reuse the maintained centered local cubic fit. Predicted loss is the frozen nonnegative dissipative coefficients times integrated squared rate, absolute angular travel and, where admitted, cubed absolute rate. **Residual is observed loss minus predicted loss.** Negative observed loss remains visible. Values have normalized units rad²/s²; unknown inertia prevents interpreting them as calibrated joules.

Every original cycle and candidate remains represented. Ambiguous minima, insufficient support and nonfinite arithmetic produce explicit refusals. Unavailable cubic work refuses dependent comparisons while preserving supported original families. A refused partition retains its original complete-cycle trace without inventing a minimum or choosing a more favorable half.

The halves share a measured minimum and derivative windows. They are correlated observations, not independent replication. Endpoint selection, derivative estimation, quadrature, reference error and a wrong restoring law can all contribute to residuals. Opposing signs do not identify the physical explanation.

The original source limits bound replay and extraction. The additional diagnostic pass caps rate-window evaluations and adjacent integration intervals at 8,192 each, shared across all receiving recordings and candidate laws. A sample's fitted rate is cached within its recording. The diagnostic counters exclude replay and original extraction. Exhausted counters refuse affected comparisons before incrementing beyond the cap. Observed-half support is separate from the forward-solver budget: a half-cycle calculation can be available while a forward rollout remains refused.

## Source custody and compatibility

Export uses `worldlaw.cycle-work-halves/v1`, containing only its schema and the original `cycleWork` input notebook. Original cycle-work v1/v2/v3 semantics are unchanged. Reopening recomputes both the original investigation and the half-cycle diagnostic; supplied derived comparisons are ignored. Source or declaration changes clear the diagnostic and its export. Pending file reads cannot replace a newer declaration.

The receiving angle trace uses the original source samples. Straight segments connect recorded positions; they are not extra measurements or inferred intermediate motion. Amber and blue bands locate the supported intervals. Keyboard-accessible selectors choose a recording and cycle; the comparison ledger remains a named, focusable horizontal scroll region on narrow screens.

## Retained controls and disagreement

The previous receiving course reported an independently sampled authored oscillator, `q(t) = 0.1 + 0.8 cos(2t)`, challenged with a frozen spring coefficient 4 that omits its constant bias. Its two observed losses were +0.6399999999999999 and −0.6399999999999999, while their sum was zero. Whole-cycle agreement therefore hid a failure of the declared model in this control. It does not diagnose the cause of a similar pattern in measured data.

The previous analytic damped-position control used one fixed, finer training calibration for both receiving resolutions. Its recovered viscous coefficient was 0.0800000355392064. Refining receiving sampling from 64 to 128 samples per period reduced maximum half-cycle residual from 0.000011198378749147087 to 0.0000007084512658045439. This is authored numerical evidence under known equations, not physical calibration.

In the previous reused PASCO receiving course, all 17 complete cycles had supported half-cycle partitions. Its first retained cycle illustrated cancellation under the frozen Coulomb law:

| Quantity, normalized rad²/s² | 5.49 → 6.02 s | 6.02 → 6.55 s | Pair sum |
| --- | ---: | ---: | ---: |
| Observed loss | 0.8749095379 | −0.5734588892 | 0.3014506487 |
| Predicted loss | 0.1559139050 | 0.1551968764 | 0.3111107814 |
| Residual | +0.7189956329 | −0.7286557656 | −0.0096601327 |

These recordings were already used during development; this is exploratory receiving, not a new blind evaluation or identification of a missing force. The mixed family's lower training work error and worse later-position error remain visible in the original investigation.

## Reproduce receiving

With the repository's supported Node runtime:

    node tests/angular-cycle-work-halves.test.mjs
    node scripts/angular-cycle-work-halves-browser.mjs <repository-root> <fresh-output-directory>

Set `CHROME` to an installed Chrome executable that retains its sandbox. The browser course checks active namespace and seccomp isolation before opening the product. It preserves the earlier eleven receiving groups and adds measured inspection, original-export preservation, actual download/fresh-document reopen, source-sample trace populations, forged-derived-data rejection, stale-read invalidation and narrow keyboard receiving.

The reconstructed receiver additionally checks every displayed numerical cell against native replay and every plotted position against its original source sample. Its frozen measured course expects 816 displayed values and 1,800 plotted positions, plus actual overflow and keyboard scrolling at 390 pixels.

## Historical qualification of the reconstructed candidate (October 27)

The calculation module, parent integration module and native half-cycle controls were recovered byte-for-byte from retained source. The separate view, receiver and guide were reconstructed after the environment restart. Their earlier browser passes were not used to qualify the reconstructed bytes.

The qualification base is `32a85d73021356f62fb963ac26d2fa3c814c8fea`. All 1,369 materialized canonical text/source blobs matched that commit before the candidate overlay. The full native suite on Node v24.22.1 completed with **1,519 passes, zero failures and one inherited optional-browser skip**. Both maintained launched smoke commands passed. The final narrow-screen column-width repair followed the native run; the calculation module, parent integration and native test bytes remained unchanged. Its rendering was verified in the final browser course.

The final actual receiving course passed **15 groups** in Chrome 156.0.8078.73 running as the existing unprivileged user. Namespace, PID/network, seccomp and TSYNC protections were verified. The course compares all **816 displayed numeric values** with native replay and all **1,800 rendered sample positions** with their original source samples across the 17 selected cycles; shared cycle endpoints can appear in more than one rendered trace. It includes actual source-only downloads, a fresh-document reopen, forged-derived-data rejection, retained v1/v2/v3 behavior, source/declaration invalidation, refusal budgets and delayed-read retirement.

At 390 CSS pixels, twelve actual ArrowRight presses reach the ledger's right edge. The 96-pixel sticky law column remains visible. Both the individual Residual and Pair residual sum columns fit fully to its right, including every header, sign and numerical value. Actual trusted pointer events must reach each requested click target. No application-page exceptions or external application-page requests were observed.

Visual review caught two receiving issues during reconstruction: a stale scroll position in the click harness and clipped leading residual digits beneath the narrow sticky law column. The receiver now rechecks stable hit geometry; the layout reserves enough width for both signed residual columns. The final successful course includes explicit complete-cell visibility checks, and root plus the independent worker inspected its rendered narrow table. These repairs did not change the scientific calculations.

The exact source hashes, input identity, native and smoke outcomes, browser checks and image hashes are recorded in [verification.json](receipts/cycle-work-halves-20261027/verification.json). The original image bytes were not retained in the recovery checkpoint; their historical hashes remain in that receipt. New captures have separate identities and must not be represented as those original images.

The observed trajectory was chosen over residual-only bars because it locates the calculations in the actual receiving motion. The exact signed ledger remains alongside it. This increment is not autonomous diagnosis, physical experiment execution or final product-design acceptance. Changing the declared rate window or sampled turning-point assumptions requires a separate explicit investigation.


## Current source recovery and receiving (October 28)

The eight retained text files were restored with their exact recorded hashes. On base `c0646ad6bff0dca3962fb5e5c4b61ab7f71db30a`, the focused half-cycle controls passed5/5 in an elevated Node v24.22.1 TAP run. The unchanged browser receiver then passed15groups on the actual product with namespace/PID/network/seccomp/TSYNC sandbox checks, using the original retained PASCO inputs. New desktop and390px trace/ledger captures were independently reviewed. The source-only downloads, exact displayed values, original sampled positions and keyboard ledger checks remained intact. This is a new execution, not a reuse of historical screenshot hashes.

The later current-main composition at `440591a3a60719a1d356054e7da162ba252f8700` passed the complete native gate: **1,606 passed, zero failed, one inherited optional-browser skip**, across1,607 tests on Node v24.22.1. Both maintained launched Studio and trajectory smoke commands passed. The incoming standalone `test-request.mjs` control also passed; it is outside the package test glob. Missing original fixtures/static assets were restored from exact canonical blobs; no source behavior was weakened to obtain these results.

All75 paths in the recorded browser dependency proof—including the actual requested product assets, server and harness—are byte-identical in this current composition. That establishes preservation of this scoped browser course without rerunning it; it does not qualify the new UNKNOWN LAB journey. See [current receiving](receipts/cycle-work-halves-20261028/verification.json) for exact commands, counts, hashes and the dependency proof. Two interrupted c064 native attempts remain incomplete historical runs, not full-suite passes. The original historical screenshot hashes are not reused for these new captures.

The final composition also preserves the six incoming affine-calibration paths on `54a8e71f36d3451de448fa6a427edcf4cf4038d5`. Three new calibration tests and20existing direct-API regression tests passed, as did both maintained smoke commands. None of the75 recorded browser dependency paths changed. The complete1,607-test run remains attributed to440591; it was not repeated or relabelled for this nonoverlapping incoming change.
