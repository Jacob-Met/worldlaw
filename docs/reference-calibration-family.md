# Sharp radius for any number of initial references

For integer **m ≥ 2**, apply ref m times, then group and one of the two three-command continuations from the [seven-pulse experiment](seven-pulse-calibration.md). The exact first-failure radius is **Rₘ = m/[10(m+2)]**. Every smaller noise permits sure identification. At equality, one common reference history and two physical counterfactuals defeat the branch decision. The radii increase strictly to **1/10**. Every noise below 1/10 is attainable with finitely many references; no finite member of this family separates at or above 1/10. The ceiling is specific to these programs.

## Measured rule

Record positions at ticks **0, m, m+1, m+2, m+3, m+4**. After group compute **S = Y₀−(m+1)Yₘ+mYₘ₊₁**. For ε below Rₘ choose **y0, x0, z0** if S < m/2 + (m−4)ε. At equal scores and above the cutoff choose **z1, x1, y1**. The receiver returns the next command, its exact repeat count, the next checkpoint and each surviving family's persistent mixture, origin and drift region.

At m=4 and ε=3/50 the radius is 1/15, the cutoff is 2 and the six checkpoints are 0, 4, 5, 6, 7, 8. Positions `["0","0","0","1","1","1"]` select y0 and identify A. Positions `["0","0","1","0","1","1"]` select z1 and identify B.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-reference-calibration.json --reference-calibration --output calibration.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-reference-calibration.json --reference-calibration --replay calibration.json --readings checkpoints.json
python3 scripts/verify-reference-calibration.py examples/active-position-drift-reference-calibration.json calibration.json --reference-tick 2
```

Change the source's `references` integer string to select m. The initial run is one command/count pair. At a fixed catalog the checkpoint count, number of physical constraints and number of reported boundary worlds are constant; the exact integers and rational calculations grow with the digit length of m. For ε < 1/10 the least allowed reference count in this family is max(2, floor(20ε/(1−10ε))+1). At or above 1/10 it is null. Minimum pulse counts for unrestricted policies require their own lower bounds.

## Separation for all m

Define **T = 4Y₀−(m+4)Yₘ+mYₘ₊₄**. Every source vertex has zero reference rate. Let g be a world's group rate. On the first suffix the group and three suffix rates sum to 1 for A. On the second suffix they sum to 2g for A. Both suffixes have zero net rate for B. The implementation checks the identities at every source vertex, so they hold for every constant mixture. S and T cancel both unknown origin and drift.

On the first word A satisfies |T−m| ≤ (2m+8)ε. On either word B satisfies |T−S| ≤ (2m+6)ε. A collision on the first word therefore requires **S ≥ m−(4m+14)ε**. On the second word A satisfies |T−2S| ≤ 4mε, because the coefficients of T−2S are 2, m−2, −2m and m. Together with B's inequality this requires **S ≤ (6m+6)ε**. The gap between the necessary conditions is m−(10m+20)ε. Their midpoint gives the causal cutoff.

The proof uses only ticks 0, m, m+1 and m+4. The receiver additionally checks the two intervening suffix readings for physical consistency. Omitting the m−1 intermediate reference readings cannot invalidate the guarantee. The retained positions already exclude one family, and extra measurements can only narrow the same feasible state region.

## Matching physical boundary at every original tick

Set D=10(m+2), q=1/D and e=mq. The weights below are numerators over D, in the example's vertex order. The implementation binds rate projections by value, so law, command and vertex orders may change. Additional vertices must satisfy the terminal identities.

| Word and family | Four mixture numerators | Initial position | Drift |
| --- | --- | ---: | ---: |
| First, A | 0, 2m+12, 0, 8m+8 | +e | −4q |
| First, B | 4m+12, 4, 0, 6m+4 | −e | 0 |
| Second, A | 6m+14, 0, 4m+2, 4 | +e | −2q |
| Second, B | 4m+16, 0, 6m+2, 2 | −e | 0 |

All four rows are nonnegative and sum to D for every m ≥ 2. Give both continuations the reference observations **Yₜ = −2qt** at every tick 0 through m. The error between each world's clean position and this line is affine. Its endpoint magnitudes are e, so the closed bound holds at every intermediate integer tick. After group the shared reading is **(4m+4)q**. The first A world and both B worlds have clean position (5m+4)q; the second A world has clean position (3m+4)q. All admit the same reading.

From group through the three suffix endpoints, the clean A-minus-B gaps are **q·(0,−4,2m,2m)** on the first continuation and **q·(−2m,−2m,−2m,2m)** on the second. Their magnitudes are at most 2e because m ≥ 2. On each suffix use the midpoint of the two clean positions. The same mixture, origin and drift then fit that word's entire history. At the group reading, S=(6m+6)e, where the two collision conditions meet. This proves exact failure at equality.

The standard-library verifier checks the source identities, four physical mixtures, all checkpoint tubes and the common affine reference line. Its optional tick argument independently evaluates any requested intermediate reference position.

The [equal-dwell extension](equal-dwell-calibration.md) allows a common dwell on the group and suffix commands and selects all optimal allocations for a fixed pulse budget.
