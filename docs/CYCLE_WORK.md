# Signed work from an ordered torque–angle return

Open `/cycle-work.html` from the workbench. Load an authored control or paste/reopen input JSON, inspect its declared source and units, then Analyze. The trace numbers follow acquisition order; the ledger preserves every segment. Reverse order changes the sign and is a new declared input. Export saves normalized observations and assumptions only; reopening recomputes. Editing clears stale results; a late file read cannot replace newer inputs.

For segment i the instrument evaluates `(theta[i+1]-theta[i])*(torque[i]+torque[i+1])/2`. Angles are exact declared values, affirmatively retained as `angleAssumption:'exact-declared'`; no wrapping, sorting or closing segment is inferred. End angle must equal start angle exactly. Repeated angles are allowed and contribute zero segment work. This is angle closure, not full hidden-state or thermodynamic closure.

The same torque reading contributes to both adjoining segments. Its coefficient is the sum of their half-angle increments. With bounded reading error `|error[i]| <= radius[i]`, the exact box bound for polygon work is `sum(abs(coefficient[i])*radius[i])`. This does not assume statistical independence: every error combination satisfying those bounds is covered. It neither treats repeated equal rows as the same error variable nor authenticates sensor calibration. First and last readings remain distinct. A genuinely common constant torque bias cancels on the exactly closed angle path.

Interior shared coefficients are evaluated directly as `(theta[i+1]-theta[i-1])/2`, with separate endpoint coefficients. Summing two separately rounded half-deltas can erase a small coefficient near a large reversal. The nominal work uses these shared weights. The segment ledger is diagnostic: its separately rounded sum and difference from the shared-weight total are disclosed.

The reported interval adds the caller's absolute integration allowance and a floating-point guard to this box bound. The guard includes coefficient subtraction error acting on both torque and torque radius, product and sequential-sum error from uncancelled weighted magnitudes, and conservative error in assembling the bounds. Severe cancellation can therefore make the interval inconclusive. It is not a confidence interval. Angular measurement error is unsupported; a positive integration allowance alone does not validate it. Zero allowance explicitly claims the polygon is the object evaluated, not that continuous interpolation error is known to vanish.

## An essential counterexample

Torque=theta² is a conservative position-only law. Samples at angles `[0,1,2,0.5,0]` yield polygonal work −0.25 J while the exact continuous closed-path integral is zero. Unequal sampling changes quadrature. An allowance of 0.25 J includes zero. The fourth authored control exposes this in the actual consumer. Excluding zero tests only the declared polygon/bounds unless independent evidence justifies an allowance covering the continuous path. Compatibility with zero cannot establish conservativity, and nonzero work cannot identify friction, hysteresis, an energy source or a mechanism.

## Input and limits

Schema `worldlaw.cycle-work/v1` requires `units:{position:'rad',jointTorque:'N·m'}`, source text, `angleAssumption:'exact-declared'`, `interpolation:'piecewise-linear'`, `gaps:'none-declared'`, nonnegative `integrationAllowance`, and 3–4096 ordered samples `{position,jointTorque,torqueRadius}`. All quantities must be finite; angle magnitude ≤1e6, torque/radius/allowance ≤1e12. Unobserved gap flags, incomplete closure, missing declarations and constant-angle records are refused. JSON is capped at 2,000,000 UTF-8 bytes. There is no hardware, provider or network acquisition.

## Verification and design

Run `node --test tests/cycle-work.test.mjs`. The tests include all 64 corners of an authored uncertainty box, reverse-order and bias controls, shared turning-point cancellation, nonlinear conservative quadrature, explicit angle declarations and UTF-8 byte limits. Run `node scripts/cycle-work-browser.mjs` with the maintained Playwright/Chrome environment conventions for real input, keyboard, export/reopen, stale-file and narrow-layout receiving. Existing whole-product tests and smoke remain integration gates; a component pass alone is not a shipped-product claim.

The design compares a large observed torque–angle trace with a moving-mechanism scene. The trace is selected because the source contains no clock or observed mechanism geometry: animation would invent states. Its signed segment ledger is a directly inspectable measurement object, not an unrelated dashboard chart. The trace shows central readings; the full interval is reported numerically. Existing fitting, simulation and manual-planner owners remain intact, including the PR9 hold.

Actual remote browser artifacts, exact composition and review results belong in the integration receipt. No physical acquisition or category qualification is claimed.


### Exact arithmetic enclosure control

`tests/cycle-work-exact-enclosure.test.mjs` independently checks 160 deterministic cases (seed 418617), including subnormal inputs, mixed magnitudes and the 4096-sample limit. A BigInt dyadic oracle compares interval endpoints without converting the exact oracle back to floating point. It covers shared torque coefficients and cancellation independently of the production arithmetic.


## Refine the sampling

The same instrument can propose a frozen grid under explicit per-segment curvature bounds and receive separately supplied new torque readings. Coarse and refined enclosures remain conditional on the declared response branch, smoothness and measurement bounds. See [Curvature-bounded refinement](CYCLE_REFINEMENT.md).
