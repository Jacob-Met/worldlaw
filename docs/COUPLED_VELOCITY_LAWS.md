# Compare dissipative and skew velocity coupling

The coupled-motion investigation now offers three constant laws from one
explicitly declared original source:

- M q″ + diag(D) q′ = supplied torque (five coefficients).
- M q″ + D q′ = supplied torque, with symmetric D (six coefficients).
- M q″ + (D + G) q′ = supplied torque, with G = [[0,g],[-g,0]]
  (seven coefficients).

Every law fits its own constant symmetric inertia M. Supported candidates
require positive-definite M and positive-semidefinite symmetric D. The skew
coefficient is separate from that damping admission. For any real velocity v,
vᵀGv = g v0 v1 − g v1 v0 = 0. This algebraic identity does not establish the
physical cause of an observed coupling, calibrated passivity, or identification.

The matrix convention follows the damped gyroscopic system formulation in
[Datta and Sarkissian, Computational Methods for Feedback Control in Damped
Gyroscopic Second-order Systems](https://faculty.niu.edu/math_dattab/pdfs/cdc02-reg1055.pdf),
equation (1). This implementation compares an offered constant velocity library
against supplied torque; it does not implement that paper's feedback algorithms
or identify a rotor.

## Maintained weak operator and complete work

No position differentiation is introduced. The existing weak operator integrates
original piecewise-linear angles and supplied torque against its endpoint-
vanishing test function. Its original five columns are extended using the
paired coordinate's weak velocity. With a0,a1 and v0,v1 denoting those weak
features, the new columns are:

| Balance | M00 | M01 | M11 | D00 | D11 | D01 | G01 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Coordinate 0 | a0 | a1 | 0 | v0 | 0 | v1 | v1 |
| Coordinate 1 | 0 | a0 | a1 | 0 | v1 | v0 | −v0 |

The maintained normalized linear-column QR fits the complete offered library.
There is no parameter clipping, projection to a preferred law, or automatic
family selection. Unidentified and inadmissible unconstrained fits remain
visible; inadmissibility does not exclude every admissible law.

Before fitting, the comparison reserves three complete training evaluations
plus one shared separate-source evaluation, each including original and
available coarser sampling. The aggregate limit is 100,000 quadrature segments.
All three training fits and their alternate fits finish before separate-source
equations are evaluated. Each separate row receives the frozen coefficients and
the source's declared coordinate tolerances.

## Why full numerical rank is insufficient

The authored controls are executable in the ordinary consumer. Their original
angles and torques come from analytic motions, independently of the fitting
kernel; they are not physical measurements.

For circular q=(cos(ωt),sin(ωt)) and isotropic inertia mI, the acceleration and
skew-velocity columns identify only m−g/ω. One uniformly sampled frequency
correctly gives rank 4 in the seven-column library. Irregular sampling can break
that represented column dependence through interpolation even though the
continuous motion remains ambiguous.

The adverse irregular single-frequency control therefore deliberately retains
a full-rank, admissible but wrong candidate: g≈−1.2872 instead of the authored
0.3, with normalized QR pivot ratio about 1.12 million. Coarser sampling changes
g only about 0.0033 while both estimates remain wrong. Separate-frequency
receiving rejects it with weak residual RMSE about 0.5450 N·m.

Two distinct training frequencies produce a well-conditioned offered library
in the companion control. It estimates g≈0.3000099 and receives the separate
frequency with RMSE about 1.12×10⁻⁵ N·m; symmetric loss alone has approximately
0.0123 N·m. A no-skew control admits both symmetric and expanded families,
without automatically choosing the larger law.

These examples establish numerical behavior for these sources. Numerical rank,
a QR pivot ratio, lower training error, and coarser-source agreement are
diagnostics—not confidence intervals, error bounds, or physical identification.
Unmodeled forces, changing parameters, sensor mixing, and calibration can
imitate coupling. Separate receiving uses observed angles; it is not a
future-motion forecast.

## Source and consumer

The new source declaration uses worldlaw.coupled-velocity-study/v1 and
worldlaw.coupled-velocity-observations/v1, with interpretation
compare-viscous-and-skew-velocity-coupling. Existing viscous schemas and motion
schemas keep their prior semantics. Source limits and original numeric admission
reuse the maintained observation reader; combined JSON is limited to 7 MiB.

The instrument is a sibling of the viscous comparison inside the inertia
investigation. It exposes all three statuses, coefficients, original/coarser
changes, rank, QR diagnostics, separate-source residuals, and exact window
records. The residual plot displays a two-coordinate norm per original window;
acceptance still uses each declared coordinate tolerance.

Changing a source or setting retires the old result and disables export. Late
file reads cannot overwrite a newer choice. Downloaded studies contain original
records and declarations only; reopening recomputes every fit and score.

No new coefficient is silently adopted into the response notebook, motion
playback, modes, or release planner. Those consumers retain their admitted
diagonal/symmetric-loss laws. Propagating a skew candidate through future motion
requires a separately qualified integration and an explicit same-apparatus
decision.

## Verification

Eight native groups cover the analytic controls, an independently authored
unequal/coupled inertia and reversed held rotation, frozen-training invariance,
strict source admission, exact source replay, and complete work refusal.
Independent Workshop review reproduced all seven coefficients to maximum
error 1.50×10⁻⁶ on its unfamiliar control and verified held-source failure without
training changes. The actual browser receiver covers the three-law journey,
misleading rank, refusal states, download/reopen, late reads, keyboard operation,
and 1440/390 layouts. See VELOCITY_RECEIVING.md for the maintained commands.
