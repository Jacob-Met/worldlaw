# Joint-state fit: separating discrete RK4, finite-stencil and native arithmetic effects

## Result

The [preceding fixed-state study](JOINT_GRADIENT_RESOLUTION.md) found a large relative difference between the final native rate gradient and the continuous analytic gradient. This calculation identifies the main source of that difference for the same authored fixture.

At maximum integration step .02, the final rate gradient progresses through four distinct quantities:

| Evaluator | Rate gradient, unnormalized Jᵀr |
|---|---:|
| Continuous analytic solution | −5.157055826e−4 |
| Analytic derivative of mathematical RK4 on the represented grid | −4.867979505e−7 |
| Same-node finite stencil on high-precision RK4 outputs | −1.829252335e−7 |
| Previously recorded native evaluation | −1.870315955e−7 |

Most of the continuous-to-native difference comes from the mathematical discrete objective. The retained finite stencil adds a further bias that matters relative to the small discrete gradient; the remaining native arithmetic difference is smaller. The native result is therefore not adequately explained by labeling everything “finite-difference cancellation.”

The high-precision discrete objective also prefers all four last historical proposals to the accepted point, but by only about **2.77e−21 in weighted RMS**. That is about **2.50e−5 of one binary64 spacing** near this score. The historical native ranking remains a faithful account of what its computed objective returned. These tiny differences do not establish a useful additional fitting gain or justify a new stopping policy.

No optimizer or native receiver was rerun for this calculation. The numerical study evaluates fixed states and already-recorded proposals with an independently differentiated discrete reference. Product sources, screens, objective weights, fitted data and acceptance rules remain unchanged.

## Fixed evidence and input custody

The runtime source pin remains `3f70a51626e31b70751271d3bbf8d7ee5456cc5d`. This research builds on evidence commit `455303086d6e6eec888fc7d04df2d7590fbe4ae0`.

The same corrected-helper states are retained:

| Snapshot | Historical trial | Rate coefficient c | Spring coefficient k |
|---|---:|---:|---:|
| First accepted spring boundary | 5 | −0.24604286839907222 | −3.85 |
| Final accepted result | 35 | −0.19259937353078452 | −3.85 |

The original three courses, 126 rows per course, declared initial rates and observed supplied rates remain distinct and unchanged. The exact original JSON fixture digest is `86efee448961acd995afe70ef052837d071a00ab39392f738d30281bd6d60a89`. No observation is regenerated in high precision.

The retained native gradients, objectives, actual receiver coarse counts and final proposals come from the prior receiving receipt. Its source/input capsule and driver remain independently pinned. The continuous gradients and proposal rankings are the previously qualified 120-digit reference values, retained to 70 significant digits. This is reuse of recorded evidence, not a fresh independent replication of either earlier calculation.

## The actual integration scheme

The inspected angular adapter preserves term order `[rate, spring]` and coefficients, then supplies numerical proxy inertia 1 and command 0 to the shared integrator. Physical inertia and absolute torque remain unidentified.

For this smooth two-term fixture,

\[
y' = Ay,\qquad
y=\begin{bmatrix}q\\v\end{bmatrix},\qquad
A=\begin{bmatrix}0&1\\k&c\end{bmatrix}.
\]

The predictor accumulates rate and spring terms in their original order. No sign change or extra inertia factor belongs in this reference.

For every observation interval, the inspected no-command-timing path computes in native binary64:

```js
duration = sample.time - previous.time;
steps = Math.max(1, Math.ceil(duration / maxStep));
h = duration / steps;
```

The grid-capture script checks the exact original `forward.mjs` and angular-adapter hashes and the relevant source literals, performs those same binary64 operations in Node, and compares the resulting coarse-step totals with the previous actual receiver receipts. It reconstructs the grid from inspected source; it does not claim to have instrumented a new native rollout.

All three courses have identical original timestamp arrays, explicitly checked. Their grids contain **27 distinct represented h values** across the three maximum steps:

| Maximum step | Coarse transitions per course |
|---:|---:|
| .02 | 354 |
| .01 | 604 |
| .005 | 1,104 |

