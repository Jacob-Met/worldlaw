# Inertia from synchronized motion and declared torque

Coupling Lab can fit a constant symmetric two-coordinate inertia and diagonal
viscous loss from a separate motion record. Open **Estimate inertia from a
separate motion record** beneath the conditional-motion experiment. Import raw
observations or an input-only investigation, inspect the original angles and
weighted torque balances, then explicitly copy supported coefficients into the
existing motion experiment. The quasi-static response notebook stays separate.

This is parameter estimation in an offered balance law. Full rank, small
residuals and stable resampling do not establish physical inertia or discover
all forces. The included omitted-force course demonstrates that limitation in
the actual consumer.

## Input and custody

The raw schema is `worldlaw.coupled-inertia-observations/v1`:

```json
{
  "schema": "worldlaw.coupled-inertia-observations/v1",
  "units": {"time": "s", "position": "rad", "torque": "N·m"},
  "interpretation": "constant-symmetric-inertia-with-diagonal-viscous-loss",
  "torqueDeclaration": "Declare the complete supplied RHS, excluding the separately modeled viscous loss.",
  "source": {"label": "Original acquisition reference", "description": "Calibration, synchronization and coordinate conventions"},
  "courses": [{"id": "run-1", "rows": []}]
}
```

Each course needs at least five rows, each exactly
`{time, position: [q0,q1], torque: [tau0,tau1]}`. The empty array above describes
the envelope, not an admissible recording. Clocks must increase strictly within
each course; courses keep their separate clocks and source indices. There may
be one to six uniquely named courses and at most 6,000 rows in total. Numbers
must be finite numbers, not coerced strings or nulls, with absolute magnitude
at most 1,000,000. Units and interpretation are exact declarations. Unknown or
derived fields, sparse arrays and accessors are refused. Files are bounded to
3 MiB and admitted data is deeply copied.

Torque components must be work-conjugate to the supplied angles, in the same
order and sign. Spatial sensor torque may need a coordinate transformation.
All RHS forces except the separately fitted viscous loss must be included.
Neither file admission nor a source label authenticates that physical claim.

Saved `worldlaw.coupled-inertia-investigation/v1` files contain exactly `schema`,
`record` and `settings`. Settings contain `windowSamples` and `stride`. Fits,
residuals and coefficients are recomputed; forged saved verdicts are refused.
Original source strings render as text. A later input/source action invalidates
an outstanding asynchronous read, including its pending status.

## Offered balance and weak equations

The offered model is

\[
\begin{bmatrix}M_{00}&M_{01}\\M_{01}&M_{11}\end{bmatrix}q''
+\operatorname{diag}(D_0,D_1)q'=\tau.
\]

The five fitted columns correspond to `M00,M01,M11,D0,D1`. Inertia uses kg·m²;
damping uses N·m·s/rad. Configuration-dependent inertia, cross damping, missing
forces and other structures are not searched by this increment.

For a source window `[t0,t1]`, put `T=t1-t0`, `u=(t-t0)/T` and
`phi=u²(1-u)²`. Both `phi` and its first derivative vanish at the endpoints.
Integration by parts yields the acceleration feature `integral(q phi'')`,
velocity feature `-integral(q phi')` and RHS `integral(tau phi)`. Dividing by
`integral(phi)=T/30` gives weighted mean torque equations. No pointwise
acceleration difference is taken.

The two rows from a window are

```text
[A0, A1,  0, V0,  0] · coefficients = F0
[ 0, A0, A1,  0, V1] · coefficients = F1
```

Three-point Gauss quadrature integrates the represented piecewise-linear angle
and torque interpolants against the polynomial weights exactly, apart from
floating-point arithmetic. This does not make the unknown physical trajectory
piecewise linear or remove observation noise and interpolation bias.

The implementation removes the affine angle trend analytically, whose weak
acceleration is zero and whose mean velocity is known. This prevents constant
rate from acquiring false inertial rank through cancellation. Explicit
machine-precision feature floors suppress residual roundoff; these are
numerical diagnostics, not claims about sensor resolution.

