# Compare original-position noise covariance

The ordinary **Trajectory challenge → Which law predicts another recording?**
panel has an optional **Compare position-noise covariance (smooth terms)** action.
The default comparison is unchanged. This action adds one separately labeled
prediction for the already selected structure; it never replaces the original
law or selects a winner from the separate challenge errors.

This addresses a concrete weakness of target-only weak-equation weighting:
the same noisy positions enter both the target and the feature columns. The
earlier target-only experiment retained under
`docs/receipts/prepared-rollout-287/whitening-rejected.json` did not justify
promotion. The new option uses the complete local residual derivative. It can
still make a separate prediction worse, as the retained controls below show.

## Method and boundary

For one original recording and its maintained compact weak windows, write
the residual as `r(q, β) = b(q) − A(q)β`. The original position samples are `q`,
and the already selected coefficients are `β`. Each iteration differentiates
the complete residual with respect to the original samples:

```
J = derivative(b) − sum_j β_j derivative(A_j)
C = J Jᵀ
```

This assumes independent, equally variable original-position errors, including
independence between distinct recordings. Their common unknown variance
cancels from the coefficient update. Recording blocks never share covariance
merely because their local sample indices or timestamps coincide.

The implementation differentiates the actual maintained piecewise-linear
operator. Linear rate uses its existing integration-by-parts form. Supported
smooth terms are linear rate, linear position, sine, cosine, cubic position
and constant. Nonsmooth or nonlinear-rate terms are refused explicitly; a
selected friction term is never silently omitted to make the comparison run.

Each block uses a compact-band Cholesky factor, whitening both target and all
feature columns before the maintained scaled QR solve. No diagonal substitute,
regularization jitter, partial-window result or hidden fallback is used. The
structure is fixed throughout. Original inputs, supplied initial rates and
separate challenge values never enter coefficient selection through another
path. Only original training positions determine this comparison.

Default convergence means the coefficient update norm is below1e-9 in the
fixed coefficient coordinates, within10 iterations. This is an iteration
criterion, not a likelihood, calibrated uncertainty, confidence interval,
global optimum or physical identification claim. First-order covariance does
not correct every nonlinear noise bias, quadrature error or unrecorded force.
The original weak ranking is not attached to the new model as though its
score remained applicable.

The complete request is bounded before covariance allocation:1024 windows,
2million derivative entries and40million reserved arithmetic work units.
The iteration cap is12. Singular, ill-conditioned, unsupported and over-budget
courses retain their refusal; an unfinished iteration sequence has no
executable refined model. Separate prediction work has its own reservation.
If that extra comparison cannot run, the completed baseline remains available.

