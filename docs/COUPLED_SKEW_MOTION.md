# Declared skew velocity coupling in retained motion

The v4 coupled-motion input and notebook add a separately declared scalar
`velocitySkew`, with units `N·m·s/rad`, to the existing symmetric inertia and
symmetric loss model:

M q″ = τ(q) − D q′ − G q′, with G = [[0, g], [−g, 0]].

The maintained response predictor and the same simultaneous RK4 integrator
execute every retained response family. Positive-definite M and
positive-semidefinite D admission remain separate; g is a finite signed
coefficient within the declared executable magnitude limit. The old v1–v3
schemas reject the new field and retain their semantics. With g exactly zero,
the new force operation is skipped, preserving v3 numerical rows exactly.

## Original sources and explicit adoption

The velocity-comparison instrument retains its complete three-law fits,
conditioning diagnostics, coarser calculation and separate-motion outcomes.
An admitted candidate exposes an optional copy action only after the user
declares correspondence with the current response source. The action copies
editable M, D and G values, retains the source label and separate receiving
status in the declaration, and revokes motion consent. It does not run or
select a law. A changed response or velocity source revokes the pairing.

A numerically full-rank candidate rejected by the separate motion remains
visible and may be explored only as an explicitly declared conditional law.
Unsupported matrices and unidentified fits have no copy action. Copying an
older inertia/loss candidate or an existing proposed release clears a previous
skew declaration. The release planner still offers its original two loss
families; it does not gain a third family through this change.

The v4 download retains the response evidence and original declared inputs.
Reopening computes every trajectory again through the maintained solver.
Playback, plotting, step comparison, domain diagnostics and work reservation
use that same result. No receiving evidence resets a trajectory.

## Useful coordinates

The existing mass-normalized stiffness basis remains a representation of the
same trajectory. It does not in general decouple a velocity-coupled system.
For its force map F, inverse coordinate map L and orthogonal stiffness basis Q,

G_mode = Qᵀ F G L Q.

The existing inertia factorization supplies F and L. For the tested
M=[[2,.3],[.3,1]], g=.7 control, the transformed off-diagonal is
.7/sqrt(1.91)=.5065022237046952. Rotating G without the inertia maps would
incorrectly retain .7.

Displayed stiffness reference frequencies omit both D and G. They are not
the full gyroscopic modal frequencies. Repeated stiffness eigenvalues still
leave the displayed stiffness axes ambiguous.

## Power and energy accounting

The new inspector consumes only the retained refined output samples. It does
not add solver steps, fit another model or alter state. It reports

- kinetic energy T = ½ vᵀ M v;
- applied response power vᵀ τ(q);
- symmetric loss power vᵀ D v;
- separately computed skew power vᵀ G v.

Skew power is zero algebraically. Its displayed floating-point residual is
kept as a numerical diagnostic; skew is never counted as dissipative loss.

For a symmetric affine response τ(q)=Aq+b, the potential is
V(q)=−½qᵀAq−bᵀq. The sampled total-energy residual is
(T+V)−(T₀+V₀)+trapezoidal integral(vᵀDv). Nonsymmetric response laws retain
kinetic and power accounting, with potential, total energy and conservative
energy residual explicitly unavailable.

All work sums use the original output grid. Solver and quadrature errors,
poor temporal resolution, observed-domain departures and failed trajectories
remain visible. Small residuals are not verified error bounds or physical
validation. No physical gyroscope, damping mechanism or body topology is
identified by a successful conditional comparison.

## Independent controls

`tests/coupling-skew-dynamics.test.mjs` uses signed analytic circular motion
and an independent scaled-Taylor/squaring 5×5 affine matrix exponential for
dense M, D, bias and both signs of G. It checks exact zero-G v3 parity, source
custody and schema refusal, the full work budget, non-diagonal-inertia power,
conservative versus nonsymmetric energy, and the actual mass-congruent
mode transformation.

Browser receiving and artifact instructions are in
`docs/SKEW_MOTION_RECEIVING.md`. No physical or deployment qualification is
implied by the numerical and maintained-browser controls.