The reference converts each captured `h` with `Decimal.from_float`. It does not repeat timestamp subtraction or step division in Decimal and does not assume exact .04 intervals. The exact-real sum of repeated represented steps need not equal the exact-real timestamp difference. Thus continuous-versus-discrete differences include frozen-grid representation effects as well as RK4 truncation.

The maintained native step uses four classical RK4 stages and separately weighted, left-associated final additions. The polynomial reference below is equal to that scheme over exact arithmetic. It is **not the derivative of the fully rounded IEEE execution trace**.

## Analytic sensitivities of the discrete map

For one fixed step, write

\[
Z=hA,\qquad
R(Z)=I+Z+\frac{Z^2}{2}+\frac{Z^3}{6}+\frac{Z^4}{24}.
\]

Parameter matrices are

\[
A_c=\begin{bmatrix}0&0\\0&1\end{bmatrix},
\qquad
A_k=\begin{bmatrix}0&0\\1&0\end{bmatrix}.
\]

These matrices generally do not commute with `A`. The implementation therefore retains the product-rule order:

\[
P_0=I,\quad D_{p,0}=0,\qquad
P_m=ZP_{m-1},\quad
D_{p,m}=hA_pP_{m-1}+ZD_{p,m-1}.
\]

It sums `P_m/m!` to form `R` and `D_{p,m}/m!` to form `R_p`. State and sensitivities then advance using the old values on both right-hand sides:

\[
y_{\mathrm{next}}=Ry,\qquad
s_{p,\mathrm{next}}=Rs_p+R_py.
\]

Initial sensitivities are zero because original starts are fixed independently of fitted coefficients. No finite-difference approximation is used for these discrete derivative columns.

An independent control propagates state and both tangents through the four RK4 stages directly. Each stage uses `Ay` for state and `A s_p + A_p y` for the tangent. The control covers both saved coefficient states, all 27 step values, and three fixed state/sensitivity inputs, including nonzero prior sensitivities. It catches noncommuting-product and old-state-update mistakes.

The maintained helper stencil is separately applied to high-precision discrete residuals at the original represented probe coordinates, with the original actual offsets and weight. No stencil widening or new probe selection is introduced.

## Execution and complete cost accounting

The standard-library Python calculation ran natively under **Python 3.12.14**, with Decimal working precisions **80 and 120**. It exited 0. The exact stdin capsule is hash-checked before calculation.

Per precision:

| Work | Count |
|---|---:|
| Two centers plus four probes, three grids, three courses | 61,860 primal transitions |
| Historical proposals 40–43 at .02, three courses | 4,248 primal transitions |
| Total primal transitions | **66,108** |
| Transitions also carrying analytic sensitivities | 12,372, a subset of the primal total |
| Matrix-polynomial constructions | 297 |
| Intermediate/output reference state checks | 330,540 |
| Independent polynomial-versus-stage controls | 162 |

Across both precisions, the calculation used **132,216 primal transitions** under a predeclared 140,000 cap, and **324 independent controls** under a 1,000-control cap. These are reference operations, not equivalent counts of the earlier native coarse-plus-refined receiver work. No new numerical-screen qualification is claimed.

Transition matrices are reused only within this diagnostic for identical coefficient/step combinations. Trajectories are evaluated for each planned point, including duplicate historical attempts 40 and 41. Matrix construction, tangent propagation and stage checks are reported separately; transition count alone is not a full wall-time cost model.

All checked reference position/rate stage components are finite and below the maintained per-component bound of 1,000,000. The largest absolute component is approximately **1.830500379**. This is a reference-domain check, not a new physical bound or a claim of native refusal parity outside this fixture.

The maximum difference between polynomial and stage-tangent controls is **1e−79** at 80 digits and **1e−119** at 120 digits. The largest difference between the two precision calculations is **3.4651e−71**. These are precision and independent-formula checks, not interval-certified error bounds.

## Gradient decomposition

