# Receive two-coordinate circulation

Coupling Lab's **Take the response around a closed path** instrument compares
ordered paired-angle/paired-torque readings with every currently estimable affine
response. The path sketch is the source polygon in angle space, not reconstructed
physical geometry. The numbered order, source readings and shared work weights
remain inspectable. Receiving does not fit models or change the active notebook.

Supply `worldlaw.coupling-circulation/v1` JSON using the authored input as a
structural example. Declare measured or synthetic source, the exact training
coordinate-convention text, rad and N·m units, exact input angles, piecewise-linear
torque between samples, no missing segments and a nonnegative integration
allowance in joules. Supply 4–1024 readings, each with two-element `q`, `torque`
and nonnegative `torqueRadius` arrays. The final angle pair must exactly equal
the first; its torque and error remain a separate reading. The application never
invents a closure, smooths the data, or estimates the integration allowance.

For each coordinate, the maintained scalar Cycle Work implementation forms the
shared trapezoidal reading weights and bounds their floating-point evaluation.
The two coordinate contributions are summed with an additional arithmetic guard.
An interior reading's weight is half the difference of its neighbouring angles;
endpoint readings retain distinct weights. Thus a reading used by two segments
has one error variable. The sum of absolute weight times each declared radius
bounds independent component reading errors. These are deterministic bounds,
not probabilities. Constant coordinates contribute exactly zero.

Each fitted affine field is evaluated at those same positions using the maintained
`predictCoupling`. A roundoff allowance for the matrix products is propagated
through the same work engine. Trapezoidal integration is exact for an affine
field along each straight segment in exact arithmetic. Fitted coefficient errors
are not propagated. Disjoint observed and numerical model intervals are labeled
**incompatible**; overlap is **not-separated**, not a complete response-field
validation. Coordinate-range extrapolation is explicit for every candidate.

An authored unit-square directional field `τ = [-θ₂, θ₁]` gives +2 J; the
reciprocal field `[θ₂, θ₁]` gives zero. Reversing traversal changes the sign.
The conservative nonlinear gradient `[2 θ₁ θ₂, θ₁²]` deliberately gives a
nonzero polygonal result on asymmetric sampling. It demonstrates that quadrature
error alone can look like circulation. Nonzero results do not establish
continuous-path work, dissipation, energy production, passivity or a mechanism.
Returning two angles does not establish closure of hidden physical state.

**Save source inputs** retains the entire normalized training notebook and loop.
Reopen recomputes both separately from the active notebook and trusts no stored
verdict. This is retrospective receiving, not authenticated prospective freezing.
Editing source inputs or changing active training invalidates displayed results.
No coordinate or torque evidence is sent to a service. Files are limited to 4 MiB.

## Design decision

Two compositions were considered: scalar result gauges beside the existing
field, and a numbered closed-path instrument with fitted work comparisons.
The latter makes the new experimental observable—the traversed two-coordinate
loop—visible directly. It retains the existing laboratory and source-controlled
workflow; it does not replace the coupled-motion or scalar history instruments.

## Verification

`node tests/coupling-circulation.test.mjs` exercises independent analytic fields,
all 1024 sign combinations of ten bounded reading errors, reversal, separate
closing readings, constant coordinates, the nonlinear conservative counterexample,
source invariance, input-only replay and invalid declarations. The actual browser
receiver is `BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/path/to/receipts node scripts/coupling-circulation-browser.mjs` and requests the browser's normal sandbox.
Run `npm run verify` for maintained native and launched-server regression.

The browser receiver reuses the maintained Experimental Earth sandbox-admission
module unchanged (SHA-256 `4607c67b360596ee06b36e41a6b5d3a8a6da70defb04292d955f609dcef05ead`).
It checks the same isolated browser process before loading the product, retains
the status receipt, keeps actual downloaded inputs and reopens their filesystem
path through the browser file chooser. Failed receiving retains its profile and
failure record. This is browser execution evidence, not physical validation.
