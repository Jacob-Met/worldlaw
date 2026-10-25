# Repeated errors in a frozen trajectory

Trajectory Challenge's **Does the prediction repeat its mistakes?** instrument
receives the currently selected complete forward prediction. It pairs original
observed-minus-predicted angles at explicitly declared sample lags. The scatter
plot shows every pair, with earlier error horizontally and later error vertically;
the ledger retains original row indices and actual times. A diagonal pattern can
reveal persistent discrepancy that aggregate RMSE conceals. An opposite diagonal
can reveal alternating discrepancy. Neither pattern identifies a physical cause.

## Calculation

The imposed first position is excluded. For the remaining errors e_i, compute
the complete receiving mean m, RMSE and centered RMS. For each lag k, the centered
cosine is sum((e_i-m)(e_(i+k)-m)) divided by the two vector norms. This uses one
global receiving mean, not separate pair means or a fitted trend. It is a
descriptive cosine, not an unbiased autocorrelation estimate or a significance
test. Constant error has undefined centered cosine; its bias remains visible.

The squared-difference ratio is sum((e_(i+k)-e_i)^2) divided by
sum(e_i^2+e_(i+k)^2). Constant nonzero error gives zero, equal alternating error
gives two, and zero error gives an undefined ratio. Errors are scaled before
forming products to retain very small nonzero signals.

All lags retain at least two pairs. Up to64 distinct lags and100000 pairs are
admitted by the consumer; exceeding the whole population budget refuses before
partial analysis. Sample gaps retain their actual minimum/maximum seconds:
irregular clocks are not resampled and sample lag is not a physical frequency.
Changing lag inputs or selected source/model clears the earlier result.

## Source and interpretation

The diagnostic recomputes errors from original observed and predicted fields;
cached residual fields are not trusted. It neither fits nor ranks a model.
Existing source-only notebooks reopen through the existing solver and the
instrument can then be recomputed. Exploratory lag settings are not stored as
frozen prospective declarations. Overlapping pairs reuse observations. Error
structure can arise from initial conditions, numerical integration, observation
or clock errors and omitted physics. It supplies no calibrated confidence,
probability, causal attribution, frequency identification or physical validation.

The chosen scatter instrument directly confronts pairs of actual prediction
errors and exposes their original samples. An alternative lag bar chart was
considered; it hides the individual pair geometry and irregular timing, so the
scatter+ledger is used. Desktop/narrow visual acceptance must be recorded from
the real app before integration; source creation alone does not establish it.

## Executed native controls

Seven independently specified native groups pass locally on Node24.19.0:
equal-RMSE coherent versus alternating courses; constant-zero/bias distinctions;
initial-condition exclusion and copied source custody; irregular time gaps;
malformed/full-budget refusal;1e-300 nonzero errors; and direct unscaled formula
agreement over three lags. The authored equal-RMSE courses both have RMSE1 rad,
while lag1 centered cosines are5/7 and−1 respectively. These are software
controls, not measured physical accuracy. Run `node tests/residual-structure.test.mjs`.

## Browser receiving environment

The receiving harness uses the installed `playwright-core/index.mjs` ESM entry
via `PLAYWRIGHT_MODULE`, and Chrome at `/opt/google/chrome/chrome` via
`BROWSER_EXECUTABLE_PATH`. It launches with `chromiumSandbox: true` and first
opens `chrome://sandbox` to require active Namespace Sandbox, PID namespaces,
Network namespaces and Seccomp-BPF sandbox. It records the actual browser version,
both exact environment paths, individual checks and original status text in
`sandbox.json`; `sandbox.txt` retains the original text alongside the local receipt.
Keep the text receipt local; the existing distribution policy admits JSON/PNG
receipts, not arbitrary text files. No browser sandbox-disable flag is used.

The broker-validated absolute module path is
`/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs`.
From the received repository:

```sh
PLAYWRIGHT_MODULE=/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs \
BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-residual-receiving \
node scripts/residual-structure-browser.mjs
```

The final ten browser groups passed on Node22.23.4 and Chrome156.0.8078.47,
including actual Namespace/PID/network/Seccomp preflight, source-only notebook
reopening, delayed/rejected source replacement, exact raw ledger precision and
all SVG label bounds at1440px and390px. The raw-ledger regression failed on the
original five-digit display before the correction. Lead visual review also found
clipped signed axis labels; an explicit left viewBox gutter preserves point
coordinates and makes every signed label visible. Actual captures and the
complete scoped receipt are in docs/receipts/residual-structure-20261025.

## Pinned source-to-solver identity

The native integration course used main commit
`a5819cab6e84b8a47d48883665efbeaa1f2e73e8`, the default
`examples/trajectory-pendulum-92be.json` (SHA-256
`fdd21c54935b274c6e007e2ed3e9356c36c5ef90f8bed266052b5af78170701e`),
and the maintained `createChallenge` path. Its selected law was
`command+rate+gravity+bias`, receiving run `challenge-wide-release`:161 original
rows,160 receiving errors after initial exclusion,622 pairs at sample lags1/2/5/10.
Diagnostic RMSE was0.0006991162096238898 rad; original solver RMSE was
0.0006991162096238899 rad. The browser exports and reopens the maintained
source-only `worldlaw.trajectory-notebook/v1` workflow through its
normal notebook receiver; the exact downloaded schema and bytes are retained in
the browser receipt directory. This is authored-source consumer qualification,
not physical validation, installation or deployment.
