# Challenge the odd rate response with original receiving pairs

Native outcome #215; candidate based on main8ea147b277c8baca2364832be360d6486837d77b, following merged energy accounting and continuous rate-law inspection. This increment consumes the existing complete held-out contrast report in the existing Studio. It adds no fitter, planner, acquisition route, observation schema or alternative simulator.

Import original fitting and held-out observations, then use **Inspect held-out prediction sensitivity** with the two declared reading radii. The existing complete receiving-pair selector marks exact matched reversals. Selecting one exposes the observed odd-response power and the conditional fitted range. Nonmatching pairs retain the original comparison without being treated as approximate reversals.

## Mechanism and assumptions

For two readings at exactly the same declared command and angle, with nonzero opposite signed rates r and−r, the source statistic is

`r * (torque_first − torque_second) / 2`.

A rate-independent torque offset cancels. Under a common response function at that declared state, this isolates rate times its odd-in-rate torque component. It does not establish that two acquisitions shared hidden state, preparation, time, calibration or independent provenance. Coordinate error is not bounded by this query. Positive odd-response power is not by itself a physical activity/passivity certificate.

The observed interval starts from the original two binary64 torque readings and the original declared receiving radius e: their exact rational difference±2e, multiplied by exact r/2. A negative first rate reverses the endpoints. This reuses the maintained bounded rational primitive. The declared separate reading boxes are worst-case bounds, not a claim of statistical independence. Exact sign and rational endpoints survive binary64 display underflow; outward display endpoints are retained internally. The interface rounds its main numbers only where explicitly marked **approx.**, while the exact observed rationals remain inspectable.

The predicted interval transforms the already computed shared-training QR contrast range. Its original floating-point and engineering-screen qualification remains unchanged. Exact unit scaling does not upgrade that original prediction to a certified uncertainty region. Original complete-pair compatibility, population and indices remain visible. No new subset is selected to improve the result.

The helper accepts only a freshly computed report in the current application call path. It is not a saved-report importer or a provenance authenticator. The existing source notebook saves the actual observations; reopening recomputes the fit and requires explicit redeclaration/recomputation of the reading-radius investigation. Derived reversal answers are never admitted as observations.

## Receiving evidence

Local Nodev24.19.0, real Chrome156 and the same qualified Studio source closure used for merged214 receiving. Existing APIs/source from main8ea147 were reused.

- `node tests/rate-reversal.test.mjs`:10 pass. Positive observed versus negative predicted response; row-swap invariance; wide bounds; exact touching-zero; subnormal positive sign; no near-coordinate/rate matching; training noninterference; exact common-offset cancellation; complete-pair indices; malformed/index refusal.
- `node tests/prediction-contrast.test.mjs`:12 existing tests pass, including all256 training-box corners, full128-row/8128-pair course, independent refit witnesses and original refusal behavior.
- `node tests/prediction-sensitivity.test.mjs`:11 existing tests pass, including receiving noninterference, zero/rank/work cases and original numerical qualification.
- Independent direct mechanism worker reviewed the core and independently executed all10new tests: no blocker within the freshly computed report contract; no independent UI acceptance claimed.
- `scripts/rate-reversal-browser.mjs` passed the actual authored input→complete pair comparison→positive observed sign→desktop/390px inspection→radius-change stale clearing→wide ambiguity→unmatched-pair refusal→actual notebook download/reopen→keyboard recomputation flow, with no page errors. Reduced-motion and overflow checks passed. Desktop/narrow screenshots were inspected. Main numeric precision was shortened with an explicit approximate label; exact bounds remain available.

Authored control: a fitted negative rate coefficient predicts approximately−0.0532182 to−0.0467818W under the original training perturbation screen. Separate authored receiving readings imply approximately0.095 to0.105W with receiving radius0.01Nm, retaining original outside disposition. Radius0.3Nm admits approximately−0.05 to0.25W and zero remains possible. These are controlled synthetic observations, not new physical measurements or blind data.

Reproduce with `npm start`, installed Playwright and Chrome, then `PLAYWRIGHT_MODULE=<module> CHROME_BIN=<browser> node scripts/rate-reversal-browser.mjs`. BASE_URL defaults to localhost4193 and ARTIFACT_DIR defaults to evidence/rate-reversal. No deployment or hardware actuation is involved. Exact publication and merged-source receiving remain separate native receipts.
