# Refine a declared target prediction within a surviving reference-response family

## Goal and observed gap

Continue the actual UNKNOWN LAB reference sequence after #419 / PR #429. The maintained comparison suggests separating model families, but returns no recommendation once one family remains, even when its shared coefficients still permit a wide target prediction. An authored maintained-notebook probe leaves one fixed-tau additional-response family with gain uncertainty: the target at duration 2 and reference contrast 1 spans about 2 units. A conditional informative observation can narrow that target; observing reference contrast 0 cannot resolve the gain.

## Bounded advance

Add conditional target-prediction refinement to the maintained sequential consumer, without changing actual acquisition admission, original coefficient families, frozen rounds, or prior evidence. Initial scope requires exactly one surviving additional-response family with one fixed tau. Use all its sign-split joint coefficient polygons, including every qualified original actual constraint. Empty or multiple-family cases remain explicit unsupported states for this particular mode; existing family-separation planning remains available.

The user declares one target duration and point reference contrast, and at most 32 explicit prospective duration/point-reference/main-contrast-half-width offers. A point reference is a conditional assumption, not a physical input under the user's control. Epsilon is the half-width of the future derived MAIN contrast, not a per-sample or individual-channel standard deviation. Zero precision is a mathematical limiting control, not achievable acquisition evidence. Keep the maintained duration domain and source/account capacity boundaries.

For each offer report the worst remaining target-prediction diameter over every main reading compatible with the current family and the declared main half-width. Preserve complete component unions and shared coefficient tuples. Do not average outcomes, assign probabilities, fit a preferred coefficient, sample a response grid, or introduce a new tau. Display attaining pairs as explanations of residual ambiguity, not as selected physical laws. Preserve current source-staleness and transactional import rules; save only source account, target and offer declarations, recomputing derived values on reopen.

## Mathematical contract

Let P be the union of current compact coefficient polygons, theta=(g,A), u=(r,1-exp(-t/tau)) for the offered condition and v the analogous target vector. With P_y={theta in P: |u·theta-y|≤epsilon}, the worst remaining diameter is

W = max_y diam(v·P_y) = max{|v·(theta-phi)|: theta,phi in P, |u·(theta-phi)|≤2epsilon}.

The equivalence follows because two closed main-reading bands overlap exactly under the last inequality. Their midpoint supplies an admissible common reading. Compactness gives an attaining pair whenever P is nonempty.

For every ordered component pair Pi,Pj, construct the complete 2D difference polygon Pi-Pj from all vertex differences, retaining original vertex-pair provenance. Clip it by the two offer strip boundaries and maximize both signed target functionals. A clipped vertex's interpolation weights reconstruct theta in Pi and phi in Pj. Taking the maximum across component pairs is complete; globally convexifying P is forbidden because it invents hypotheses in disconnected gaps. Preserve singleton and segment degeneracies.

This real-arithmetic identity does not certify its JavaScript implementation. The maintained source polygons already use declared binary64 screening slack. Exp, hull orientation, clipping, projection and witness reconstruction need explicit finite arithmetic checks, bounded work and unresolved numerical outcomes. Report witness residuals against original component and source constraints; near-boundary or unstable results must not be promoted to certified contraction. No calibrated probability, rigorous interval enclosure, physical intervention or causal-identification claim.

## Read-only probe evidence

Executable: source/probe-refinement.mjs. Results: refinement-probe-results.json, SHA256 56f31b0da7a31ee5fa547b9c3afa5017e0c50edb1560e54739ceb8e7038af607.

Eleven analytic controls pass, including rectangle 2→0.2 gain-width reduction, uninformative width 2, correlated triangle width 1.2, disconnected sign components with width 0 versus erroneous global convexification width 2, finite-noise union width 0.2, singleton/segment and zero-precision/zero-observation controls. All attaining pairs are rechecked against their original components and common-reading bands. Negative and NaN main half-widths refuse.

On the authored maintained notebook, with target duration 2/reference 1 and offered main half-width 0.0001: conditional reference 0 leaves worst diameter 2.0000000519658836; conditional reference 1 yields 0.0002. After the separately authored synthetic actual, both widths are 6.404065345914465e-8. Both source witnesses for each offer satisfy the original gain/amplitude bounds and every training/qualified actual inequality, with the maintained screening slack recorded separately. This is a development counterexample and analytic feasibility probe, not fresh physical validation.

## Ownership and proof before publication

Fresh read-only searches for open reference/prediction and prediction/refinement claims found no competing paired-reference target-refinement owner. Preserve #75 scalar coordinate-bound experiment planning, #281 scalar QR/influence, #299 generated scalar laws and all angular/history owners. Proposed implementation is additive reference-refinement core/panel/tests plus a narrow existing sequence-panel mount; no scalar planner or actual receiver changes.

Before publication: independent mathematical/numerical review; bounded component-pair coverage and degeneracy/refusal controls; source-only replay and original-evidence invariance; actual consumer target→offers→attaining explanations→existing freeze/acquire path; stale/failed replacement retention; desktop/narrow/keyboard receiving and exact current-main integration. Production implementation and native claim are pending root approval.
