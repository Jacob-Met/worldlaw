# The unrestricted eight-pulse first collision is 1/14

Against the registered eight-command catalog, the [measured paired-suffix policy](paired-suffix-calibration.md) succeeds below **1/14**. At equality the causal receiver here gives every adaptive controller one measured history admissible under both laws. Thus the eight-pulse adaptive optimum is exactly 1/14, compared with 1/16 for a fixed tape. Combining this obstruction with the [nine-pulse result](nine-pulse-causal-obstruction.md) gives **minimum nine pulses on [1/14,1/12)**. The [subsequent seven-pulse obstruction](seven-pulse-causal-obstruction.md) matches the paired-suffix lower at 1/16.

## Why the fourth reply changes

Consider ref,ref,ref,x1,y1,z0,y0,x0. Even when every later reading is free, retaining the balanced midpoint through tick four forces radius at least 3/40. Use Y₀=Y₃=0 and Y₄=1/4. With an upper row defined as clean minus observed ≤ ε and a lower row as its negative, combine the A rows (upper 0, lower 3, upper 8) with weights (1/6,4/15,1/10). Combine the B rows (lower 0, upper 3, upper 4, lower 8) with weights (2/15,2/15,1/10,1/10). All origins, drifts and the shared terminal reading cancel. A's final rate sum is one; B's final sum equals its x1 increment at tick four. The result is 1/10−(1/10)(1/4)=3/40 ≤ ε. Equality is physical: A masses (0,3/5,1/10,3/10), origin 3/40, drift −1/20; B masses (2/5,2/5,0,1/5), origin −3/40, drift 1/20. Both admit (0,0,0,0,1/4,3/10,1/10,1/20,3/5). A search over 512 continuations of ref⁴,x1 isolated two supporting words. Their symbolic measured policy falsifies the 1/15 target.

Every stationary displayed rate vector u has a separate sharp limit. Put w_c=u_c−u_ref. Four references followed by four suffixes give a difference-of-increments statistic with noise radius 4ε. B on four yᵢ commands forces w_yᵢ≤ε. A on four zᵢ commands forces w_zᵢ≥−ε. B on two xᵢ and two zᵢ commands forces w_xᵢ+w_zᵢ≤2ε, hence w_xᵢ≤3ε. A on x0,y0,x1,y1 forces 1≤4ε+w_x0+w_y0+w_x1+w_y1≤12ε. The balanced midpoint reaches 1/12. This bound allows different physical mixtures for every completed word.

For a command histogram n and a fixed physical mixture, write d for physical-minus-displayed rates and subtract their histogram-weighted mean. In any permutation the residual range is at most the total positive increment mass C=½Σ n_c|d_c−meanₙ(d)|. Shifting by the midrange gives error at most C/2. Sorting increments attains C between zero endpoints and forces error at least C/2 under every affine fit. Thus the worst optimal affine error over permutations is exactly C/2.

## Exact causal coverage

The [nine-pulse proof](nine-pulse-causal-obstruction.md) derives the shared source midpoint, grouped-prefix bounds and affine-leaf triple test. Here the midpoint covers 250 of 256 category words at 1/14. The six exceptions have two blocks, with the first block of length 3,4 or 5 and either category first. They contain 179,712 literal words.

Start at zero. At the fourth command activate its matching ordered root if present. Otherwise activate the first matching grouped panel at tick five or later. Return balanced midpoint readings until activation. Every active state covers every future command, including continuations leaving an exceptional category.

* **3,968 grouped panels** give a measured offset for every proper descendant prefix and return the midpoint of two terminal predictions. The verifier checks all previous permutations via the smallest and largest partial increment sums, all subsequent shared readings against both persistent worlds, and the final overlap. Backward candidate/failure counts at lengths 8,7,6,5 were 3,948/8, 21/17, 29/20 and 24/9.
* **220 ordered roots with 3,230 analytic leaves** give a measured increment at the observed prefix, then fixed display rates at each leaf. The verifier tests every literal rate against each of the two opposite-signed intervals in every three-tick contrast. Exact interpolation and planar Helly yield one origin and drift per physical mixture through the full word.
* **Two ordered physical panels** start after ref³,x0 and ref³,x1. Each returns 2/7 immediately on observing its fourth command. Before committing this reply, the design separately projected each of the eight possible fifth-command subtrees onto the fourth reading. Their numerical intervals met at 2/7 for both roots. The exact certificate directly demonstrates feasibility: a single root mark at 2/7 serves all eight fifth commands, all their descendant measurements are indexed by actual observed prefixes, and all 4,096 complete words per root fit the resulting measurements. Only after the last command does the receiver select that word's terminal midpoint. Verification does not require the numerical interval endpoints or uniqueness.

The packet references 17,965 distinct physical world pairs across its tables. Any complete controller trajectory receives one history with a single physical mixture, origin and drift per law. A partial history keeps the same measurements under every extension, although its reported witness may change. A controller stopping early inherits both explanations from any completion.

```sh
python3 scripts/verify-eight-pulse-causal-obstruction.py examples/active-position-drift-eight-pulse-upper.json examples/eight-pulse-causal-obstruction.json
python3 scripts/verify-eight-pulse-causal-obstruction.py examples/active-position-drift-eight-pulse-upper.json examples/eight-pulse-causal-obstruction.json --commands ref ref ref x1 y1 z0 y0 x0
```

Without a command argument, the standard-library receiver verifies the full packet and counts all 16,777,216 words through its covered prefix states. With a shorter prefix it returns the retained readings and original physical witnesses. All numerical checks use exact arithmetic.
