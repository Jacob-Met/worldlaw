# Joint-state fit: resolution of final gradients and objective ordering

## Finding

The corrected bounded-LM composition has stable inward/free and outward/bound directions at the two inspected states. Its final free-coordinate gradient magnitude and last-bit proposal ordering are sensitive to the numerical evaluation used for fitting. Passing the maintained position and rate state-value screens does not establish equally accurate residual derivatives or ordering of nearly tied objectives.

At the saved final accepted state, the native rate gradient is approximately **−1.8703e−7** at maximum integration step .02, while the continuous analytic reference gives **−5.1571e−4**. Reducing only the integration step moves the native estimate toward that reference: **−4.6645e−4** at .01 and **−5.1126e−4** at .005. All these gradients retain the same negative sign. The spring gradient remains strongly positive at its lower bound.

The four proposals rejected in the final historical iteration have continuous-reference objectives about **3.65e−18 lower** than the accepted point, while their recorded native objectives are higher. Two proposals have identical represented parameter vectors; there are three unique proposal vectors. This difference is below one binary64 spacing near the reported RMS. It limits interpretation of the final stopping detail; it does not erase the substantive training improvement or establish a new optimizer policy.

This is a fixed-state diagnostic. No optimizer was rerun, and no product source, fit, admission, numerical screen or stopping rule was changed.

## Sources and historical states

This extends [the three-arm composition receiving](JOINT_SPACING_COMPOSITION.md), using the same original three authored courses and corrected helper.

- Original 29-file closure: `0a7ba12e58d714a52fd8f5385b87a1a8600c927e`.
- Composed runtime: `3f70a51626e31b70751271d3bbf8d7ee5456cc5d`.
- Receiving evidence parent: `16834076789307d52458518aca0d5709e7f1b4ea`.
- Candidate joint fitter SHA-256: `2915796fe51f98401461f2f084cc5e0836f1ec149a7c9288166f9c6e28a992a9`.
- Corrected helper SHA-256: `f9a86ac2529a38d83a9e039c5b43912bf493b681d0464dd299503c4e9e67632b`.
- Exact historical input serialization SHA-256: `86efee448961acd995afe70ef052837d071a00ab39392f738d30281bd6d60a89`.

The parameter order is rate coefficient `c`, then spring coefficient `k`, for the authored equation `q'' = c q' + k q`.

| Corrected-arm snapshot | Trial | Rate coefficient c | Spring coefficient k |
|---|---:|---:|---:|
| First accepted spring boundary | 5 | −0.24604286839907222 | −3.85 |
| Final accepted result | 35 | −0.19259937353078452 | −3.85 |

The first boundary state is taken from the corrected-helper arm, not the slightly different old-helper state. The spring value lies on the existing lower bound. Directly evaluating a saved model does not treat that value as a newly admitted fitter seed: the fitter's strict-interior seed rule remains unchanged.

The fixture has three fixed initial states, 126 original samples per course, and supplied-rate observations from the same authored trajectory. Their declared dependence remains “not assumed independent.” Its true spring coefficient −4 is outside the deliberately constrained fitting box. The two channel scales remain .1, used as objective weights rather than independent noise estimates.

## Bounded native protocol

The diagnostic evaluates two centers and their four actual helper probes at each of three integration settings. It takes the corrected helper's exact source prefix through derivative and gradient construction, adds only geometry recording and a diagnostic return, and stops **before** free-set selection, least-squares solving or proposal construction. It also extracts the candidate fitter's exact `modelFor` and `evaluate` bodies into a fixed-state factory. The actual pinned receiver, normalizer, reservation function and trajectory implementation execute through native Node module hooks.

Each model vector evaluates all three original courses. The coarse rollout remains the residual source; the half-step rollout supplies the separate numerical screens. No refined trajectory is substituted into the fit objective.

| Maximum step, seconds | Model vectors | Receiver calls | Reserved coarse-plus-refined steps | Prediction rows |
|---:|---:|---:|---:|---:|
| .02 | 10 | 30 | 28,740 | 3,780 |
| .01 | 10 | 30 | 51,240 | 3,780 |
| .005 | 10 | 30 | 96,240 | 3,780 |
| Total | 30 | 90 | **176,220** | **11,340** |

The loaded maintained reservation function recomputes these totals before execution. Fixed caps are 180,000 steps and 12,000 prediction rows. Actual recorded integration work equals the reservation. Timestamp differences use their actual binary64 values; no assumption of exact .04-step divisibility replaces maintained accounting.

Every model vector completed. Every receiver passed both unchanged .001 screens. The exact .02 center objectives reproduce the historical receipt; final-state probe coordinates reproduce trials 36–39 exactly. Probe coordinates are identical across all three integration settings. Original rows, options and all 29 physical source files remain unchanged.

The native run used Node **v24.22.1**, started **2026-11-06T14:30:17.974Z**, finished **2026-11-06T14:30:20.667Z**, and exited 0. These timestamps describe execution; no speed claim is made.

