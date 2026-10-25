# Scalar input design before a torque forecast exists

Studio → next experiment → **Which permitted input breaks coefficient confounding?** investigates one explicitly selected subset of the currently offered scalar basis. Supply up to 128 permitted command/position/rate states, compare all of them, and copy an exact state to the maintained measurement controls. The apparatus does not acquire hardware observations. The nominal competitive-model disagreement proposal remains separate.

The input design uses the maintained torque feature evaluator with unit coefficients and the maintained normalized, pivoted QR rank diagnostic (tolerance 1e-8). It does not fit hypothetical torques. Every original training coordinate enters the calculation; measured torques, held-out readings, model rankings and residuals do not enter the prospective rank score. A full-rank basis, a still-deficient but improved basis, no offered gain, and complete-work refusal remain distinct. The earliest offered state wins an equal rank-gain tie, without a confidence interpretation. One new row can leave multiple unresolved directions.

Column normalization changes with an appended row, so numerical rank changes are diagnostics, not exact algebraic certificates. Full numerical rank does not establish conditioning, physical identifiability, response adequacy, or permission to execute a physical intervention. A subsequent acquired reading must be admitted by the actual fitter. The calculation refuses its entire course above 2,000,000 declared row-column-square work units; it does not thin the candidates or report partial success.

Save/open input-design case retains only the original complete Studio notebook, permitted coordinates and selected basis. Reopen recomputes the notebook and rank course. Changing the source or declarations removes previous findings; a delayed import cannot overwrite a newer source. Ordinary Studio save retains the actual resulting measurements and model revisions through its existing format.

## Executed authored control

Seventeen rows with command=2×position and torque=0.2+1.2×command−3×position have rank 2 for the three-term command/position/bias basis. Offering (command=1, position=0.5, rate=0) leaves rank 2. Offering (1,0,0) raises rank to 3. Receiving independently authored torque 1.4 then permits the maintained fitter to recover predictions on two separate coordinates within 1e-12. A wrong reading 100 also creates full rank, but causes a large held-back prediction failure. This negative control is why excitation is not reported as model validity.

Native verification: `node tests/excitation-design.test.mjs` (four groups). Actual sandboxed Chromium receiving: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE_PATH=/path/to/chrome node scripts/excitation-design-browser.mjs`. It imports the original authored source, compares by keyboard, completes source-only download/reopen, copies exact inputs into existing acquisition, records and refits, removes stale findings and checks desktop/390px layout. Evidence is an authored software experiment, not physical acquisition or blind physical validation.

## Experience decision

Considered a separate law-design plot and an instrument beside the existing next-measurement controls. The latter keeps the concrete action beside actual acquisition and preserves the original model/trajectory canvas. The complete numerical comparison uses a table because inputs and resulting ranks need exact inspection; no invented trajectory or forecast is drawn for a refused structure. Larger response-design visualizations remain outside this bounded feature.

The browser receiver reuses the existing maintained WORLDLAW `scripts/support/chromium-sandbox.mjs` without changing it. Before product navigation it requires the browser-owned chrome://sandbox page to report namespace, PID/network, Seccomp-BPF/TSYNC protections and adequate sandboxing. The complete admission receipt is retained. This is test support only.

## Executed product receiving, 25 October 2026

Composed source on upstream `730122e84929936929cf1526f595279962c1ff7e` passed 977 maintained native tests with one explicitly skipped cross-runtime course, zero failures, launched product smoke, and launched trajectory smoke. The actual scalar browser receiver passed six groups: original source intake, keyboard comparison, source-only download/reopen, precise input transfer into acquisition and refit, malformed-input invalidation and a delayed case refusing to overwrite a newer source. Desktop and 390 px layouts were received. Chrome 156's namespace, PID/network namespaces, Seccomp and TSYNC were observed before product navigation with the maintained sandbox helper.

Commands: `npm test`; `npm run smoke`; `npm run smoke:trajectory`; `PLAYWRIGHT_MODULE=/tmp/hamon-0c1ac4-browser/node_modules/playwright/index.mjs BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome BROWSER_ARTIFACT_DIR=/tmp/hamon-0c1ac4-worldlaw-receiving node scripts/excitation-design-browser.mjs`.

Independent root review found no blocking mechanism issue. Prospective rank ignores observed/future responses and held-out values; wrong acquired-response controls still fail prediction. Numerical rank alone does not quantify the amplification of reading errors. A separately implemented prospective sensitivity experiment remains a follow-on; no such assurance is implied by this rank comparison.

