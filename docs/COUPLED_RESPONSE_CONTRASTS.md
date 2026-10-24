# Shared training changes across receiving rows

The joint response-region view tests the two torque readings at one coordinate together. Each receiving row may still require a different allowed change to the retained training data. The selected-row contrast asks a narrower follow-up: does the measured torque difference between two original rows contradict every common bounded training change?

Open the existing joint response inspection, then choose **Inspect dependence between receiving rows**. Select a fitted structure and two distinct original rows. Order is explicit: first minus second. The view retains each original coordinate, reading, bounds, and training-range qualification. The same per-training-reading radius applies to both rows. Receiving radii add componentwise; no statistical independence is assumed.

For training reading i, let gAi and gBi be its two-output generators at the selected coordinates. A common change acts through gAi−gBi. Allowing the rows to change independently would instead add separate absolute supports and can miss contradictions. The displayed shared extremal offsets correspond to one vector of retained training-reading changes; they attain a directional support and need not reproduce the measured rows.

The teal region is the resulting torque-difference sensitivity region. Pink is the supplied difference with summed receiving bounds. The dashed box is the marginal bounding box of the difference region. A separating direction rules out one common perturbation explaining these rows and therefore the complete course. **No separation does not prove that the full four-output pair constraints, or the whole course, share an admissible perturbation.** This is a necessary-condition witness, not a feasibility solver.

The planar difference screen proposes a direction. The maintained shared-training separator checker independently evaluates that direction against the four original outputs, their aligned training generators, distinct receiving radii, and original pre-cancellation numerical magnitudes. It is the same support-checking kernel used by the scalar shared-training evidence consumer.

The calculation keeps coordinates and affine structure fixed and never fits receiving readings. It is least-squares sensitivity to declared training-reading changes, not a feasible physical-law set, calibrated uncertainty, or a mechanism diagnosis. Floating-point engineering screens do not certify all QR error. A failed plot does not suppress the numerical and original-source ledger.

Saving stores original notebook, original loop, declared training radius, candidate identity, and selected row indices. Reopening recomputes from these sources; stored verdicts are rejected. The active notebook and parent region remain unchanged. Changing selection invalidates a pending file read; replacing the parent removes the inspector.

The authored control uses the maintained 32-row notebook. At [0,0] and [0.0024,0] rad, separate bounded perturbations attain both readings, and all five original row regions are not excluded. Their first-torque difference has discrepancy 0.10089778935 N·m but shared training support only 0.00772467608 N·m, plus 0.002 N·m receiving allowance. This is an authored dependence control, not physical validation. An actual common perturbation and broader receiving bounds remove the contradiction.
