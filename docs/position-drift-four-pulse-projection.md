# Projected support search for four-pulse menus

The existing compact-menu command uses projected source supports when the supplied tree has more than four leaves. Smaller menus already meet the universal support bound and retain the simplex. The direct output records every strict rational lower-bound jump as well as the final compact menu and all original boundary histories. The full simplex remains explicitly available. Each method receives the one budget declared in the input.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-full-group-menu.json --four-pulse-compact --output projected.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-full-group-menu.json --four-pulse-compact-simplex --output simplex.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-full-group-menu.json --four-pulse-compact --replay projected.json
node --test tests/position-drift-four-pulse-projection.test.mjs
```

Historical v1 refusals replay with the original simplex and its original work accounting. A projected v2 refusal replays with the projected implementation. Neither design silently spends a second budget running another solver.

## Local projections and closed line envelopes

Each complete word’s three gauged position contrasts occupy a clean hull plus the shared five-error zonotope. A normal exposes a facet at positive ε when its maximizing face has two independent tangent directions, drawn from differences between maximizing clean vertices and from error generators orthogonal to the normal. Check each family separately before combining equal normals. All actual facets remain. The same halfspaces describe the clean hull at zero by the closed limit. A constant-offset mixture alias on the commands used gives an immediate zero-radius certificate: the original mixture rates and a compensating drift produce a common physical history on every leaf.

Eliminate each private terminal coordinate v within its own leaf. The surviving planar inequalities constrain the single root s and the intermediate w of that third command. Parallel inequalities have right-hand sides h+rε. Their pointwise minimum is a finite lower envelope. Cache it once for the leaves sharing that w. At a given ε only its active member matters for that direction.

The planar inequalities at the trial ε give affine lower and upper bounds on w as functions of s. Form the upper envelope of the lower bounds and the upper envelope of the negatives of the upper bounds. Sort by slope, keep the highest parallel intercept, and remove a line if its switch would precede the previous one. Sweep both envelopes over the root axis. Only pairs active at some common s can give the largest lower-minus-upper violation. Those pairs plus the direct root and constant constraints therefore describe the exact root region at this ε. Lines coincide in value at their breakpoints, including simultaneous switches, so point contacts remain feasible. This avoids pairing every lower line with every upper line. Different third commands retain private intermediate readings throughout.

## Exact jumps

An infeasible root produces an inequality 0≤H+Tε. It combines only nonnegative original support rows and its coefficients cancel in the appropriate ancestral columns. Although selected at the trial ε, it is a valid inequality at every noise level. A common history is feasible for sufficiently large finite noise, so T>0 for a violated scalar row. Jump directly to −H/T. This is strictly larger than the trial and cannot exceed the first failure.

At every elimination level the source supplies only finitely many coefficient combinations. Normalizations and multipliers depend on the source coordinate coefficients, independently of ε. Each jump therefore advances to a distinct member of a finite set of bounds. At the first feasible trial, reconstruct s, each branch’s w and each leaf’s v from their closed intervals. Recover the original persistent mixtures, starts and clean positions for all counterfactual leaves. The last lower certificate and the full physical boundary establish the exact radius. The support uses at most eight rows from at most four leaves; repeated copies of the same starting inequality are coalesced.

The existing source-based verifier checks strict increase, the supporting rows at each jump, the final lifted and restricted lower proofs, and the physical trajectories. No envelope or optimization must be rerun to check a positive result.

## Work on the original and changed inputs

The 64-leaf grouped source drops from 623,262 charged units with simplex to 75,424 with projection. The single positive jump gives 1/40, retains the same four command paths and reconstructs every original boundary history. Under a 100,000-unit limit the original result is exhausted, while projection certifies that radius. Both saved results replay under the current public CLI.

The tetrahedron source takes the three positive jumps 5/376, 1/68 and 1/65. Its projected search uses 71,645 charged units versus 52,734 with the original simplex (1.359×). The frozen changed-input comparison runs 48 catalogs with three to five commands and one to four vertices per family. Projection uses less work on 40 of 48; total work falls from 3,689,076 to 1,891,574. Its worst case uses 34,720 units versus 17,598 with simplex (1.973×). Work units measure charged operations and do not imply a fixed wall-clock ratio.
