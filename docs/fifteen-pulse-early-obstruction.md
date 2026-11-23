# Fifteen pulses have exact adaptive radius 3/20

The fixed tape of nine references followed by each of the six suffix commands once identifies the family at every noise ε<3/20. At equality the following causal receiver returns one history compatible with both original physical families for every fifteen-command controller. Combining the [fourteen-pulse radius](even-near-balanced-adaptive-optimum.md) and this result, the minimum is fifteen throughout [1/7,3/20). At exactly 3/20 it is sixteen: the sixteen-command fixed course has radius 5/32.

The earlier [nominal-prefix counterexamples](odd-near-balanced-adaptive-optimum.md) remain valid. In fact, on ref⁷ x0 x0 y0 z0 z0 x1 y1 z1, keeping the nominal readings through tick eight already forces ε≥35/232, even if every later reading is free. On the reverse two-block word it forces ε≥14/93. These are limits of that display rule. The new receiver changes a reading at tick seven or eight precisely when the received history activates one of the rules below.

## When the nominal display changes

Use command order ref, group, x0, y0, z0, x1, y1, z1 and the original A=(1,2,1,2)/6, B=(2,1,2,1)/6 masses. Denote their mean command rate by μ. All readings start at zero. The rules have the following priority.

1. At tick seven, if the first command was x_g and the first seven commands consist of one of each suffix plus an extra z_g, add the group's stored shared adjustment to the nominal cumulative reading. In particular the first x_g is one of those seven. Only after the eighth command arrives choose its corresponding child, add the child's adjustment to that nominal increment, and then use its eight future command rates through tick fifteen.
2. After seven references, if the eighth command is x0, decrease that increment by 1/140 and decrease every subsequent x0 increment by 1/140 through tick fourteen. If it is x1, decrease its eighth increment by 1/105 and each subsequent x1 increment by 1/210. At tick fifteen choose a physical terminal midpoint. The x0 rule applied unchanged to x1 misses three tail histograms.
3. If the first eight commands are all suffixes, with counts (2,1,2) in group g and (1,1,1) in the other group, the eighth reading may change. A last command different from x_g selects a leaf by its last command. A last x_g after a different first command selects by its first command. First and last both x_g are already covered by the seventh-reading rule. Add that leaf's stored adjustment to the eighth nominal increment and use its future rate table afterwards.
4. Else display the cumulative nominal mean up to the terminal tick. The construction below determines when a terminal midpoint is needed.

An adjustment is made only after observing the selecting command. The source mixtures and affine initial states that explain a completed tape may depend on that tape. For a partial tape, the receiver pads with references privately and returns the existing readings and a physical witness for that prefix; future actions cannot change those readings.

## Why the conditional leaves cover all continuations

For each reference-first root, the seventh/eighth positions and all remaining counts fix the terminal physical gap. The packet stores a rational physical pair for each of the 3,432 multisets of seven tail commands. For a block with a fixed multiset, the least and greatest deviation after j commands are the sums of the j smallest and j largest rate residuals. The verifier checks these extremes through every proper time, then checks the final gap ≤2ε. It does so independently for both physical laws and both reference-first roots. No suffix is sampled.

For the suffix-first rules, each leaf fixes one barycentric distribution per law and a virtual rate table. For a particular complete tape, the law's accumulated rate residual relative to the actual displayed readings can be fitted by one affine origin/drift precisely when every three-tick contrast has magnitude ≤2ε(k−i), for i<j<k. This is the [three-strip criterion](nine-pulse-causal-obstruction.md). In a contrast, each increment has coefficient k−j on the first interval, −(j−i) on the second, and zero outside. For each sign, the maximum over orders within a past multiset pairs the sorted coefficients with the sorted physical rate residuals. Each future coefficient independently uses the largest or smallest residual among the eight allowed commands. The verifier checks both signs of all 560 triples with exact integers. The seventh and eighth adjustments have their own time coefficients. This preserves their shared ancestry even when different continuations need different affine states.

There are eight children of the shared seventh mark in each group and ten eighth-mark leaves per group. These 36 analytic leaves cover arbitrary remaining commands. The seventh rule's 360 possible past orderings per group include prefixes that no longer form the hard histogram after the next action. Their selected child still covers that continuation.

## All other tapes

The balanced rate difference is 1/6 on the six suffixes S and zero on the baseline commands B. Every proper interval of the 15-pulse tape fits the nominal display: its worst bound is 7/48<3/20. For a full interval the integer count threshold is 24·15·(3/20)=54. The middle split must have lengths seven and eight to exceed it, and a mixed category costs at least seven units from the maximal product 56. Thus the only possible terminal exceptions are BᵇSˢ and SˢBᵇ with {b,s}={7,8}.

As in the [unequal-block transfer](odd-near-balanced-adaptive-optimum.md), a positive total correction C=1/(3b) must be removed from one or both signed high-rate totals. For b=8, one nonzero within-group x/y or x/z difference suffices. For b=7, let D be the sum of the absolute four within-group differences. If D≥2, use one difference of magnitude at least two or split C equally between two distinct unit directions. Moves in different groups or different laws do not add on a single rate of a single law, so the size of each signed rate change is at most C/2=1/42. Each changed law's total correction is at least C/2. This keeps the monotonic and proper-prefix bounds: the baseline-first high increment before perturbation is 17/420>1/42 and the suffix-first increment is 3/80>1/42. Both signed origins/drifts use the actual total assigned to each law. The file replays every one of the 4,134 distributed histogram/order combinations through the original source and checks that either baseline command has the same residual.

For b=7,s=8,D=1, exactly one count is one smaller than its two partners. The counts are (u,u,u) in its group except for one y or z count of u−1, and (3−u,3−u,3−u) in the other group, with u=1,2,3. Two groups, two exceptional coordinates, three choices of u, eight baseline histograms, and two orders give 192 cells. Direct physical tables cover 188. The remaining four have seven references and u=2 with the y exception. Their reference-first cases either use the eighth reference-first rule or have an explicitly checked first/last suffix panel (42 cells). Their suffix-first cases use the earlier conditional leaves. All terminal midpoints are chosen after the final command.

## Replay

```sh
python3 scripts/verify-fifteen-pulse-early-obstruction.py examples/active-position-drift-fifteen-pulse-upper.json examples/fifteen-pulse-early-obstruction.json
python3 scripts/verify-fifteen-pulse-early-obstruction.py examples/active-position-drift-fifteen-pulse-upper.json examples/fifteen-pulse-early-obstruction.json --commands ref ref ref ref ref ref ref x1
```

The reference windows were constructed by fixing the shared increments, fitting one private pair per tail histogram, and converting each feasible point to a checked rational tuple. The analytic search separated violated three-tick constraints, then stored rational masses summing to one and exact virtual increments. The compressed reference tables have an explicit index for every histogram; verification does not run an optimizer.

The first command verifies the certificate from the original rate vertices using only the Python standard library. The second returns the measured prefix and two source-indexed physical witnesses. Equality is a collision. The proof covers 8¹⁵=35,184,372,088,832 literal words through histogram and analytic bounds.
