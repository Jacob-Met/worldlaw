# Calibration with any positive reference count

The `worldlaw.position-drift-dwell-calibration/v2` source accepts every positive integer reference count m and dwell k. The two words, five command runs, six measured checkpoints, source vertex checks and persistent-state receiver are those of the [equal-dwell experiment](equal-dwell-calibration.md). Its v1 source and saved proofs retain the m ≥ 2k domain.

| Reference count | Exact first collision | Choose the first suffix when S is strictly below |
| --- | --- | --- |
| m ≥ 2k | mk/[10(m+2k)] | mk/2+(m−4k)ε |
| m < 2k | mk/[8(m+3k)] | mk/2−2kε |

At budget 11 the old maximum was 7/90. The allocation (m,k)=(3,2) reaches **1/12**, so the example with noise 2/25 now identifies either law. Budget 5 admits its first allocation, (1,1), with radius 1/32. These are the only budgets at which a low-reference allocation maximizes the radius. At ε=1/10 the first successful budget is still 13 for this two-word equal-dwell class.

## Why the radius changes

Write S=kY₀−(m+k)Yₘ+mYₘ₊ₖ and T=4kY₀−(m+4k)Yₘ+mYᴴ, where H=m+4k. For simultaneous survival on the first suffix, the unchanged source identities require S ≥ mk−(4m+14k)ε. On the second suffix the original coefficients of T−2S are 2k, m−2k, −2m and m at the four corresponding checkpoints. Their absolute sum for m<2k is 4k+2m. Combining this bound for A with |T−S|≤(2m+6k)ε for B requires S ≤ (4m+10k)ε. Averaging the two thresholds gives the table's low-reference rule. The gap is mk−(8m+24k)ε. At a cutoff tie the receiver chooses the second suffix.

## Matching physical worlds on every tick

Set D=8m+24k, q=1/D and e=mkq. Both A worlds have initial position e and drift −4kq. Both B worlds have initial position −e and drift zero. The following rows give mixture weight numerators in the vertex orders of the [reference proof](reference-calibration-family.md). Divide by D. Each row has nonnegative entries summing to D.

| Suffix, family | Four numerators |
| --- | --- |
| First, A | 4k, 2m+8k, 0, 6m+12k |
| First, B | 4m+12k, 4k, 0, 4m+8k |
| Second, A | 4m+12k, 0, 4m+4k, 8k |
| Second, B | 4m+16k, 0, 4m+4k, 4k |

All four worlds admit the shared observations 0, −2e and k(2m+8k)q at ticks 0,m,m+k. At the group endpoint, the first A and both B runs lie e above the reading, and the second A lies e below. From group through the three suffix endpoints, the exact clean A-minus-B gaps are kq·(0,0,2m,2m) and kq·(−2m,−2m,−2m,2m). On each private suffix take the midpoints at the final three checkpoints. Interpolate observations affinely on each of the five constant-command runs, including the common group run. Every world's clean trajectory is affine on each run and its endpoint errors are in [−e,e]. This supplies the same past for both choices and an error-valid reading at every original tick, including those skipped by the operational receiver. Equality therefore gives a physical collision.

For fixed k, the radius increases strictly through the regime boundary at m=2k, where R=k/20, and approaches k/10. When ε<k/20 the least reference count is floor(24kε/(k−8ε))+1. At and above k/20 use the previous strict inverse floor(20kε/(k−10ε))+1 while ε<k/10. At or above k/10 there is no finite solution for that dwell.

## At most three candidate allocations

At fixed H, k ranges from 1 through floor((H−1)/4). For k≤H/6 the reference-rich branch has its real maximum at aH where a=(2−√2)/4. It suffices to check its two bracketing integers clipped to the feasible high-reference region, if that region exists. For k>H/6, substituting m=H−4k gives g(k)=k(H−4k)/[8(H−k)]. Its derivative has the sign of H²−8Hk+4k². This is negative at H/6 and strictly decreases up to H/4. Only the first feasible integer beyond H/6 can maximize that branch.

For H≥50 we can omit even that third candidate. The distance H/6−aH is H(3√2−4)/12, exceeding 1 at H=50 and increasing thereafter (18 > (106/25)² establishes the strict inequality by squaring). Both integers bracketing the high-reference peak are then feasible. On H/6<k<H/4 the continuation of the high-reference formula exceeds g(k), since 8(H−k)−10(H−2k)=12k−2H>0. That continuation already decreases past the peak, so every low-reference candidate lies strictly below a feasible high-reference value. Exact finite integer comparisons for H=5 through 49 leave only 5 and 11 as new maximizing budgets, with no additional ties. The JS selector retains every tie, and the Python verifier independently compares the best high-reference finite difference solution against the best low-reference candidate even above 50. This is an optimum within the two named equal-dwell words.

## Replay the budget-11 case

```sh
node scripts/active-linear-family.mjs --reference-calibration --input examples/active-position-drift-all-dwell-calibration.json --output /tmp/all-dwell-proof.json
python3 scripts/verify-reference-calibration.py examples/active-position-drift-all-dwell-calibration.json /tmp/all-dwell-proof.json --pulse-tick 4
```
