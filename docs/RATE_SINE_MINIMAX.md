# Prospective rate–sine intervention design with exact bounded-error geometry

WORLDLAW's UNKNOWN LAB now asks a different question from fitting another coefficient vector: **which permitted, affordable next observation(s) could most shrink the set of executable explanations, regardless of what bounded-noise values the instrument returns?** The answer uses all feasible explanations sharing the original measurements, not a nominal fit, an assumed Gaussian posterior, or synthetic outcomes.

## Actual product path

Open `/unknown-lab.html` → **Does the effect reverse with motion?** → load authored or imported cross-probe evidence → **Challenge explicit mixed responses** → choose **rate-sine** → **Find the next two measurements that make competing laws disagree**.

The resulting apparatus exposes six editable hypothetical rate/angle states, individual future contrast-error radii, effort costs, a budget, and a one- or two-reading limit. It presents the best course, before/after worst coefficient diameters, every affordable alternative, and complete JSON with the actual current readout screens and prospective offers. Recomputing after edits invalidates the prior result. This is a virtual *request design*, not command dispatch or a source-verified physical measurement.

The original rate and sine coefficient bounds remain available. The planner invokes the existing source/counterbalancing qualification and will not operate on order-confounded data. **Training-only** uses only training notebooks; **all-evidence** is explicitly retrospective and is never advertised as a frozen forecast. The unmodified finite model family may still be wrong.

## Why this is an exact worst-case guarantee within the declared family

Write the model for a single preconditioning contrast as

\[
y = a\,\omega + b\,\sin(\theta) + \varepsilon,\qquad |\varepsilon|\le \rho.
\]

The original bounded observations, interpreted as their exact parsed binary64 numbers (including computed sine values), and the coefficient box \([-100,100]^2\) define a closed convex feasible polygon \(P\) in coordinates \((a,b)\). Existing `coefficientBounds` computes it using exact rational half-plane clipping.

For a candidate ordered course with feature vectors \(f_j=(\omega_j,\sin\theta_j)\), future absolute error radii \(r_j\), and *unknown* outcomes \(z_j\), the posterior feasible polygon is

\[
P_z = \{\beta\in P:\ |f_j\cdot\beta-z_j|\le r_j\quad\forall j\}.
\]

The largest possible diameter of \(P_z\) along coordinate \(k\), over **every compatible future outcome**, is *exactly*

\[
D_k =
\max_{\substack{d\in P-P\\|f_j\cdot d|\le 2r_j\ \forall j}} |d_k|.
\]

**Proof:** Two candidate laws \(\beta,\beta'\in P\) can both survive *some common possible outcome* \(z_j\) iff the closed intervals \([f_j\cdot\beta-r_j,f_j\cdot\beta+r_j]\) and \([f_j\cdot\beta'-r_j,f_j\cdot\beta'+r_j]\) intersect. This is precisely \(|f_j\cdot(\beta-\beta')|\le2r_j\), independently for each reading \(j\). Every pair difference in \(P-P\) is attained by a pair of original feasible explanations, and every satisfying pair has a compatible joint set of future outcomes. Taking the supremum of coordinate separation establishes both inequalities, hence equality.

Because \(P\) is convex, \(P-P\) is the convex hull of all pairwise differences of its vertices. The implementation computes that hull, clips it against every future two-sided linear constraint using the shared exact BigInt rational engine, and projects the final polygon. It ranks the complete set of affordable one- and two-reading courses by

1. Smallest \(\max_k D_k/D_k^{\mathrm{initial}}\), with a zero baseline width assigned zero remaining fraction.
2. Smallest sum of the two fractions.
3. Smallest declared effort and fewer readings, then stable offer identity.

The comparison is exact over binary64 feature inputs and coefficient endpoints; displayed binary64 outputs are outward enclosures. Geometry is bounded by 16 distinct offered states, 24 original screens and a 200,000-vertex-work cap, with refusal rather than a partial invented ranking if a capacity is exceeded.

## Held-out falsification, not a structural-identity claim

A fixed independent adversarial test starts with the same noisy rate observation under all candidate designs. At equal declared two-reading cost and radius 0.02 N·m:

| Course | Worst remaining ambiguity fraction | Explanation |
| --- | ---: | --- |
| Two parallel rate readings \(\omega=+2,-2\), \(\theta=0\) | **1.0** | No information about the sine coefficient |
| One strong rate reading + an independent sine-angle reading | **0.5** | Worst-axis ambiguity cut in half |

A fixed-seed 200-trial held-out check chooses independent coefficient truths and future bounded observation errors **after** the plan has been frozen. In every trial, the true law remains inside the source-screened posterior, and both posterior diameters stay below the predicted prospective worst-case limits. These are test results conditional on the declared two-term oracle and error contract; they do not measure actual sensor fidelity.

Negative tests refuse duplicate offers, negative noise radii, invalid readout limits, excess reading counts, contradictory original source screens, and impossible budgets. The actual product browser receiving also exercises keyboard selection, desktop/mobile layout, source integrity and stale-result invalidation.

## Interpretation boundary

This does **not** establish that nature obeys exactly the rate+sine form, that an unoffered term is zero, that calibration drift is controlled, that the sensor truly satisfies the declared noise radius, or that a proposed state is physically safe/achievable. A coefficient interval including zero can still contain small nonzero laws. The previous 74/100 near-law structural failure is *not erased* by this result. The correct next frontier is shared-parameter experiment design across larger competing structural families and independent hidden-state controls, with a reproducible out-of-family negative oracle.
