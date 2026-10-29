# Shared restoring law, declared condition-specific damping

This optional Motion comparison fits common non-rate coefficients and one linear-rate coefficient for each original training course. It uses the existing screened trajectory receiver and normalized QR primitive with bounded damped finite-difference updates. Starts are fixed, all original residual rows remain, and every model must complete both integration resolutions under the unchanged 0.001 rad maximum-difference screen. Neither an added parameter nor a lower training residual establishes a shared physical law.

The source-only `worldlaw.condition-trajectories/v1` notebook retains the original full-six predictive comparison, maintained fixed-start refinement, and pooled trajectory-sensitivity fit. The added fit uses training courses only. Forecasts require explicit challenge-to-training associations and a written same-condition assumption. Unseen or unassigned conditions are refused. Associations are hypotheses supplied before forecast; challenge values cannot choose them. Swapping an association changes only the challenge prediction, not fitted coefficients. There is no parent-source or parent-law adoption.

## Complete work and refusal

For n shared-plus-course parameters and s sweeps the reservation is `1+s*(2*n+4)` complete all-course coarse/fine evaluations. At most four training courses are admitted, with distinct original identities, 1–12 sweeps, no more than 4 million integration steps and 262144 forecast rows. Failure or unresolved perturbations prevent a Jacobian or update. Bound projection is explicit local optimization. Separate challenge forecasts are fully reserved before the first new forecast, with 1 million steps and 65536 rows. Original, joint, and challenge budgets are separate stages, not a claimed combined session cap. Missing seeds and optional-stage refusals retain original comparisons.

## Independent controls and measured limitation

Two independent closed-form damped oscillators share stiffness −4 with damping −0.2 and −0.9. The new joint fit recovers them; ordinary pooled damping leaves more than 0.05 rad training error. Independent new releases under correct associations predict to below 1e−5 rad; swapped associations exceed 0.05 rad. A deliberately different restoring law retains more than 0.03 rad mismatch. These are authored controls, not measured validation.

Exploratory calibration of two original PASCO air courses plus the now-consumed small-baffle course gives 0.04104469 rad pooled training RMSE versus 0.04370854 for a common-rate fit. This small training improvement is not evidence of transfer or correct apparatus attribution. Three joint sweeps reserve 518592 steps and 222111 prediction rows. An eight-sweep attempt was refused by the existing row cap and is retained in the receipt; the cap was not increased.

The previously frozen independent measured transfer remains a loss: pooled sensitivity 0.06786744 rad versus maintained refinement 0.03596733 and predictive incumbent 0.04814519 on small-baffle condition1st repetition. That course is now consumed exploratory training here. It cannot be called newly held-back again. The frozen original evaluation and source bytes remain unchanged in the prior held-condition packet.

## Consumer and lifecycle

The maintained Motion page offers an explicit authored example and source notebook import/download. It shows original comparisons, individual condition coefficients, all forecast statuses, trajectory overlays, and inspectable trials. The narrow display uses labeled result cards. Parent-source intent immediately retires pending work; file completion checks epoch and connected source before computation/adoption. New source notebooks recompute rather than trusting cached outputs. Each notebook is separate from the main experiment and is labeled as such.