Weak-form errors-in-variables estimation has a broader literature, including
[WENDy](https://arxiv.org/abs/2302.13271). This implementation is derived for
WORLDLAW's own operator and consumer; it does not claim to reproduce that
paper's algorithm or statistical qualifications.

## Independent courses, including losses

The update rule and stopping criterion were fixed before the following40
unfamiliar courses. A separate Python SciPyDOP853 oracle generated both original
noisy training positions and a clean release with different initial conditions
using rtol1e-12, atol1e-13 and PCG64 seed0x51A7E29. The production JavaScript
integrator did not generate these observations. Every course is retained in
`docs/receipts/position-covariance-292/unfamiliar.json`.

| Family | Courses converged | Original mean position RMSE/rad | Compared mean/rad | Improved courses |
| --- | ---: | ---: | ---: | ---: |
| Linear restoring | 8/8 | 0.002433344 | 0.000633485 | 7/8 |
| Sine restoring | 8/8 | 0.001813748 | 0.000815179 | 7/8 |
| Cubic restoring | 8/8 | 0.002949679 | 0.003222367 | 4/8 |
| Correlated position noise | 8/8 | 0.007969675 | 0.005055011 | 6/8 |
| Unrecorded external forcing | 8/8 | 0.039199487 | 0.042179408 | 4/8 |

The cubic and forced family averages get worse. Correlated noise deliberately
violates the independence assumption; apparent improvement there does not
validate that assumption. All40 converged, in3–7 iterations, so convergence
alone would have hidden these losses. On the measured local Node24.22.1 run,
comparison time was median17.505ms, range11.000–64.514ms; these timings describe
this fixture/run only and are not a baseline performance claim.

A source-position finite-difference check rebuilds both sides of the full
operator at1656 entries; maximum discrepancy2.364e-10. A separate contributor
implemented105 irregular-clock derivative checks (maximum8.129e-11) and a dense
two-recording covariance/GLS oracle using pivoted Gaussian elimination rather
than the production banded factor and QR. Its first coefficient update agrees
within9e-16. A one-iteration control remains unfinished and exports no model.

## Existing measured PASCO recording

The maintained `examples/physical-pasco-92be.json` is also received through the
actual predictive session. Its original source provenance remains in that
example and its guide. Bundle SHA256:
`7e42868153d3aa15fc9722f665f5ed62cc491c4445768f8db74a6e36b85cb0e6`.

The default predictive selection contains a Coulomb-friction term and reaches
0.089510rad challenge RMSE. Covariance comparison explicitly refuses that
unsupported structure and retains the default forecasts. An explicitly offered
smooth library selects rate+sine+cosine; its RMSE changes0.223760→0.204451rad
after4 updates. That remains worse than the maintained nonsmooth selection.
Neither the library nor model is replaced automatically. This is reused
measured-data development evidence, not newly acquired or blind physical
validation. Detailed outcomes are retained in `pasco.json` beside the other
receipts.

## Consumer, replay and source integrity

The original training and challenge remain separately visible. Covariance
updates and assumptions can be expanded; its extra trajectory is teal and its
table row is labeled separately. Unsupported measured laws show the specific
refusal. The chart and original rows return exactly when the option is switched
off. The existing trajectory scene and notebook remain the primary workflow.

Source-only `worldlaw.predictive-notebook/v3` stores the original bundle,
selection settings and explicit covariance request, with optional existing
forward-refinement settings. Derived fits/results are not trusted on reopening.
The session snapshots finite scalar JSON options before execution, so an
undefined/NaN/function request cannot change meaning during serialization.
Unmodified default/v1 and optional-forward/v2 states and notebook bytes have
exact parity against the pinned prior session on8 varied comparisons.

The candidate is composed on `1f877ec8d966c2a4d85cc4d1f0a2c52bb1cb082c`, retaining
the applied-restoring and scalar-library proposal consumers. All1173 original
base blobs were independently hashed before applying the candidate. Root's
Node22 receiving passed52 affected native groups across covariance, predictive,
forward refinement and shared forced/unforced weak operators. The actual
Chrome156 consumer passed11 groups: ordinary original-bundle intake,
default-off and keyboard activation, unchanged original outputs, raw save/fresh
reopen with forged answers ignored, changed training input, iteration refusal,
missing v3 request, measured friction refusal,320/390px controls and return to
the exact original visible chart. Namespace/PID/network/seccomp/TSYNC sandbox
admission passed. Actual pixels are inspected independently of those assertions.

## Reproduction

```
python experiments/position-covariance-oracle.py /tmp/position-covariance-inputs.json
node experiments/position-covariance-receiving.mjs /tmp/position-covariance-inputs.json /tmp/position-covariance-unfamiliar.json
node experiments/position-covariance-pasco.mjs /tmp/position-covariance-pasco.json
node experiments/covariance-independent-receiving.mjs
node --test tests/covariance-comparison.test.mjs tests/predictive-selection.test.mjs
```

The oracle run used Python3.12.14, NumPy2.3.5 and SciPy1.17.0. The browser course
is `experiments/position-covariance-browser.mjs`; set `PLAYWRIGHT_MODULE`,
`BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable` and a writable
`BROWSER_ARTIFACT_DIR` for the maintained strict-sandbox environment. It launches
its own loopback product server. Legacy parity additionally requires
`BASELINE_SESSION` pointing to the unchanged session module from pinned
`15bb784a33355659b186cfe9632a6b67ebe25c91`, with its ordinary dependencies.

### Final composition checkpoint

Incoming competitive scalar-library proposals were preserved on `ba77ab729db3558d01cfe63fbe545be5f684281e`. Root reran55 affected native groups and all11 actual strict-sandbox browser groups. The new controls/charts were visually inspected at desktop and390px, including focused panel captures. The8 exact legacy parity comparisons and independent scientific experiments above are unchanged. Final published-tree hashing precedes the ordinary merge.

The final publication also preserves the incoming applied-restoring reference contract at `9326de97e32730bbfb3c72ea9ce6b9f5b303f892`. Its composed source passed 63 affected native groups and all11 actual browser groups before publication.
