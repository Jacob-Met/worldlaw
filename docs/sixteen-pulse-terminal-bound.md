# A sharp nominal-prefix upper bound for sixteen pulses

For the registered source, the unrestricted sixteen-pulse radius lies in **[5/32,5/31]**. The [fixed course](fixed-tape-optimum.md) of ten references followed by each suffix once separates below 5/32. The new causal collision at 5/31 tightens the balanced midpoint upper 1/6. The endpoints have different proof scopes. Equality at 5/32 remains open for unrestricted feedback. The already established minimum sixteen at ε=3/20 is unchanged.

## Testing measured feedback first

The worst baseline-first source word in the initial comparison began with eight references and x0. A controller reads positions at 0,8,9, chooses *any* seven-command tail, and reads the endpoint at 16. At ε=5/32 **every policy in this class has a collision**. Set the first three readings to zero. The final reading can depend on the chosen tail. Ordering inside a tail has no effect on its terminal position in this checkpoint model.

For an original vertex v write q for the sum of its rates over x0 and the tail. Eliminate constant origin and drift via U=8Y₉−9Y₈+Y₀ and V=8Y₁₆−16Y₈+8Y₀. Its clean image is (8(v_x−v_ref),8(q−8v_ref)). The attainable region of a law is the hull of its four vertex images plus the zonotope with generators ε(1,8), ε(−9,−16), ε(8,0), ε(0,8). Those four vectors preserve the correlations between errors at all four checkpoints. The common affine gauge realizes any chosen Y₀,Y₈. At U=0 the test independently intersects the two closed V intervals for all 3,432 tail histograms, deriving every face from the actual vertex differences and zonotope generators. This rejects feedback using only these checkpoints and leaves controllers with earlier or intermediate observations in play.

## Complete upper construction

Display the cumulative mean μ of balanced A=(1,2,1,2)/6 and B=(2,1,2,1)/6 through tick fifteen. The signed rate difference is zero on B={ref,group} and 1/6 on each of the six suffixes S. The [three-time strip criterion](nine-pulse-causal-obstruction.md) bounds every proper span by 7/45<5/31. On a full span, only pure opposite blocks of lengths (7,9), (8,8) or (9,7) can exceed the integer threshold 384·(5/31)=1920/31. One category mismatch loses at least seven from the split product. The maintained test checks this characterization on all 65,536 category words.

Use the [source transfer lemma](all-large-horizon-adaptive-optimum.md) with **rational deficit** d=bs−1920/31 for baseline length b and suffix length s. The lemma uses only the sign and magnitude of d. For b=s=8, d=64/31; for the two adjacent splits, d=33/31. The correction is C=d/(6b), with α=1/12−2ε/b and β=1/12−2ε/s. At each of the three splits the exact receiver checks α≥C, (s−1)α≤2ε, 2ε≥(s−1)C, β≥C/s and (b−1)β≤2ε. At b=s=8 the first inequality is equality. The same list of splits is closed under exchanging the blocks.

On nonuniform within-group histograms shift A x/y or B x−z/neutral. The only uniform within-group possibility has suffix length nine and unequal group counts; use the A cross-group suffix transfer for all references or exchange the signed block roles and move neutral B mass when a group command occurs. The individual mass change is at most 4/93<1/6. Each exceptional completed word therefore has original constant mixtures, initial positions and drifts matching all retained nominal readings. The terminal physical gap is exactly 2ε, so give the midpoint *after* the last command. All other words retain μ at the final tick. The program needs only a run-length transcript and the fixed eight-command table.

## Why the nominal prefix cannot do better

Take ref⁸ x0 y1 x1 x0 z0 z0 z1 y0. If the nominal mean is retained through tick nine, every pair of physical worlds matching those readings and a common terminal reading requires ε≥5/31. The [sparse seven-term certificate](../examples/sixteen-pulse-nominal-prefix-limits.json) uses only ticks 0,8,9 and 16. All coefficients are nonnegative; their weighted original inequalities cancel all eight masses, origins, drifts and shared readings, yielding −ε≤−5/31. On a suffix-first literal word the second certificate forces ε≥14/87. Independent direct substitution checks both exact inequalities. Consequently 5/31 is the exact ceiling for the strategy that retains μ through tick fifteen and chooses a free terminal reading. Beating this upper certificate on the first word requires an earlier response by tick nine.

```sh
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-sixteen-pulse-upper.json --terminal-bound
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-sixteen-pulse-upper.json --terminal-bound --runs received-runs.json
```
