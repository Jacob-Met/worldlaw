# Complete source-time attribution of frozen prediction errors

After inspecting physical-delay pairs in Trajectory Challenge, **When does the
frozen prediction fail?** partitions the complete original receiving record into
explicit source-time epochs. The first and last boundaries must equal the original
recording's first and last timestamps. Internal boundaries are caller declarations.
Defaults use source-row quartiles, chosen without looking at error values.

Every receiving row belongs to exactly one left-open/right-closed epoch. The
imposed initial row is excluded once, not once per epoch. Original observations,
predictions, timestamps and row indices remain available. No epoch restarts the
integrator, changes initial conditions, fits coefficients or selects a model.

## What the investigator sees

The complete residual timeline remains visible with the selected epoch shaded.
Its signed errors retain their original source-time axis. The table attributes
RMSE, mean error and the share of squared error to every declared epoch; empty
epochs remain explicit. The exact source-row ledger shows each observation beside
its existing prediction. Large ledgers have explicit 200-entry pages.

Each physical-delay pair belongs either wholly to one epoch or to the separate
cross-epoch population. Selecting **Pairs crossing epochs** exposes original pair
indices, both source rows, both epoch identities, exact timestamps, observations,
predictions and errors. No crossing pair is discarded. Pair correlations continue
to use the full receiving mean, unchanged across partitions. Overlapping physical
bands may reuse original pairs, as already declared by the physical-delay tool.

This timeline-and-source-ledger composition was chosen over a standalone ranked
error-bar chart: ranking would hide chronological context and the original
prediction, whereas the timeline shows where the same frozen forecast diverges.
The squared-error fraction is a descriptive numerical share, not physical energy
or a causal allocation. Epochs are not independent experiments, inferred change
points, calibrated significance tests or model-revision instructions.

Boundary edits clear attribution. Changes to the parent source, model, physical
bands or pairing mode retire the entire epoch result. Existing source-only
notebooks reopen through the maintained solver; epoch declarations are entered
again before recomputing. Epoch inspection does not alter those notebook inputs.

## Measured motivation, with its limits retained

The retained Apache-2.0 PASCO recording `pasco-len1-cond1-3` has 2,001 original
rows in source seconds 5–25. Its original bundle Git blob is
`f2297c5c02da094966573e0a3ae28bf787f54d53`, SHA-256
`7e42868153d3aa15fc9722f665f5ed62cc491c4445768f8db74a6e36b85cb0e6`.
The source and unchanged author license are already documented in
`examples/physical-pasco-92be/README.md` and its adjacent `LICENSE`.

The exploration executes the maintained angular solver with the fixed published
rounded coefficients from `research/PHYSICAL_TELEMETRY_92be.md`:
`acceleration = -39.9074995 * sin(angle) - 0.2918417`.
No fitting or model selection is executed; these rounded values are not presented
as an exact recovered full-precision fitted object. Absolute inertia and torque
remain unknown. This recording has already been reused in product development;
it is not fresh independent validation.

The full-recording RMSE is 0.32296949 rad. Four declared five-second epochs have
RMSEs 0.091426, 0.144205, 0.311997 and 0.539205 rad, while their half-second error
cosines remain approximately -0.962, -0.979, -0.987 and -0.988. The final epoch
contains 69.68% of squared error despite containing 25% of receiving rows. The
2,000 receiving rows remain accounted for; 1,950 half-second pairs partition into
four populations of 450 within-epoch pairs plus 150 explicit crossing pairs.
This exposes growing error magnitude without claiming its physical cause.

## Qualification boundary

Seven native epoch groups cover complete row/pair identity, magnitude
reconstruction, exact unchanged incumbent physical output, empty/single/zero
cases, changed-amplitude custody, malformed/full-budget refusal and tiny errors
at large source epochs. Six existing physical-consumer groups remain green after
extracting the shared pair arithmetic. Two tests execute the actual composed
panel handlers against a simulated DOM, including source and boundary invalidation.

Root receiving executed all 27 native groups and six actual sandboxed Chrome
consumer groups: maintained solver/source identity, exact crossing-pair custody,
pending-source retirement, source-only notebook reopening, signed-label bounds
and styled 1440/390-pixel views. The browser opens the parent's original evidence
disclosure before comparing visible prediction values. Exact source hashes and
receipts are in `docs/receipts/residual-epochs-7bb49db0/receiving.json`. The browser
course uses the maintained authored solver; the measured PASCO analysis above is
separate reused-source research. Neither establishes deployment or physical validity.