All gradients use the interleaved 756-entry scaled residual vector and the unnormalized product `Jᵀr`. Each evaluator uses its own corresponding residuals. These are derivatives or derivative estimates of half the residual sum of squares, not RMS derivatives.

For the final accepted state:

| Maximum step | Continuous analytic | Discrete analytic | Discrete same-node stencil | Recorded native |
|---:|---:|---:|---:|---:|
| 0.02 | -5.157055826e-4 | -4.867979505e-7 | -1.829252335e-7 | -1.870315955e-7 |
| 0.01 | -5.157055826e-4 | -4.667163891e-4 | -4.664125165e-4 | -4.664482962e-4 |
| 0.005 | -5.157055826e-4 | -5.115900507e-4 | -5.112861781e-4 | -5.112592941e-4 |

The exact additive comparison is

\[
g_N-g_C=(g_N-g_{FD,R})+(g_{FD,R}-g_R)+(g_R-g_C).
\]

Its final rate-coordinate components are:

| Maximum step | Discrete minus continuous | Discrete stencil minus discrete derivative | Native minus discrete stencil |
|---:|---:|---:|---:|
| 0.02 | 5.152187847e-4 | 3.038727170e-7 | -4.106362027e-9 |
| 0.01 | 4.898919355e-5 | 3.038725797e-7 | -3.577974010e-8 |
| 0.005 | 4.115531929e-6 | 3.038725664e-7 | 2.688402916e-8 |

The last column combines native rounding during integration, residual construction, finite differences and accumulation. It does not isolate subtraction cancellation alone. The first column includes the represented-grid effects described above.

At .02, the discrete rate gradient combines a position-channel contribution of approximately **−104.5409395623** with a supplied-rate contribution of **104.5409390755**, leaving a total near **−4.87e−7**. This nearly cancelling sum explains why an absolutely small derivative discrepancy matters near this result.

The first-boundary state provides a separate scale control. At .02 its rate gradient is approximately **−2441.750230803** continuously and **−2441.749664172** for the discrete objective. The native value **−2441.749664588** remains consistent with the strong same-sign direction. The final small-gradient interpretation should not be generalized to that earlier state.

Both spring gradients remain positive at the lower bound. All sign conclusions from the earlier study remain intact. Decreasing the integration step moves the discrete gradient toward the continuous one, while the fixed stencil retains its own error. No order-of-convergence rate or universal monotonic improvement is inferred from these three irregular represented grids.

## Objective ordering

Each row compares a historical proposal with accepted trial 35 under the indicated evaluator:

| Proposal | Rate coefficient | Recorded native RMS difference | High-precision discrete RMS difference | Continuous RMS difference |
|---:|---:|---:|---:|---:|
| 40 | -0.19259937352716067 | 5.551115123e-16 | -2.772407463e-21 | -3.649428383e-18 |
| 41 | -0.19259937352716067 | 5.551115123e-16 | -2.772407463e-21 | -3.649428383e-18 |
| 42 | -0.1925993735271608 | 1.110223025e-16 | -2.772327067e-21 | -3.649288651e-18 |
| 43 | -0.1925993735271623 | 2.220446049e-15 | -2.771458666e-21 | -3.647779550e-18 |

All spring coefficients are −3.85. Proposals 40 and 41 remain identical vectors and are preserved as separate attempts. Both precisions agree on every high-precision discrete ordering.

The discrete objective prefers the proposals by approximately **2.77e−21**, even smaller than the continuous differences of about **3.65e−18**. The remaining native ordering disagreement therefore persists after removing the continuous-versus-discrete distinction. It is not evidence of a practically significant extra gain.

For scale, the final center's native-versus-discrete and discrete-versus-continuous objective differences are:

| Maximum step | Native RMS minus high-precision discrete RMS | Discrete RMS minus continuous RMS |
|---:|---:|---:|
| 0.02 | -9.033956634e-16 | 2.533270094e-7 |
| 0.01 | -1.543206647e-15 | 2.269522178e-8 |
| 0.005 | 6.634427877e-16 | 1.852957209e-9 |

