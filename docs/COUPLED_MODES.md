# Useful coordinates for conditional coupled motion

This instrument changes the representation of a retained motion comparison. It does not learn inertia, physical topology, or new observations. The evidence is the same Coupling Lab notebook, fitted by the maintained analysis; the trajectory is the existing conditional RK4 comparison.

For a symmetric fitted response `τ = Kq + b`, the declared positive diagonal inertia is `M`. Write `S = sqrt(M)` and diagonalize the symmetric matrix `A = S⁻¹ K S⁻¹` with an orthogonal matrix `Q`. The new coordinates and conjugate forces are

- `x = Qᵀ S q`
- `f = Qᵀ S⁻¹ τ`
- `x″ = (Qᵀ A Q)x + Qᵀ S⁻¹b − (Qᵀ M⁻¹ C Q)x′`.

The transformation preserves virtual work and instantaneous power: `τᵀ dq = fᵀ dx`. Mode coordinates have units rad·√(kg·m²); conjugate forces have units N·m/√(kg·m²). They must not be relabeled as original joint angles and torques. The displayed direction lines are normalized for legibility; the numerical directions retain their inertia scaling.

A diagonal stiffness matrix does not generally diagonalize damping. The instrument retains every transformed damping term and the affine bias. Only negative, numerically resolved stiffness eigenvalues receive an undamped angular frequency `sqrt(-λ)`; no damped frequency or physical stability claim follows. Repeated or unresolved eigenvalues explicitly leave the axis directions ambiguous. Asymmetric candidates remain visible with a construction refusal rather than silently symmetrizing them.

## Consumer and presentation decision

Two alternatives were considered: a matrix-only eigensystem ledger, and a direction instrument paired with the actual retained modal motion. The latter is implemented because users can see both what the learned coordinates mean in the original plane and how their existing motion appears in that representation. The matrix and units remain available as the explanation of the transformation. The plot is static and keyboard model selection changes the actual computation; no decorative animation or additional solver is introduced.

Inspection belongs to one retained comparison. Input or evidence changes must remove it with the existing motion lifecycle. Input-only motion save/reopen recomputes the law, trajectory and coordinate view. The inspection neither refits from trajectories nor alters evidence or motion inputs.

## Numerical scope and checks

The inherited response, inertia and trajectory admission bounds limit the two-by-two operations. Per model, transformation is linear in the maximum 1001 retained rows. Orthogonalization residuals, power residuals and round-trip coordinate residuals are floating-point diagnostics, not certified enclosures. Fitted-coefficient uncertainty is not propagated. Very close eigenvalues can make directions sensitive even when round-trip reconstruction remains accurate.

Focused controls include unequal inertias with materially coupled transformed damping, exact conditional equation agreement at every retained trajectory sample, repeated/zero/anti-restoring matrices, asymmetric refusal, source immutability and actual maintained fitted candidates. Browser receiving must cover source invalidation, keyboard candidate selection, input-only reopen and readable desktop/narrow visuals before this feature is qualified for merge.
