# Declared cross-coordinate inertia

Coupling Lab's **Let the laws move** can execute a constant symmetric inertia
matrix. Choose **Symmetric inertia matrix**, supply its shared off-diagonal
coefficient, declare the assumptions and compare. The existing diagonal choice
and its saved notebooks remain supported with unchanged solver arithmetic.

## Why this changes the experiment

The executed equation is `M q″ = τ(q) − diag(damping) q′`, with
`M = [[inertia1, cross], [cross, inertia2]]`. Each fitted torque candidate
uses the same declared matrix and the maintained simultaneous RK4 solver.
No new force fit or observation is introduced.

For unit diagonals, cross inertia 0.5, constant torque [1, 0], zero damping
and a zero initial state, one second gives position [2/3, −1/3] and rate
[4/3, −2/3]. The original diagonal declaration gives [0.5, 0] and [1, 0].
Thus cross-coordinate motion need not originate in a fitted cross-torque term.
This is an analytic conditional example, not physical identification.

## Admission and numerical meaning

All matrix coefficients use kg·m². The matrix must be symmetric positive
definite, with minimum eigenvalue at least 10⁻⁹ kg·m² and an infinity-norm
condition estimate at most 10⁸. Diagonals and the cross coefficient retain
the existing magnitude ceiling of 10⁶. These are explicit implementation
support limits, not inferred calibration or exact floating-point guarantees.
Both cross-coefficient signs are allowed.

The solver uses a scaled two-coordinate solve; the full comparison still
reserves every coarse/refined candidate before execution. Numerical failures,
step-sensitive trajectories, observed-range departures and all fitted
candidates remain visible. Agreement of the two step sizes is not a verified
error bound.

Symmetric fitted response modes use the Cholesky transform `M = L Lᵀ`,
`x = Lᵀ q`, and the transformed response `L⁻¹ K L⁻ᵀ`.
Original-angle directions, bias and damping use that same transformation.
Coordinate reconstruction and instantaneous-power residuals are reported.
A directional nonsymmetric response remains unsupported by the symmetric
mode view. Diagonalized stiffness does not generally diagonalize damping.

## Versioned, input-only replay

Matrix inputs use `worldlaw.coupling-dynamics-input/v2` and the interpretation
`position-torque-with-declared-symmetric-inertia-and-damping`, adding the
required scalar `inertiaCross`. Their notebook uses
`worldlaw.coupling-dynamics-notebook/v2`. No model or computed path is stored.
Reopening validates source and declarations and recomputes the current fits
and trajectories. Mismatched notebook/input versions refuse, so a version-1
consumer cannot silently ignore the cross coefficient. Legacy diagonal
inputs/notebooks retain version 1.

The UI invalidates old predictions when the declaration changes. Source
changes require the explicit dynamic interpretation again; invalid file
imports preserve the last valid evidence and predictions.

## Verification

```sh
node --test tests/coupling-inertia.test.mjs tests/coupling-dynamics.test.mjs tests/coupling-modes.test.mjs
BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-inertia-receipts \
node scripts/coupling-inertia-browser.mjs
```

The browser receiver launches its own application and profile, requires
observed active Chromium sandbox protections before navigating to the product,
and exercises real controls, computed paths, modes, refusal, download/reopen,
keyboard input, reduced motion and desktop/narrow layouts. Use a supported
direct browser executable; a wrapper that disables its sandbox is refused.

Native controls independently check constant-force motion, unequal diagonals,
axis exchange, analytic coupled oscillations, mechanical energy and damping,
generalized eigen-equations, coordinate/power preservation, schema boundaries
and held-aside-value invariance. Exact original diagonal study equality was
also checked against the retained predecessor for eight original courses.
Integration counts, exact head and consumer receipts belong in issue #157
and its PR.

Constant symmetric inertia does not model configuration-dependent mass
matrices or their velocity terms. Quasi-static torque observations do not
identify inertia, damping, topology or a physical apparatus. This increment
does not establish hardware acquisition, physical calibration, provider
qualification or deployment.
