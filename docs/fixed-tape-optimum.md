# Optimal fixed tapes for the grouped rate catalog

**Eleven pulses are necessary and sufficient for any fixed tape at noise ε=1/10.** Five reference pulses followed by each of y0,x0,z0,y1,x1,z1 once reach a strict identification radius of 5/44. Ten pulses attain only 1/10, where two physical families can still share a reading history. Feedback can change the tape and remains outside this optimality claim.

For H≤6 every fixed tape has zero radius. For H≥7 the global radius is

    R(H) = max k(H−6k)/(4H),  1 ≤ k ≤ floor((H−1)/6).

The maximizing integers are the feasible integers nearest H/12. The planner reports all maximizing dwell counts and operates the smaller count at a tie. For example H=18 has k=1 and k=2, both attaining 1/6. This lists optimal counts for the exhibited construction; arbitrary other tapes can attain the same optimum. H=7 and H=8 give 1/28 and 1/16. The [seven-pulse adaptive program](seven-pulse-calibration.md) already works at ε=1/20, where fixed tapes require eight pulses.

## A bound on every fixed tape and every terminal decision rule

For a fixed tape, the possible full observation vectors under each law form the Minkowski sum of a compact convex trajectory polytope, the compact measurement-error cube, and the common two-dimensional position/drift space spanned by the constant and time vectors. Quotient by that common space. The two remaining compact convex sets either meet (a physical collision) or a linear functional **strictly** separates them. This proves the bound for nonlinear decision rules too. The original nuisance space may have lower dimension for tiny H; the same quotient argument applies.

Lift a separating vector w back to all H+1 observations. Then ∑w=0 and ∑t·wₜ=0. Set cᵢ=∑ₜ₌ᵢᴴ wₜ for pulses i=1…H, with c₀=cᴴ⁺¹=0 at the two endpoints. The noiseless score on a rate vector r is ∑ᵢ cᵢ r(commandᵢ). Let Wₐ be the sum of cᵢ over command a. Drift cancellation gives ∑ₐWₐ=0; the total variation of the closed c path is ‖w‖₁.

Orient w so that A is above B. If d is the least clean A-minus-B score gap, strict separation with noise ε requires d>2ε‖w‖₁. In the literal source there is one A/B vertex pair for each of the six suffix commands whose rate difference is precisely that command's unit vector. The certificate binds all six pairs to source vertex indices and checks every one of the eight coordinates. Therefore Wₐ≥d for each suffix command. A missing suffix gives an exact alias via its vertex pair. If every action is a suffix, the two mixtures given below have constant difference 1/6 on the whole tape, removable by a relative drift. These two cases cover H≤6 and zero-noise equality.

Otherwise let k be the least count of the six suffix commands and m the number of other pulses (ref or group). Some cᵢ is at least d/k by averaging over the least-used suffix. Some cⱼ is at most −6d/m by averaging the combined ref/group weight. A closed scalar path visits both extremes and returns to its start, giving

    ‖w‖₁ ≥ 2d(1/k+6/m),   so   ε < mk/[4(m+6k)].

Because m≤H−6k and that radius increases with m, this bounds all tapes by R(H). At equality, strict separation is impossible, and compactness in the quotient gives an intersection. Extra source vertices preserve the result if the registered anchor pairs remain and every vertex satisfies the checked rate identities. The bound requires exactly the eight allowed command names.

## A matching tape and three-reading physical receiver

Take m=H−6k refs, then each suffix command k times. The sum of the six rates is one for every A mixture and zero for every B mixture; the reference rate vanishes. Read only Y₀,Yₘ,Yᴴ. The score

    T = mYᴴ − HYₘ + 6kY₀

has clean center mk for A or zero for B. Its full closed error interval has half-width 2Hε. Every point of either interval is attainable: the entire residual score can be allocated among three errors of magnitude ≤ε, after which the first two corrected measurements fix the origin and drift. Any fixed vertex of that family has the required final accumulated rate. The receiver retains each family whose closed interval contains the measured score, so it also reports empty or overlapping results on inconsistent or boundary inputs. Before the final reading both laws can fit any initial measurements by choosing a start and drift.

For a physical collision at the exhibited radius e=mk/(4H), use A masses (1,2,1,2)/6 and B masses (2,1,2,1)/6 in the registered anchor order. The clean rate differences are zero on ref and group and 1/6 on each suffix command. Give A start +e and drift −k/H, B start −e and drift zero. Their clean position difference goes from +2e to −2e across the reference block and back to +2e across the suffix pulses, affine on both stretches. Midpoints fit both trajectories at every integer tick, regardless of suffix ordering. For H≤6 the representative reads only references and its two worlds coincide throughout. Counts are stored as decimal strings; there are at most seven runs and three checkpoints at any budget. Arithmetic cost grows with the bit length of H.

## Replay the eleven-pulse example

```sh
node scripts/active-linear-family.mjs --fixed-tape-optimum --input examples/active-position-drift-fixed-tape-optimum.json --output /tmp/fixed-plan.json
printf '["0","0","1"]\n' >/tmp/fixed-positions.json
node scripts/active-linear-family.mjs --fixed-tape-optimum --input examples/active-position-drift-fixed-tape-optimum.json --replay /tmp/fixed-plan.json --readings /tmp/fixed-positions.json
```
