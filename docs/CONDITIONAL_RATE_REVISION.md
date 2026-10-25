# Conditional rate-law revision

Discovery Studio can explicitly fit a competing rate response under a nonpositive-rate-power assumption. Run the selected model's dynamics, then use **What if the rate response cannot supply power?** beneath its energy accounting. Declare a positive maximum absolute speed and choose **Fit under nonpositive rate-power assumption**. The default selected model and notebook remain unchanged.

This is a conditional experiment, not automatic physical identification. Holding every original non-rate coefficient fixed, the revision fits Coulomb, linear and quadratic rate terms from training observations only. The imposed inequality is

`f + d r + q r² ≤ 0` for every `0 ≤ r ≤ maximumSpeed`,

so the associated odd-rate power `r(f + d r + q r²)` is nonpositive. Mixed coefficient signs are permitted. A coefficientwise sign restriction would exclude legitimate members of this family.

## What the comparison shows

The panel retains original and revised training and held-out RMSE, discloses every held-out prediction and revised coefficient, and executes both laws through the maintained RK4 dynamics solver with the same initial state, inertia and fixed command. Neither held-out readings nor trajectory agreement chooses coefficients or replaces the original law. All returned trajectories are model predictions. An excursion beyond the declared speed interval lies outside the imposed constraint. If revised trajectory execution is refused, the fitted law and torque comparison remain visible with that refusal.

The original non-rate coefficients can themselves be wrong. This method does not jointly optimize them or search model structures. A worse receiving error is useful evidence against the combination of imposed assumption, fixed context and data assumptions. Even a smaller error does not prove physical passivity, establish a causal mechanism or calibrate uncertainty.

This temporary query is deliberately recomputed after reopening source notebooks; fitted coefficients and derived reports are not imported as authoritative evidence. Changing the speed declaration clears the old comparison immediately. Original source inputs remain the replay authority.

## Numerical method and limits

The implementation scales rate by the declared maximum and reuses the maintained normalized QR fitter. For a finite set of speed constraints, it enumerates homogeneous active faces: no root leaves three coefficients, one root leaves two, two distinct roots leave one, and three roots imply the zero polynomial. It evaluates feasible face candidates and retains the lowest numerical residual. It then checks the quadratic's endpoints and, when present, its concave interior maximum and adds a violating speed.

The numerical search allows at most24 refinement rounds and20 million row-feature work units. Full three-column rate excitation is required; rank-deficient and weakly conditioned designs refuse rather than fabricate a unique answer. Numerical capacities are operational limits, not physical evidence. An exhausted or stalled search returns no partial revision.

Floating point fitting can leave a small positive maximum. The returned coefficients are therefore separately inspected by the maintained exact rational rate-sign investigation. When necessary, the exact maximum factor is subtracted from the Coulomb coefficient and rounded outward downward using the existing rational enclosure primitive. The final binary64 polynomial must pass the exact sign check. This guarantees that polynomial's feasibility under real arithmetic; it does not certify constrained optimality, rounded solver arithmetic, statistical uncertainty or physical passivity. The coefficient correction and work diagnostics are disclosed.

## Evidence

The initial independent algorithm experiment used300 authored noisy trials across mixed-sign dissipative, boundary and active laws. A browser-compatible QR-face prototype matched an independent Python KKT finite-subproblem reference to approximately1.8e-15 in residual norm. Exact feasibility repair passed300/300 candidates. These are synthetic numerical controls, not physical validation or universal convergence proofs.

In that experiment, imposing the assumption on the active law increased held-out RMSE from about0.019 to0.670 N·m. That negative result is the reason this remains an explicit competing hypothesis with the original law retained. No broad fitted-model default is changed.

Run `node tests/conditional-rate-fit.test.mjs`. The actual Studio receiver is `scripts/conditional-rate-browser.mjs`; provide `PLAYWRIGHT_MODULE`, `CHROME_BIN` and `BASE_URL` for the available browser installation and launched server. It covers authored false-assumption receiving, both actual solver traces, keyboard operation, desktop and390px layouts, reduced motion, invalid/stale clearing and source notebook reopening.
