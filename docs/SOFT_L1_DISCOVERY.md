# Explicit reading-loss comparison in the Discovery Studio

The Studio can compare its ordinary least-squares fit with an explicitly chosen
soft-L1 fit. The second loss reduces the influence of large torque residuals.
It does not identify faulty readings, estimate a contamination probability, or
establish that a physical mechanism follows the selected law.

## Use the maintained product

Run `npm start` and open the Discovery Studio. Import the supplied
`examples/synthetic-reading-spikes.json`, or your own supported observations.
Open **Fitting assumptions**, choose **Soft-L1**, declare a transition scale in
N·m, then select **Refit observations**. The current law, alternatives, dynamics,
and acquisition proposal use that explicitly applied fit. Editing a control
alone does not change the displayed law.

The selected model keeps its raw training RMSE and every original residual.
**Inspect every original reading and its loss influence** shows the complete
source order, command, angle, rate, observed torque, residual and relative loss
weight. A weight is a property of this chosen loss, not measured reliability.
The original least-squares result remains in history. **Undo** returns to it;
choosing least squares and refitting records another explicit revision.

## Numerical contract

For residual `r` and caller-declared scale `s`, minimize

```
sum s² (sqrt(1 + (r/s)²) - 1)
```

The implementation evaluates each term as
`r² / (hypot(1,r/s) + 1)` to avoid cancellation near zero. Its score derivative
is `r / hypot(1,r/s)` and its positive curvature is
`hypot(1,r/s)^(-3)`. Newton directions and the positive-weight IRLS fallback
both reuse `fitLinearColumns` from the maintained column-normalized QR module.
An Armijo line search accepts each step. The numerical stationarity criterion
is the maximum absolute column gradient divided by that column's Euclidean
norm and `sqrt(rowCount)`, at most `1e-8 * s`.

Each original estimable structure must complete its numerical solve. A rank
failure, coefficient limit and an unresolved optimization remain different
outcomes. An unresolved candidate refuses the whole robust comparison; the
product does not report a best law from a silently reduced search. The existing
rank and executable-coefficient limits remain in force. Stationarity in floating
point is not a certified interval bound or physical identification.

The ranking heuristic is

```
n * log(max(mean(twice_soft_l1_loss), noiseSigma²)) + termCount * log(n)
```

This keeps the existing noise-floor and complexity convention while changing
the explicitly declared loss. It is not a likelihood, posterior, or calibrated
confidence score. All candidate coefficients, ranking and proposed inputs use
training observations only. Held-out observations remain separate evaluations.
The default least-squares result and its score are unchanged.

The loss definition agrees with the primary
[SciPy least-squares documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html).
`independent-review/soft-l1-oracle.py` optionally compares the maintained solver
against SciPy on separately authored fixed-design cases. SciPy is not a product
runtime dependency.

## Complete work and replay

The whole offered candidate library reserves work before optimization starts.
Every candidate reserves its initial fit, up to 64 iterations, both QR directions
and both complete 24-step line searches. The common accounting uses
`softL1Work`; its units are a conservative row/column-work measure, not elapsed
time or exact hardware instruction counts. The per-discovery limit is
250,000,000 units. No row subsample or shorter candidate list is substituted.
The standard seven-term, four-term-maximum, 121-row control reserves 176,425,623
units. A 400-row search at the same settings refuses before fitting.

Input-only notebook history uses `worldlaw.session/v3` whenever it has contained
a soft-L1 choice, including a later return to least squares. Older envelopes
cannot silently carry that history. Reopening starts from the original evidence;
serialized models are not accepted as evidence. Eligible least-squares
assumption revisions retain the private fresh-fit reuse introduced in #245.
Every soft-L1 revision deliberately runs complete discovery, including changes
of scale or noise. Returning to least squares also starts with a complete fit,
so no robust coefficients can enter the ordinary-fit cache. The complete robust
replay reserves at most 2,000,000,000 work units before execution, and new
revisions enforce the same limit so an accepted notebook remains replayable.
Existing v1 and v2 histories retain their original semantics.

The state-omission, coefficient-error and prediction-error tools remain explicit
ordinary least-squares comparisons of the inspected structure. When inspecting
a soft-L1 model, the interface says their refit shifts include a change of loss.
Their ranges are not sensitivities of the nonlinear soft-L1 estimator.

## Evidence and retained failures

The authored development course has 121 training readings from actuation,
linear spring and quadratic drag, with five declared ±12 N·m reading spikes.
Its separate 83-row authored course is never passed to the fitter. The unchanged
least-squares selection omits actuation and gives about 1.00623 N·m error on that
course. At the declared 0.03 N·m soft-L1 scale, all 99 original estimable
candidates finish; the selected three-term law gives about 0.00352660 N·m.
Its raw training RMSE is still about 2.43867 N·m, and its mismatch remains
visible. This is a development control, not blind or physical validation.

The adverse high-leverage control remains a failure: one contradictory reading
at a much larger coordinate can pull the soft-L1 slope far from the authored
law. Coherent missing physics and majority contamination are also outside the
claimed benefit. A small scale can leave candidate optimization unresolved; the
native and browser controls exercise an actual iteration-limit refusal and
verify that no successful fallback or altered notebook appears.

Run the focused controls with `node tests/robust-fit.test.mjs`. Run
`npm run verify` for native regressions and both launched-product smokes. With
the documented Playwright/browser environment, run
`node scripts/soft-l1-browser.mjs` for the actual import, fit, original-reading
inspection, dynamics, download, undo, reopen, refusal and narrow-screen course.
The browser receiver requires the Chromium sandbox and records its controls,
source digest, screenshots and observed metrics. Exact published and merged
source receipts are attached to the native issue and PR.
