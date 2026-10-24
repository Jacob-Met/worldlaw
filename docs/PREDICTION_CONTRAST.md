# Shared-reading receiving contrasts

The existing held-out sensitivity inspection now also checks every unordered receiving pair. Marginal ranges remain visible and unchanged. This addresses a specific gap: two readings may each intersect their own prediction range even though no shared training-reading perturbation can explain both.

For oriented rows a minus b, combine training-reading influences as g_i = h_ai - h_bi before taking absolute values. The predicted contrast center is c_a - c_b and its halfwidth is trainingRadius × sum_i abs(g_i). The observed contrast center is y_a - y_b and its halfwidth is twice the separately declared receiving radius. Both receiving error extremes can occur under the declared independent bounds.

At identical coordinates the model's difference is zero regardless of training perturbations. Two exact receiving readings 4.995 and 5.005 can individually overlap 5±0.01 while their nonzero difference contradicts the shared model. Raising each receiving radius to 0.006 removes this definite pair contradiction; it does not establish model validity.

## Necessary checks, not joint feasibility

All pairs are checked and every pair is selectable. The first contradiction is initially displayed for inspection only. Passing every pair is not proof that one training perturbation explains all receiving rows. For example, an affine law with uncertain endpoint predictions can individually and pairwise overlap receiving values -0.5,+0.5,-0.5 at coordinates -1,0,+1, but a single affine law matching the endpoint values must predict -0.5 at the midpoint. Native controls retain this counterexample.

Common receiving offsets cancel from differences. The preserved marginal comparison can reject such an offset even when contrasts cannot. Pair checks supplement rather than replace marginal evidence, training adequacy or other owned experiment mechanisms. No model is selected or refitted using receiving outcomes. Coordinates and inspected structure remain fixed; no physical identification, confidence level or global feasibility is inferred.

## Numerical and work boundaries

The pair boundary screen includes both underlying marginal tolerances and an engineering roundoff allowance scaled by the uncancelled coefficient-box radii, original prediction/reading magnitudes and contrast radii. Near-boundary outcomes remain numerically unresolved. This is floating-point least squares and arithmetic, not certified interval computation or a rigorous bound on QR conditioning error. Zero declared reading radii do not remove floating-point fitting error: weakly conditioned exact authored data can still produce an outside computed envelope. Read that disposition with this numerical qualification; it is not a rigorous mathematical exclusion certificate.

The complete receiving limit remains 128 rows, yielding 8128 unordered pairs. At 256 training rows the pair course examines 2,080,768 influence differences. Marginal influence vectors are retained once. Each pair retains a compact string of upper-witness signs in training order, decoded only for the inspected pair; negating those offsets reaches its lower endpoint. Different pairs can need different witnesses.

An unavailable contrast calculation never silently samples a favorable subset. When fewer than two receiving rows are present, the computed marginal result remains visible and the contrast check is explicitly unassessed. A marginal rank/work refusal remains explicit. Source/model/radius/observation changes clear both derived inspections. Saved notebooks retain source inputs; reopen and redeclare radii to recompute. Derived contrast reports are not an import format.

## Qualification

Run `node --test tests/prediction-contrast.test.mjs` for analytical contrasts, all 256 training-box corners, decoded witness refits, receiving noninterference, orientation, common-offset cancellation, the nonjoint counterexample, numerical boundaries, full 8128-pair coverage and explicit admission/refusal.

Run both `node scripts/prediction-sensitivity-browser.mjs` and `node scripts/prediction-contrast-browser.mjs` through the maintained browser environment. The original course protects marginal behavior. The contrast course exercises imported same-coordinate contradictions, every pair selection, native/DOM equality, relaxed receiving bounds, model/measurement invalidation, source export/reopen, keyboard selection on narrow displays and a one-row marginal result with unassessed contrasts. Its maximum-course control uses 256 training and 128 receiving rows, selects the final pair and compares full-precision displayed endpoint data with native computation. It records one actual browser computation/DOM elapsed time and elapsed time through a rendering opportunity; those are not averaged or cross-device performance guarantees.

Browser artifacts use `BROWSER_ARTIFACT_DIR` or `.receipts/prediction-contrast`. These are commands and intended controls, not an unexecuted pass claim.
