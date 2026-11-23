# Fixed and adaptive designs have the same radius at every horizon from 67

For the registered eight-command two-family source, put k equal to the nearest integer to H/12, choosing either minimizer at a tie. For **every integer H≥67**, the first noise level where every adaptive controller admits a physical collision is

    e = k(H−6k)/(4H).

The [fixed tape](fixed-tape-optimum.md) separates strictly below e. In particular, H=78 has e=21/26 and the two nearest choices k=6 and k=7 attain that same radius. The cutoff 67 is sufficient. Exact results for a number of shorter horizons were established separately. H=66 fails inequalities used below and this theorem gives no verdict there.

## Pure critical blocks

Write K=6k(H−6k), let B denote a reference or group command and S one of the six suffix commands. Start from the balanced source masses A=(1,2,1,2)/6 and B=(2,1,2,1)/6. Up to the penultimate tick, report the cumulative mean μ of these two rate sequences. Their difference is 1/6 on S and zero on B. A triple of times with span L forces noise at most floor(L²/4)/(24L). For every proper span L≤H−1 this is ≤(H−1)/96≤e: the squared distance of 6k from H/2 is at most 9, and H≥36. The run-endpoint drift/intercept intersection in the [retained receiver](even-near-balanced-adaptive-optimum.md) therefore suffices until the terminal command.

For a full-span triple, write b,s for the two segment lengths. If bs≤K the nominal mean fits. Otherwise let d=bs−K. Then 1≤d≤9 and |b−s|<6. A single mismatch from two opposite pure categories loses at least min(b,s)>9 in the integer count contrast. Only BᵇSˢ and SˢBᵇ can require a different terminal reading. The suffix length s cannot be divisible by six: its fixed product would exceed the optimal K.

## A source transfer for every literal histogram

The following construction works in the signed coordinates h_l=σ_l(clean_l−μ), σ_A=1 and σ_B=−1. Before adding physical origin/drift, the balanced signed rate is zero on the low block B and 1/12 on the high block S. We need a single modified law with high-block signed perturbation total −C, where C=d/(6b). Every individual modified high rate must have magnitude ≤C, and all observed low rates must be unchanged.

* If a group has unequal x/y counts, transfer −C/(N_x−N_y) from its y to x mass in A. If x/z differ, transfer +C/(N_x−N_z) from its neutral to x−z mass in B. These are the original within-group moves.
* Otherwise each group's three counts are equal. The counts for the two groups differ, since 6 does not divide s. When the low block contains only references, transfer −C/(N_y1−N_y0) from A's y0 mass to its y1 mass. This leaves the observed references unchanged.
* If a group command does occur in that low block, exchange the roles of the two blocks and work with h′=−h. Write b′=s, s′=b. Move d/(6b′G) mass from B's group-one neutral vertex to its group-zero neutral vertex, where G≥1 counts the observed group commands. This physically reduces B's group rate and leaves every suffix rate unchanged. In the swapped signed coordinates the cumulative high-block correction is exactly −d/(6b′). An affine gauge absorbs the constant: if h′ is constructed with signed origin p′ and drift v′, recover original signed origin −p′ and drift −v′−1/12. Thus a high increment in the swapped representation corresponds to an original baseline, and its low increment to an original suffix.

All movements preserve unit total mass. Their magnitudes are ≤9/(6min(b,s))<1/6. The construction uses the literal source vertices and remains valid if laws, vertices or commands are reordered.

## One terminal lemma for both coordinate systems

Use b,s for the resulting low and high lengths. Set α=1/12−2e/b, β=1/12−2e/s. The required five inequalities are

    α ≥ C,    (s−1)α ≤ 2e,    2e ≥ (s−1)C,
    β ≥ C/s,  (b−1)β ≤ 2e.

For low-first use signed origin +e, drift −2e/b. When the high block starts both signed worlds are at −e. Its increments are nonnegative. With r≥1 high actions omitted, the altered signed contribution is ≤(r−1)C, because its total is −C and each omitted step is at least −C. The rise is at most (s−1)α≤2e. The unmodified world satisfies the same bound. For high-first use signed origin −e and drift −β−Δ_l/s with Δ_l=−C or 0. All high increments are nonnegative and sum to 2e. The subsequent low drift belongs to [−β,0], keeping every proper low prefix in the tube.

Since s/6−C=4eH/b, at the terminal tick h_A+h_B equals +2e for low-first or −2e for high-first. The swapped coordinates may reverse the sign. Return the midpoint after receiving the last command. The source receiver checks both persistent physical worlds against every run endpoint, also checking the last nominal tick of any repeated terminal command. No earlier reading depends on the histogram of the full word.

## Why 67 suffices

Let m=min(b,s). Algebra gives α=(b²+d)/(12bH), β=(s²+d)/(12sH). The two proper-length inequalities are exactly b²≥d(H−1), s²≥d(H−1). The other three reduce to b²+d≥2dH, b(bs−d)≥2dH(s−1), b(s²+d)≥2dH. All five follow from m²≥2dH. For H≥82, m≥(H−5)/2 and (H−5)²≥72H, giving m²≥18H≥2dH. For 67≤H≤81 the receiver checks the five original rational inequalities directly for every b with b(H−b)>K and for its exchanged length. The maintained test independently enumerates all 1…H−1 splits for that finite interval. At H=66, b=s=33, d=9 gives α=1/12−2e/33<C: this lower cutoff is not a proof of an adaptive gain there.

```sh
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-all-large-horizons.json
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-all-large-horizons.json --runs runs.json
```

The receiver keeps the integer input run-length encoded throughout. At most six candidate length splits are checked at startup. For R input runs the exceptional terminal path takes O(R) rational operations and the ordinary feasibility path O(R²); integer bit lengths depend on the supplied horizon.
