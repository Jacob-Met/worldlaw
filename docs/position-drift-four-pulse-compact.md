# Four leaves suffice for a four-pulse binary experiment

For a fixed first two commands, any nonempty finite menu of third and fourth commands can be reduced to at most **four complete command paths** with exactly the same first-failure noise radius. This holds for two finite-vertex convex rate families, one persistent mixture and initial position/drift per physical world, and one bounded scalar error per position reading. A four-pulse experiment with the best prospective prefix therefore has an equally robust four-leaf realization. The theorem does not identify the best prefix for a catalog.

The eight-command grouped source requires all four leaves even with exact position readings. Its unrestricted 64 continuations after (ref,group) compress to (x0,y0), (x0,z0), (x1,y1), and (x1,z1). Both menus have radius 1/40. The first member of each pair is the third command; its last command is chosen only after the next actual position is read. The minimum-leaf result holds over every first prefix. A later [complete-prefix certificate](position-drift-five-pulse-minimum.md) proves that (ref,group) also uniquely maximizes the four-pulse noise radius.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-full-group-menu.json --four-pulse-compact --output compact.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-full-group-menu.json --four-pulse-compact --replay compact.json --readings positions.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-two-feedback-groups.json --four-pulse-leaves --output leaves.json
python3 scripts/verify-four-pulse-leaf-minimum.py examples/active-position-drift-two-feedback-groups.json leaves.json
```

A compact certificate stores the original boundary and the retained leaf indices in source traversal order. The receiver lifts/restricts the support and boundary to verify both menus, then uses the reduced menu on actual measurements. The zero-radius case admits any single original path. Equality is a physical failure for both menus.

## Eliminating observations in their causal order

Each source support row has the form n₁s+n₂wᵦ+n₃vᵦ꜀ ≤ h+rε. The root s is common to all leaves. The intermediate observation wᵦ is common only to children of the same third command b. Each final reading vᵦ꜀ is private to one path. All three coefficients use the same original physical noise vector. Start with the original positive optimum certificate and retain its participating source inequalities. Their nonnegative combination cancels every observation and proves ε≥R. Conversely, the full physical histories at R still satisfy this subset. Hence its first feasible bound is exactly R.

Eliminate each vᵦ꜀ within its own leaf. Keep rows with zero terminal coefficient. Pair each negative coefficient with each positive one after division by its absolute value. These are exactly the lower≤upper conditions for existence of that scalar. If one sign is absent there is no opposing bound, so the zero-coefficient rows give the complete projection. Each resulting row uses at most two original inequalities **from one leaf**.

Next eliminate wᵦ separately within each set of siblings. Each projected row now uses at most two leaves and four source inequalities. Finally eliminate the single root s across all branches. Every resulting scalar inequality uses at most four leaves and eight source inequalities. Nonnegativity of the noise supports is preserved. There are finitely many scalar inequalities 0≤H+Tε. The projected system is feasible at R and infeasible at every smaller nonnegative ε; since R>0 at least one row has T>0 and H+TR=0. That one row suffices.

Keep only the leaves in that row, with their ancestral identities. The supports still cancel in every retained coordinate and therefore still require ε≥R for a common history. The full boundary history restricts to those leaves, giving failure at R. Lifting the same support back into the original tree verifies the opposite inclusion against the original physical boundary. This recovers the exact common threshold without solving a second minimization. It guarantees at most four leaves; it does not claim every output uses the fewest possible leaves for its source.

## Why a smaller universal bound fails

At a fixed cut after two pulses, all possible suffix pairs share s and can have private intermediate readings. At a fixed cut after three, all last commands share both s and w. The grouped catalog has a clean physical refutation of every one of the 64 early and 512 late prefixes. A tree using at most three leaves is covered by those cases if all third commands have only one child, or if all leaves use one third command. The only remaining shape has two possible third commands: b has two distinct children c,f, and d has one child e. The adversary must provide one s across all three leaves and the same w after b for c and f.

For eight commands there are 8² × 8 × C(8,2) × 7 × 8 = **802,816** such asymmetric menus. Select p,a in order, select b, choose the unordered distinct pair c,f, then select d≠b and e. Repeated command names at different times are permitted. For each leaf, the source grid supplies attainable exact common triples (s,w,v) with two physical witnesses. Intersect the (s,w) sets of the two siblings first; project their common pairs onto s only afterward. Intersect that set with the roots present in the third leaf. A common member gives actual trajectories for every branch. Missing the grid is inconclusive until an exact shared-tree check returns a boundary history or positive separating certificate.

The denominator-four grid covers 802,812 asymmetric menus. The remaining four have exact zero-radius physical histories, checked against the original rate vertices. The independent Python receiver rebuilds the same result using rational mixture enumeration, integer position trajectories and ordinary set intersections. It checks the exceptional physical worlds and the strictly positive upper menu’s weighted source supports with its own arithmetic. The certificate including original single-cut evidence is about 152 KB. It does not store hundreds of thousands of duplicate trajectories.

| Source | Minimum leaves in its guaranteed positive-noise range | Verified range | How the lower bound was obtained |
| --- | ---: | --- | --- |
| Eight-command grouped families | 4 | 0 ≤ ε < 1/40 | Both fixed cuts and every asymmetric three-leaf menu collide with zero noise. |
| Changed seven-command grouped families | 3 | 0 ≤ ε < 1/40 | Both fixed cuts collide with zero noise; an asymmetric three-leaf menu has positive radius 1/40. |

In the second catalog the second group has shared local x, with its y rate equal to x in A and x+W/2 in B. Two early-cut cases missed the finite grid; exact physical states close both. The asymmetric search stops at its first certified winning tree. It does not label the unvisited menus or claim the maximum radius over that class. If a positive fixed-cut course is found, the tool returns it directly. If the supplied menu has zero radius or a computational limit is reached, it makes no minimum-leaf claim.

The lower bounds hold for multiple decision rules as well as literal fixed words: unrestricted initial position and drift allow the physical adversary to keep y₀=y₁=0, fixing the prospective prefix on that history. The subsequent common observations enforce exactly the command-tree sharing above. The results concern sure identification on this four-pulse binary model.

The default designer projects larger menus without first constructing a full-tree simplex tableau. [Projected support algorithm and measured work](position-drift-four-pulse-projection.md)
