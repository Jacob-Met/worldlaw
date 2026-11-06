# Finite differences at representable probe locations

## Finding and scope

The bounded LM helper at source commit `0a7ba12e58d714a52fd8f5385b87a1a8600c927e` divides finite differences by the requested step. Floating-point addition can place the actual probes at different spacings. This causes a demonstrable derivative error even when every probe passes the helper's existing distinctness and bounds checks.

This investigation records the defect, a diagnostic formula and its limits. It does not change the production helper, its consumers, admission, budgets or numerical screens. The separate joint-state adoption in [PR 608](https://github.com/Jacob-Met/worldlaw/pull/608) remains independent.

The [native receipt](receipts/bounded-lm-representability-7912183a/native-investigation.json) was produced with Node 24.22.1. The investigation reads all 28 modules of the actual trajectory consumer from the pinned Git commit, uses its real solver, receiver and work reservation, and changes only the derivative expression in memory for the diagnostic arm.

## Small controls with known derivatives

Let $E=2^{-52}$, JavaScript's `Number.EPSILON`. For the residual $f(x)=x$, the exact derivative is one.

| Current point and bounds | Requested $h$ | Actual probe offsets from $x$ | Current derivative | Diagnostic derivative |
| --- | --- | --- | ---: | ---: |
| $x=1+E,\ [1,1+4E]$ | $E/2$ | $+E,-E$ | 2 | 1 |
| $x=1+E,\ [1+E,1+7E]$ | $1.5E$ | $+E,+3E$ | $1/3$ | 1 |
| $x=1,\ [1,1+6E]$ | $1.5E$ | $+2E,+3E$ | $5/3$ | 1 |

Reflecting each case about zero reproduces the same derivative errors and diagnostic corrections. Thus the issue affects both central and inward differences; changing only the central denominator is incomplete.

The receipt also includes ordinary-scale affine and quadratic controls. Their derivative errors are small, and the diagnostic does not establish accuracy beyond the residual arithmetic.

Three refusal controls remain unresolved in both arms:

- An even-mantissa interior point at $1+2E$, with bounds $[1+E,1+4E]$, has available neighboring representable points, but the helper's requested half-ULP step rounds back to the incumbent.
- The interval $[1,1+E]$, starting at its lower endpoint, has only two representable locations. It cannot supply three distinct nodes.
- An interior subnormal point at `Number.MIN_VALUE`, with bounds from zero to four times that value, produces a requested step that underflows to zero.

The diagnostic changes the derivative expression only. It does not change probe selection or claim that all narrow-box refusals are necessary.

## Witness in the actual trajectory fitter

A declared synthetic constant-acceleration course contains five original rows at $t=i/16$, for $i=0,\ldots,4$. Its positions are $(1+4E)t^2/2$, and its supplied initial rate is zero. The actual trajectory fitter starts a single bias coefficient at $1+E$, uses bounds $[1,1+4E]$, one iteration, a maximum integration step of $1/16$ second and a position screen of 0.001 radians.

| Result | Production helper | Diagnostic using actual locations |
| --- | ---: | ---: |
| Selected coefficient | $1+2E$ | $1+4E$ |
| Position RMS, radians | `7.120823289274224e-18` | 0 |
| Actual evaluations | 4 | 4 |
| Evaluation cap | 7 | 7 |
| Reserved integration steps | 84 | 84 |
| Reserved prediction rows | 35 | 35 |
| Selected coarse/refined position difference | 0 | 0 |

Both arms report `training_improved`; the original inputs are unchanged. This is a deterministic accepted-consumer difference, but the demonstrated absolute error is at rounding scale. It does not establish practical scientific harm, a physically meaningful improvement or greater solver accuracy. Agreement between two integration resolutions cannot certify accuracy beyond rounding.

## A wide interval exposes finite-budget sensitivity

The tiny-box witness bounds every possible coefficient change to a few ULPs. A second experiment keeps the same five timestamps, seed $1+E$, integration settings and source handling, but uses positions $1.5t^2/2$ and bounds $[1,2]$. The problematic initial central stencil remains; meaningful coefficient movement is now feasible.

Native Node 24.22.1 corroboration gives:

| Iteration budget | Production RMS, radians | Diagnostic RMS, radians | Evaluations, production / diagnostic |
| ---: | ---: | ---: | ---: |
| 1 | 0.0040770489300693226 | 0.00006296618984674732 | 4 / 4 |
| 2 | 0.0000013585634577187904 | 2.0981736029277847e-8 | 7 / 7 |
| 4 | 5.597002190937326e-15 | 9.469191127342783e-17 | 13 / 13 |
| 8 | 0 | 0 | 24 / 21 |

With one iteration, the production helper selects coefficient 1.2519157143434603; the diagnostic selects 1.50383142868692. The authored target is 1.5. Both arms pass the same numerical screen, consume four evaluations, and retain the seven-evaluation cap with 84 reserved integration steps and 35 prediction rows.

Moving the seed to the ordinary interior value 1.1 largely removes the difference. At one iteration both arms give approximately 6.56708415e-6 radians RMS; at eight iterations both reach coefficient 1.5, zero RMS and 18 evaluations. Every paired budget retains identical reservation and cap, and the original inputs remain unchanged.

This establishes ordinary-scale sensitivity of an early accepted result to the near-bound stencil under a valid finite iteration budget. Additional iterations recover the same optimum in this authored case. The observation is not a general speedup or a persistent accuracy failure, and no wall-clock performance claim is made.

The corrected first proposal still overshoots to 1.50383142868692. Consequently, using the actual spacing does not make tiny-probe residual differences exact. Derivative-expression correction and better probe selection remain separate questions.

## Derivative through the actual three nodes

Let the incumbent be $x$, and let the actual representable probe offsets be

$$
a=x_A-x,\qquad b=x_B-x.
$$

For each residual component, form secants

$$
s_A=\frac{f_A-f_0}{a},\qquad
s_B=\frac{f_B-f_0}{b}.
$$

The derivative at $x$ of the quadratic interpolating these three nodes is

$$
D=\frac{b s_A-a s_B}{b-a}
 =s_A-\frac{a}{b-a}(s_B-s_A).
$$

This follows by writing the interpolant as $f_0+D t+C t^2$. Its two secants are $D+Ca$ and $D+Cb$; eliminating $C$ gives the expression above.

Equal central offsets $a=h,b=-h$ recover the ordinary centered difference. Inward offsets $a=h,b=2h$ recover the ordinary three-point one-sided formula. The expression therefore handles the observed unequal spacings without an additional residual evaluation.

The diagnostic uses the symmetric quotient when the actual central offsets are exact opposites. Otherwise it uses the secant-difference expression, which reproduces equal representable secants exactly. It normalizes $a$ and $b$ before computing their dimensionless weight to avoid needlessly overflowing $b-a$.

This is a diagnostic expression, not a complete proposed production implementation. Finite differences, secants, weights and the final result still require explicit finite-arithmetic and geometry guards. The published reproduction retains the production helper's existing gates; it does not add a new accuracy certificate.

## A limited amplification bound

For an inward stencil with positive actual offsets $0<d_1<d_2$, the secant weights are

$$
\alpha=\frac{d_2}{d_2-d_1},\qquad
\beta=\frac{d_1}{d_2-d_1},\qquad
D=\alpha s_1-\beta s_2.
$$

Assume the incumbent and both probes are rounded in a region with uniform rounding cells of spacing $\Delta$, rounding is to nearest with ties to even, and doubling the requested step is finite and exact. Write $d_1=n\Delta,d_2=m\Delta$. The accepted distinctness checks imply $n\ge1$ and $m>n$; rounding gives $2n-1\le m\le2n+1$.

For $n=1$, distinctness forces $m\ge2$. For $n\ge2$, $m-n\ge n-1$. Hence

$$
\alpha\le3,\qquad \beta\le2,\qquad \alpha+\beta\le5.
$$

The maximum is attained for $n=2,m=3$. This bounds only the dimensionless combination of secants in the stated domain. It does not bound derivative noise: residual errors are still divided by potentially tiny offsets.

The proof is not global over finite binary64 values. A binade crossing changes the spacing lattice; underflow and overflow also need separate treatment. An empirical search cannot replace that missing proof.

## Qualification boundary and next decision

Any production correction should cover central and inward formulas together, preserve two probes per coordinate and the existing complete work reservation, and keep collapsed or nonfinite arithmetic unresolved. Probe-selection improvements are a separate decision. Scaled difference quotients, conditioning policy and trustworthy derivatives of noisy or numerically unresolved residuals also remain separate questions.

The current evidence supports recording a precise numerical limitation and a reproducible diagnostic. It does not justify widening scientific admission, changing physical claims or relaxing a convergence screen.

## Reproduce

From a repository checkout that contains the pinned source commit:

```sh
node --experimental-vm-modules scripts/diagnose-bounded-lm-spacing.mjs
```

The script prints a JSON receipt and makes no product-file changes. `WORLDLAW_RESEARCH_ROOT` can point to another readable checkout containing the same Git object. The native receipt was generated from the same script body with that explicit root. It records source digests, all eleven derivative/refusal controls, the tiny-box consumer witness, and the wide-interval experiment at four budgets with its interior-seed control.