## Independent continuous reference

For fixed original starts `A = q(0)` and `v = q'(0)`, define

\[
h=c/2,\quad w=\sqrt{-k-h^2},\quad B=(v-hA)/w,
\]

\[
E=e^{ht},\quad C=\cos(wt),\quad S=\sin(wt),\quad
F=AC+BS,\quad T=-AS+BC.
\]

Then `q = E F` and `q' = E(hF+wT)`. The reference explicitly admits only the underdamped domain. At the inspected box, `w² ≥ 1.75`; this is not a critical-damping implementation.

For parameter `p`, use `h_c=1/2`, `h_k=0`, `w_c=−c/(4w)` and `w_k=−1/(2w)`, then

\[
B_p=-(A h_p+B w_p)/w,\quad
F_p=B_pS+t w_pT,\quad T_p=B_pC-t w_pF.
\]

The analytically differentiated position and rate are

\[
q_p=E(t h_pF+F_p),
\]

\[
(q')_p=E\{t h_p(hF+wT)+h_pF+hF_p+w_pT+wT_p\}.
\]

The reference never estimates the rate derivative from sampled positions. It keeps declared `initialRate` values distinct from first observed rate values; for example .2 and .20000000000000004 remain different fixed binary64 inputs.

The Python reference uses standard-library Decimal arithmetic at **80 and 120 decimal digits**, converting each original floating input with `Decimal.from_float`. A byte-level digest verifies that Node and Python use the same original numeric values. Observed data are not regenerated at higher precision.

An independent 181-term ODE power-series recurrence checks the closed-form positions, rates and both sensitivity pairs for 36 selected state/time cases at each precision. Maximum discrepancies are **5.2112e−76** at 80 digits and **5.2482e−116** at 120 digits. The largest difference across the two precision calculations is **1.3135e−70**. This is precision-convergence and independent-formula evidence, not an interval-certified bound.

For error separation, the reference computes both analytic derivative columns and the helper's finite-difference formula applied at the **same represented nodes** in high precision. The latter retains the helper's actual `da`, `db` and weight. This distinguishes same-node stencil error from disagreement introduced by numerical rollout and binary64 evaluation. Summary comparisons convert 40-significant-digit reference vectors to binary64 once; scalar objective/order receipts retain 70 significant digits.

A preliminary import check found no `mpmath` in the selected Python environment. No package was installed. The completed reference uses Python's standard library only.

## Gradient and objective results

Gradients are the helper's unnormalized `Jᵀr`, the derivative of half the scaled residual sum of squares. They are not derivatives of RMS. Position and supplied-rate residuals remain interleaved across all 756 entries.

| Accepted trial | Maximum step | Native rate gradient | Native spring gradient | Native RMS minus continuous RMS |
|---:|---:|---:|---:|---:|
| 5 | 0.02 | -2.441749665e+3 | 2.337066543e+3 | 1.663914240e-7 |
| 5 | 0.01 | -2.441750179e+3 | 2.337065916e+3 | 1.469950262e-8 |
| 5 | 0.005 | -2.441750227e+3 | 2.337065860e+3 | 1.191743371e-9 |
| 35 | 0.02 | -1.870315955e-7 | 2.319226743e+3 | 2.533270085e-7 |
| 35 | 0.01 | -4.664482962e-4 | 2.319226050e+3 | 2.269522026e-8 |
| 35 | 0.005 | -5.112592941e-4 | 2.319225988e+3 | 1.852957898e-9 |

The continuous reference at the first boundary state has rate gradient **−2441.75023080338** and spring gradient **2337.06575975664**. At the final accepted state, they are **−0.000515705582637** and **2319.22586919830**.

All six native gradient sign pairs agree with the continuous reference. The spring coordinate remains active at its lower bound. The initial strong free-coordinate direction is stable; the final near-stationary free-coordinate magnitude is sensitive to the integration resolution. A small column error can matter when its contributions nearly cancel in the gradient.

At the final state, the high-precision same-node stencil's rate gradient is **−0.000515401710072**, close to but distinct from the analytic derivative gradient. Its spring gradient is **2319.22598208961**. Keeping a finite stencil therefore leaves a discrepancy even as integration error decreases.

The following final-state column comparisons use scaled residual derivatives. They are maximum absolute differences across 378 entries in each channel, not physical measurement uncertainties:

| Maximum step | Parameter | Position: native vs same-node stencil | Rate: native vs same-node stencil | Position: native vs analytic derivative | Rate: native vs analytic derivative |
|---:|---|---:|---:|---:|---:|
| 0.02 | rate | 8.718858693e-7 | 2.144185100e-6 | 8.702133831e-7 | 2.142812855e-6 |
| 0.02 | spring | 5.705130759e-7 | 1.005024513e-6 | 4.620817426e-7 | 1.203467622e-6 |
| 0.01 | rate | 8.128172269e-8 | 2.049315988e-7 | 7.960923654e-8 | 2.035593543e-7 |
| 0.01 | spring | 5.462704067e-8 | 9.405335888e-8 | 3.675262725e-7 | 1.271598983e-6 |
| 0.005 | rate | 6.955334975e-9 | 1.769181956e-8 | 6.618961379e-9 | 1.923692405e-8 |
| 0.005 | spring | 4.612214388e-9 | 7.885634368e-9 | 3.811610423e-7 | 1.276685822e-6 |

The spring column approaches its finite-stencil floor rather than improving monotonically against the continuous derivative. This is why smaller integration steps alone do not certify exact derivatives, and why an unconditional larger stencil is not adopted. The earlier smooth-function counterexample to that policy remains valid.

## Last proposal ordering

The historical helper accepts only a strictly lower computed RMS. Its last iteration uses trials 36–39 as derivative probes and proposals 40–43. The table compares each proposal with accepted trial 35 under its own evaluator:

| Historical proposal | Rate coefficient | Recorded native RMS difference at .02 | Continuous reference RMS difference |
|---:|---:|---:|---:|
| 40 | -0.19259937352716067 | 5.551115123e-16 | -3.649428383e-18 |
| 41 | -0.19259937352716067 | 5.551115123e-16 | -3.649428383e-18 |
| 42 | -0.1925993735271608 | 1.110223025e-16 | -3.649288651e-18 |
| 43 | -0.1925993735271623 | 2.220446049e-15 | -3.647779550e-18 |

All proposal spring coefficients remain −3.85. Proposals 40 and 41 are identical represented vectors and are retained separately as historical attempts. Both precision runs preserve their equality and the continuous ordering of every proposal.

The continuous differences are about 0.033 of one binary64 spacing near RMS .677. The observed native-versus-continuous objective discrepancy at the accepted point is about 2.53e−7, but that absolute discrepancy alone is not a bound on pairwise ordering error. The native decision involves numerical integration, binary64 residual/stencil/solver calculations and norm rounding; this experiment does not attribute the reversal exclusively to one mechanism.

The historical label `no_improvement` accurately records that none of those four proposals lowered the computed objective. It is not a certificate of stationarity or optimality for the continuous authored system. No new tolerance or acceptance margin is inferred from this one fixture.

The broad improvement remains: the continuous objective decreases from approximately **.7996828631** at first boundary entry to **.6772444559** at the final accepted state. The newly exposed uncertainty concerns last-digit parameters and late termination detail, not the existence of that training improvement.

## Reproduction and retained evidence

Files:

- [Native driver](../scripts/diagnose-joint-gradient-resolution.mjs).
- [High-precision reference](../scripts/reference-joint-gradient-resolution.py).
- [Pinned source/input capsule](receipts/joint-gradient-resolution-7912183a/source-input.json).
- [Native receiving receipt](receipts/joint-gradient-resolution-7912183a/native-resolution.json).

From a checkout containing these research files, with the original 29-file source closure available separately:

```sh
node scripts/diagnose-joint-gradient-resolution.mjs \
  --source-root /absolute/path/to/pinned/original/source \
  --python python
```

The actual native invocation used the same driver via Node `-e`, with explicit `--input-json` and `--reference-code` text. Default adjacent-file loading has not been executed. Python is invoked with `-B`; the diagnostic uses memory for derived sources, reference exchange and numerical vectors. No compiled application payload is created or exported.

The receipt retains all 30 model-vector results, every course's numerical screens and work counts, exact geometry, per-channel derivative discrepancies, gradient values, historical proposals and both high-precision ordering calculations. Full residual/column arrays were compared in memory and hashed; those arrays are not separately archived. Exact sources and input custody make the summaries reproducible.

| Artifact | SHA-256 |
|---|---|
| Native driver | `7035066e8979e73d7daefd5e9c8b4d5795974ea612f779bc7c8f64de1fe12814` |
| Python reference | `cbdfb9672f4ec5c167a363d9196a7d83b1449e8a78ecdb6382a961e950291e33` |
| Source/input capsule, no trailing newline | `68e3cfa5f21ad26483ab1d71d2e28ee7ebbabc4e35a9df1847e736f5d41b671b` |

The earlier complete fit and maintained-test evidence remains separate. These 30 evaluations do not add new optimized fits or maintained test counts.

## Integration and remaining ownership

This evidence stays on root's existing joint/spacing receiving branch. Draft608 and draft610 retain their original source heads and remain unmerged. This study neither adopts a generic derivative policy nor relaxes clean-checkout, file-writing/provenance, maintained HTML/manifest, notebook or browser receiving.

The original B owner and UNKNOWN operation handles remain preserved; no new native taskboard revision is claimed. Root's bounded-helper and joint-state tasks are last verified ACTIVE r8 and r5. Scientific ownership, source-distribution intake, inherited standalone return-worker recovery and existing evaluator/physical-validity holds remain separate.

A useful next numerical design must account for both integration resolution and finite-difference resolution under complete work budgets, with unrelated counterexamples retained. This receipt supports that question without choosing a new policy prematurely.