Windows use 5–401 source rows and a positive stride smaller than the width.
The last source endpoint is always included. A window must span at least
1e-8 seconds. The complete original/coarser comparison is reserved before
integration and refuses more than 100,000 quadrature segments. The maintained
`src/science/linear-fit.mjs` supplies normalized least squares and rank; the
maintained inertia receiver supplies positive-definite numerical admission.

## Reading the result

- `unidentified`: the offered five-column library is not numerically full rank;
  no fabricated coefficient vector is supplied.
- `candidate`: the unconstrained estimate is within the supported constant
  positive-definite-inertia/nonnegative-damping family.
- `outside_supported_family`: coefficients and residuals remain inspectable,
  but the estimate cannot be copied into the solver. This does not prove that
  every member of the physical family is impossible.

The normalized QR pivot ratio is the maintained numerical fit diagnostic. It
is not a spectral condition number, parameter covariance or physical
identifiability score. Overlapping windows are correlated. The weighted
balance RMSE is in N·m and is not an independent trajectory-prediction score.

The source comparison keeps every second original row and the final endpoint,
adapting the row window/stride and preserving original row identities. Its
coefficient differences show sensitivity to the represented samples. They are
not an error bound, confidence interval or independent evidence. A too-small
window explicitly has no coarser-source comparison.

Copying parameters requires an explicit same-apparatus/coordinate declaration.
It copies only inertia and damping into the existing experiment, clears its
dynamic consent and invalidates the prior simulation. The user must review
and declare the motion experiment again. No quasi-static evidence is refitted,
no motion record becomes a measured response, and no simulation starts merely
because a fit is available.

## Independent controls and a causal counterexample

`createInertiaExample()` uses independent closed-form damped normal modes,
sampled at 801 times. Its known matrix is `[[1.4,.4],[.4,1.4]]` with damping
`[.2,.2]`. The known coefficients are described in source text but are not
supplied to the fitter. A separate initial state is predicted through the
maintained coupled solver and compared with the analytic solution to 1e-6 rad.

`createInertiaCounterexample()` deliberately supplies incomplete actuator
torque for `q=[sin(t),cos(2t)]`. True inertia is `[[2,.3],[.3,1.5]]`, damping
`[.2,.4]`, and the restoring springs have coefficients `[.5,.8]`. The fit
returns approximately `[[1.5,.3],[.3,1.3]]`, rank 5, tiny balance residuals and
small coarsening differences. Adding the omitted restoring contribution back
recovers the true inertia. This implemented causal comparison shows why a
convincing balance fit does not authenticate the force declaration.

Independent reviewers additionally tested an irregular-clock cubic/quintic
course, nontrivial time scaling, affine zero-inertia-feature controls, odd final
source endpoints, negative-force refusal, and the actual consumer's source
custody and adoption path. There is no independently acquired physical record
or blind physical validation in this increment.

## Product composition and receiving

The selected composition places original angle traces and weak torque balance
side by side, with a shared original-source window inspector. A stacked
desktop alternative was also rendered with the same actual data; it separated
the two observables across a long scroll. The parallel layout keeps both in
view, while narrow screens stack the plots and label every coefficient and
sampling difference. The first rendered pass exposed low plot contrast and a
cramped narrow table; both were corrected and rendered again.

On source `8837c2f365200d7d304fd9f3eef4bf440b71571e` plus this candidate, Node 22.23.4
passed 761 of 762 complete native tests with one inherited opt-in skip and no
failures. Both launched product smokes passed. Actual sandboxed Chrome 156
passed 16 identification receiving groups and all 12 retained matrix-motion
groups, including keyboard, reduced motion, input-only downloads, raw reopen,
source changes, negative cases, desktop 1440 and narrow 390 layout. These counts
are a pinned receiving baseline; current-source composition is recorded in the
native PR and adjacent versioned receipts.

```sh
node --test --test-concurrency=2 tests/*.test.mjs
npm run smoke
npm run smoke:trajectory
BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-identification-receiving node scripts/coupling-inertia-identification-browser.mjs
BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-inertia-regression node scripts/coupling-inertia-browser.mjs
```

The browser courses use the maintained sandbox-status admission helper before
product navigation. Screenshots are from the running application. Passing
these courses does not imply installation, live adoption, physical accuracy,
hardware operation or submission. Existing prospective acquisition #71,
nonlinear-response #48 and the manual/draft PR #9 hold remain separate.
