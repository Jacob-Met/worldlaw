# Identifying a family with one persistent rate parameter

In the Hidden-state workbench, choose **Separate families with one persistent rate parameter**. In each family the two endpoint rows give the rates at parameter values zero and one. Linear interpolation gives the rate at any real parameter between them. One parameter, initial position and constant drift apply throughout a physical run. The goal is to identify the family, even when its parameter remains uncertain.

Freeze the plan, record the starting position and the position at the end of each command block, and reopen the notebook to continue. Each surviving family shows its closed parameter interval and one compatible parameter, position and drift. Choose **Trace overlapping continuous rate families** to replay two indistinguishable members on a command word of your choice. This second flow produces a synthetic trace.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-rate-segments.json --create-notebook --output segments.json
node scripts/active-linear-family.mjs --notebook segments.json
node --test tests/position-drift-rate-segments.test.mjs
```

## All-horizon criterion

For each endpoint rate vector, subtract its first-command rate from all the remaining coordinates. This removes exactly the constant offset that can be absorbed into the unknown drift. The projected family is a closed line segment. If two segments intersect, the reported parameter on each gives rates differing by the same constant on every command. Adding that constant to the second initial drift makes every commanded increment and position equal. An adaptive policy can therefore receive identical observations at every step. Overlap is pairwise and can be nontransitive.

For disjoint segments, the set of differences is the image of a closed parameter square under an affine map. Find its point p of least squared distance from zero. On an edge this is an ordinary scalar projection clamped to the edge. In the interior solve the two normal equations using their Gram matrix. A singular Gram matrix collapses the image to a segment or point, all of which is already covered by edges. These finitely many candidate calculations use rational arithmetic, including for crossings strictly inside both segments.

For any possible difference d, the segment from p to d remains in the difference set. The one-sided derivative of the squared norm at p gives p·d ≥ p·p. Equality holds at the minimizing pair. Give every command except the first its corresponding coordinate of p as weight. Give the first command the negative sum of the others. The weights sum to zero and the gap between the families’ weighted rate intervals is exactly p·p, strictly positive.

Apply every command in source order for n pulses. The weighted sum of block displacements cancels constant drift. Written in terms of boundary positions, its coefficients are the negative first weight, successive differences of neighboring weights, and the final weight. For an absolute per-reading error ε the contrast has radius R equal to ε times the sum of the absolute boundary coefficients. Choose n strictly above 2R/(p·p), taking the maximum integer requirement across all pairs. This one fixed schedule separates the entire finite catalog uniformly over all parameter choices, starts, drifts and admissible reading errors. It supplies an upper bound on the pulse count. No optimality over all schedules is claimed.

## Receiving checkpoints

At a fixed parameter θ, subtract the accumulated forcing from every position. What remains must lie within ε of one line through time, so the allowed initial position and drift form an intersection of closed strips in a plane. By Helly’s theorem it suffices to check every triple. For times i < j < k the weights (k−j, i−k, j−i) cancel an affine trajectory. Their absolute sum is 2(k−i), so the contrast of the forcing-adjusted readings must lie within ±2(k−i)ε. The condition is also sufficient for three strips: the bounded independent errors attain every contrast in that closed interval. Each side is linear in the same θ. Intersect all these constraints with [0,1], then recover and check one physical start at a member of the resulting interval. This keeps both endpoint contacts and singleton parameter sets.

## Closed-boundary control

The three-command example compares (0,0,0) with (0,−1+3θ,−2+5θ). Each two-command subset has an exact alias at θ=1/3, 2/5 or 1/2. Using all three gives weighted rates 0 and −1 with weights (2,−5,3). The checkpoint coefficients are (−2,7,−8,3), with error radius 20 at ε=1. The shipped schedule uses 41 pulses per command.

At 40 repeats, both families can report (−1,1,7,9). The first starts at −2 with drift 1/10 and physical positions (−2,2,6,10). The second starts at zero with zero drift, θ=2/5, and positions (0,0,8,8). Every observation is within one of each trajectory. The 40/41 distinction is for this equal-block schedule. The global minimum remains open.
