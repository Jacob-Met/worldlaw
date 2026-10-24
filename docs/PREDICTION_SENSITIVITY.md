# Held-out prediction sensitivity

The Studio compares every retained held-out torque reading with the scalar prediction range produced by bounded changes to training torque readings. The inspected structure and all command, angle and rate coordinates stay fixed. Held-out outcomes never enter the fit. Both reading radii are explicit nonnegative absolute errors in N·m; neither is a standard deviation or confidence level.

## Shared dependence matters

The maintained least-squares fitter gives a coefficient influence matrix W. At a receiving coordinate with feature vector phi, form each training-reading influence h_i = sum_j phi_j W_ji first. The scalar prediction halfwidth is trainingRadius × sum_i abs(h_i). Taking absolute values before combining coefficient influences would discard their shared dependence and can greatly exaggerate uncertainty.

For the authored affine control y = 4x + 1 near x = 1, coefficientwise halfwidths are about 120 under a 0.01 N·m reading radius. Yet the prediction halfwidth at x = 1 is 0.01 N·m, while at x = 2 it is about 120 N·m. Repeated numeric rows in this control are authored test inputs, not independent measurements.

Each row retains all training influences and an upper-endpoint witness: add sign(h_i) × trainingRadius to reading i and refit. Negating that vector reaches the lower endpoint. Different receiving rows may require different witnesses. Even overlap for every row does not establish that one common training perturbation explains the whole receiving course.

## Interpretation and numerical boundary

The receiving reading has its own declared radius. `outside` means the two computed scalar intervals have a positive gap greater than the displayed engineering numerical tolerance. `numerical-boundary` means the gap is within that tolerance of zero, including near touching. `not-excluded` records overlap beyond that screen. It does not establish model adequacy, physical validity or joint feasibility.

The tolerance is 256 machine epsilons times the largest of one, the absolute refitted term sum, the prediction radius, the independent coefficient-box radius, the receiving torque magnitude and the receiving radius. Including the independent coefficient-box radius screens arithmetic involving large coefficient influences that cancel when combined into a small prediction influence. This is an engineering roundoff screen, not a certified bound on floating-point QR or conditioning error. Results use maintained floating-point least squares, not interval arithmetic. Ill-conditioned accepted fits can remain numerically sensitive.

These are unconstrained refits to perturbed training readings, not a set of physically admissible laws or fits guaranteed to satisfy a residual test. Common calibration offsets lie inside the independent reading box when their magnitudes obey the radius, but no correlation model is inferred. Coordinate uncertainty, alternative structures, model-family selection, input-box planning, motion and cycle-work qualification remain separate capabilities.

## Complete receiving course and replay

The diagnostic accepts at most 256 training and 128 receiving rows. Rank or work-limit refusal reports no selected subset. Every admitted receiving row remains in the displayed denominator, with its prediction interval, reading interval, disposition and coordinate-range extrapolation markers. A coordinate outside the observed training range is a descriptive marker, not a physical failure verdict.

Changing either radius, inspecting another model, adding an observation or reopening a notebook invalidates the former displayed result. Reopen the source notebook, select the same structure and redeclare both radii to recompute; the panel is a derived inspection, not a new retained measurement or an executed experiment. Missing radius options use documented defaults; explicitly supplied null, undefined, nonnumeric or out-of-range values refuse.

## Qualification commands

Run `node --test tests/prediction-sensitivity.test.mjs` for analytic cancellation/extrapolation, all 256 training-box corners, endpoint witnesses, receiving-data independence, numerical boundaries including influence cancellation, separate-overlap limits, common-offset response and admission/work controls.

Run `node scripts/prediction-sensitivity-browser.mjs` with the repository's usual Playwright environment to exercise actual Studio import, numeric DOM/native agreement, keyboard activation, witness selection, radius/model/observation invalidation, notebook reopen and observed narrow-table keyboard scrolling. Browser artifacts default to `.receipts/prediction-sensitivity`; `BROWSER_ARTIFACT_DIR` overrides that destination. These commands describe qualification; this document does not assert an unexecuted pass.