Neither center discrepancy is a certified bound on pairwise ordering error. The native result's `no_improvement` label records failure of the tested proposals to lower its computed objective. It does not certify stationarity of either exact-real objective.

The broad constrained training improvement documented in the earlier studies remains separate from these sub-spacing late decisions. This decomposition closes the narrower mechanism question for the fixed fixture; it does not select a general numerical policy.

## Reproduction and artifacts

Files:

- [Native grid capture](../scripts/capture-joint-discrete-grid.mjs).
- [Discrete gradient reference](../scripts/diagnose-joint-discrete-gradient.py).
- [Base evidence input](receipts/joint-discrete-gradient-7912183a/base-input.json).
- [Frozen native grid and evidence capsule](receipts/joint-discrete-gradient-7912183a/source-input.json).
- [Native reference receipt](receipts/joint-discrete-gradient-7912183a/native-decomposition.json).
- [Execution and source identities](receipts/joint-discrete-gradient-7912183a/execution.json).

The reference consumes the exact saved capsule, including its trailing newline:

```sh
python -B scripts/diagnose-joint-discrete-gradient.py \
  < docs/receipts/joint-discrete-gradient-7912183a/source-input.json
```

To regenerate the same grid from the pinned original source closure:

```sh
node scripts/capture-joint-discrete-grid.mjs /absolute/path/to/pinned/original/source \
  < docs/receipts/joint-discrete-gradient-7912183a/base-input.json \
  > regenerated-source-input.json
```

Actual execution supplied these same script bodies through Node `-e` and Python `-c`, with stdin populated in memory. The final stdin grid-capture entrypoint was executed and reproduced the frozen capsule exactly. Named script-file invocation and redirected output-file creation have not been received on this storage-constrained seat. No high-precision numerical calculation was repeated to qualify that input-entrypoint change.

| Artifact | SHA-256 |
|---|---|
| Grid capture | `d947e185f860b3062b46c75703b06644855dd6d77386c315cc149dc307b6d5cd` |
| Python discrete reference | `80a018dc8f8ed5ebc5c3e702b174b2cbcb7ded2fe8273be5a04de98d6d016d0b` |
| Base input, with trailing newline | `bf904dfef40ab5da51544887f8b678507b2bc5de2692ca65b472ab636012488f` |
| Frozen capsule, with trailing newline | `3eab939ce04637ffa858521efc568d179f01b36d5b1e851cd1621bf9e098aba3` |

The result records all six center/grid comparisons, channel contributions, probe objectives, original and new proposal rankings, precision/control/work receipts and digests of in-memory reference vectors. Full trajectory/column vectors are not separately archived; exact source and inputs are retained for reproduction.

This remains complementary evidence on the existing joint/spacing receiving branch. The two production drafts and their browser, clean-checkout, maintained packaging and provenance gates remain distinct. Source-distribution intake, original UNKNOWN effects and compiled-export/release holds retain their original ownership and permissions. A verified return of taskboard access changes coordination availability; it does not itself qualify a compute host or these product gates.

## Existing variational and stage ownership

Fresh authenticated A reads recovered `worldlaw-general-variational-integration-followon-366053231788` as ACTIVE revision 2 under `estate-a4c4a106-20261028`, and `worldlaw-rate-work-stages-3e8effdbdffd` as ACTIVE revision 3 under `estate-3e8effdbdffd-20261028`. Historical “No owner reserved” wording in the first scope does not override its current owner field.

This study remains a capsule-pinned linear reference for the two existing joint-fit states and probes. It does not create a maintained stage evaluator, fundamental-matrix API, shared solver hook, nonlinear variational consumer or derivative of adaptive step-selection decisions. The general owner's accepted two-half-step Studio-stage requirement and reviewed derivative-producer interface remain separate from this fixed-step trajectory fixture. The [existing issue395 coordination](https://github.com/Jacob-Met/worldlaw/issues/395#issuecomment-6484830391), accepted-stage ownership, affine/comparator lanes and PR421's original UNKNOWN-merge hold remain intact. Publication of this evidence does not imply owner acceptance or source adoption.
