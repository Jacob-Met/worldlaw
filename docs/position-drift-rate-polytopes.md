# Persistent mixtures of command rates

In the Hidden-state workbench choose **Separate families with persistent mixture weights**. A family supplies one exact rate row per vertex. Any convex combination is allowed, with the same nonnegative weights summing to one for the entire run. Initial position and constant drift are unknown. The finite schedule identifies the family whenever this is possible uniformly over those choices.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-rate-simplex.json --create-notebook --output simplex.json
node scripts/active-linear-family.mjs --notebook simplex.json
node --test tests/position-drift-rate-polytopes.test.mjs
```

## Classification and the finite experiment

Subtract the first-command rate from every other rate on each row. This quotient removes precisely the constant rate offsets absorbed by the unknown drift. Call the resulting vertices of two families Aᵢ and Bⱼ. Their compact convex hulls are disjoint exactly when there is a vector w with w·(Aᵢ−Bⱼ) ≥ 1 for every vertex pair. A strict separating normal can be scaled to unit margin because the number of pairs is finite. Conversely the inequalities hold throughout both hulls by linearity.

The exact rational solver either returns such a normal or positive weights on a contradiction. It may first clear denominators and divide rows by a positive gcd. To recover a physical alias, multiply each contradiction weight by the same positive scale that produced its stored inequality. The weighted sum of the original differences is then zero and the total weight is positive. Normalize this mass; its two marginals are nonnegative barycentric coordinates, one set in each family. Reconstruct the two raw rate vectors. Their difference is constant across commands, so adding it to the second initial drift gives identical trajectories for every fixed or adaptive experiment. Reversing the law order reverses the drift shift. Family overlap is recorded pairwise.

For a separating normal, put the negative sum of w on the first command and its coordinates on the remaining commands. These command weights sum to zero. Their weighted rate intervals have a positive gap g that can be read off the finite vertices. Use n pulses per command in source order. The weighted sum of block displacements has noiseless gap n·g. Its measured error has radius R = ε times the sum of absolute checkpoint coefficients: the negative first command weight, neighboring weight differences and the final weight. Choose the maximum over pairs of floor(2R/g)+1. This strict inequality includes the noise boundary correctly. The schedule provides an upper bound; the global minimum is open.

## Persistent physical region and work limits

For a family with k vertices, retain its first k−1 weights, position and drift as joint coordinates. The final weight is one minus the sum of those retained. Nonnegativity gives the closed simplex. At each measured tick the predicted position is affine in these coordinates because each vertex's command forcing has accumulated along the same tape. Append the two closed inequalities for the declared error. These rows describe the complete feasible region, including correlated weights, start and drift, in the coordinate order recorded in the notebook. The receiver either supplies a member or verifies an exact positive contradiction. Redundant vertices are permitted and their weights need not be unique.

The source sets separate designWork and receiverWork limits. Each constructed input inequality and each charged step in recursive halfspace intersection consumes a unit. A unit can include arithmetic on a vector of rational numbers. The receiver applies its limit to the entire measurement prefix across all families. An exhausted design returns an inconclusive result. An exhausted receiver keeps the supplied readings and reports no family verdict. A completed, physically impossible prefix returns an empty survivor list. Reopening recomputes the same distinction.

## A strictly two-dimensional case

Family A has four zero rates. Family B has rates (0,λ₁,λ₂,λ₃) with nonnegative λ and Σλ=1. Every three-command subcatalog has an alias. Omitting the first command requires all three weights to equal 1/3, an interior point that no edge or vertex contains. All four commands jointly have fixed contrast 0 for A and 1 for B with command weights (−3,1,1,1). The checkpoint coefficients are (3,−4,0,0,1), so the error radius at ε=1 is 8 and 17 equal repeats suffice.

At 16 repeats A can start at −2 with drift 1/4 and B at zero with zero drift and uniform weights. Their positions are (−2,2,6,10,14) and (0,0,16/3,32/3,16). Both admit the same measured record (−1,1,17/3,31/3,15). This collision establishes the exact 16/17 boundary for the displayed equal-block experiment.
