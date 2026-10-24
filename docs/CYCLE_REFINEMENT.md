# Curvature-bounded refinement and new-reading receiving

The second Cycle Work instrument asks whether signed work remains distinguishable from zero after a justified allowance for curvature between samples. It reuses the original cycle arithmetic and retains every original reading, including both endpoints of a zero-angle torque jump. It does not fit a law or infer smoothness.

## Scientific contract

For each nonzero original segment explicitly declare monotone angle, no gaps or hidden reversals, twice differentiable response, and an upper bound M on the absolute second derivative of torque with respect to angle (N·m/rad²). Supply the basis for that declaration. The conditional trapezoidal error is M times the sum of absolute cubed substep widths divided by 12. Each branch keeps its own declaration. A zero-angle jump has zero work and no smoothness inference across it.

The planner uses actual represented affine-grid angles when bounding remainder, with conservative subtraction, product and sum inflation. Coincident/unordered represented angles refuse subdivision. The final grid is frozen before acquisition. A budget increment in the allocation algorithm is not an instruction to acquire a point immediately: equal grids at n=2 and n=3 are nonnested. Greedy largest conservative bound reduction has deterministic original-segment tie order. Exact-arithmetic unit-cost convex allocations have the usual greedy property; the implementation makes no global optimality claim for its rounded conservative objective. Zero-curvature segments consume no budget. Budget is 0–128 additional readings, and original plus proposed readings must not exceed 4096.

The original additional integration allowance is retained and added to curvature error at both resolutions. It should represent any other error allowance; counting a previously included curvature allowance again is conservative but may obscure a result. Combined allowance above the maintained 1e12 J limit refuses. Exact declared angles, bounded torque errors and the original core arithmetic guard remain in force.

## Receiving and replay

Notebook `worldlaw.cycle-refinement/v1` stores a request containing the complete original cycle, all curvature declarations and budget. The acquisition retains an exact copy of this normalized request, an affirmative same-directed-response-branch assumption, and each new observation's original segment/index, requested angle, acquisition ID, provenance, torque and torque radius. Missing new readings remain pending; there is no partial refined verdict. Duplicate IDs/locations, wrong angles, invalid readings and stale request copies refuse. Changing the budget or source requires a new request. Saved computed reports are ignored; reopening reruns planning and integration from inputs.

The request identity is an exact serialized input comparison, not authentication or trusted acquisition time. Preserve the exported request verbatim, including key order. A later physical cycle cannot simply be inserted into an earlier dynamic trajectory: the declared same branch assumption needs an independently defensible basis. This instrument does not establish repeatability or that the operator acquired new measurements at all.

Prepare declarations from the current cycle leaves curvature, basis and smoothness unfilled, so a user must supply them. The authored controls explicitly supply analytic curvature and use a separate analytic evaluator at the final requested angles. They never interpolate endpoint torques. Their observations are labelled simulation throughout. Only the unchanged authored request is eligible for this convenience execution.

## Evidence and counterexamples

The conservative torque θ² at uneven outbound/return angles has nonzero polygonal work. Its correct curvature bound M=2 keeps zero compatible at coarse and refined resolutions. A falsely supplied M=0 can falsely exclude zero; the test deliberately retains this counterexample because endpoint data cannot validate the bound. A branch-dependent ±0.1 torque offset is inconclusive coarsely and becomes positive with separately evaluated fine readings. Wide actual reading bounds can leave it inconclusive despite fine sampling.

Run `node tests/cycle-refinement.test.mjs` and `node scripts/cycle-refinement-browser.mjs` using the maintained Playwright/Chrome environment variables. The browser receiver includes actual download/reopen, keyboard proposal, partial/stale acquisition controls, async import race and desktop/narrow rendering. No browser receiving, hardware operation, physical mechanism identification or category qualification is implied by native arithmetic tests.

Ownership: #67 continues #52. Angular cycle loss #55, scalar uncertainty #58, coupling, stiffness and other owners remain unchanged. PR9 retains its exact manual/draft hold.
