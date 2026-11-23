# Reuse in the factored feedback solver

Source-checked primal and cut reuse reduced cumulative design rows on **all 64 five-pulse prefixes**. The total dropped **5,514,560 → 2,569,191** (53.4%). The previous worst prefix, z1/y0, fell **125,194 → 50,644**. The new worst is x0/group at **65,077**, or **3.97×** the direct solver’s 16,384 rows per prefix. The previous worst was 7.64×. All thresholds matched the [original complete physical certificate](position-drift-five-pulse-global.md); no individual LP exceeded the original factored limit of eight terminal words, 256 inequalities and 90 coordinates.

| Frozen five-pulse course | Previous factored solver | Reuse |
| --- | ---: | ---: |
| Design LP calls | 21,864 | 10,472 |
| Design pivots | 2,528,658 | 1,267,028 |
| Design LP rows processed | 5,514,560 | 2,569,191 |
| Design wall time | 83.12 s | 43.59 s |
| Export LP rows, separately | 1,048,576 | 875,776 |
| Export and independent replay wall time | 22.50 s | 19.99 s |
| Combined LP rows | 6,563,136 | 3,444,967 |

The smallest design-row improvement was x0/x1: **67,777 → 53,446**. Export remained at the full 16,384 rows on the old worst z1/y0; ref/ref export fell to 6,656. Export time increased on 32 prefixes, with the largest ratio at x1/y1 (0.3521 → 0.3800 s). Timings include exact arithmetic and are single-run paired measurements on one worker. The direct method still uses fewer total design rows than reuse on 61 of the 64 prefixes. The supplied six-pulse exhibit retained its exact 3/76 threshold and two-leaf LP limit; design rows fell 1,841 → 1,315 while export remained 144. No larger unrestricted search was enrolled.

## Which facts can be reused

Each suffix block retains up to six snapshots containing its shared-reading tuple, certified optimum, source dual, and compact extrema of its checked physical states. Let c_min(t) and c_max(t) be the extrema of the old clean positions at each pinned ancestral tick, including the normalized zeros at ticks zero and one. Also retain the largest residual on the remaining private readings. Full private coordinate vectors and LP matrices are discarded after each block.

At new ancestral observations y(t) and proposed radius r, shift every old origin by a and every drift by b. Shift every private reading by a+bt. All private residuals remain exactly unchanged. Every changed original tube is respected precisely when

    y(t) − c_min(t) − r ≤ a + bt ≤ y(t) − c_max(t) + r

holds at each pinned tick and the largest private residual is at most r. Eliminate a by intersecting the closed pairwise slope bounds. When they intersect, take a feasible slope and the greatest lower bound on the intercept; explicitly substitute both into every ancestral strip. The extrema cover every original law and leaf state. A failed test sends the block to another snapshot or an actual solve. A feasible snapshot only certifies a block upper bound at the requested radius.

Some blocks have a cheaper source witness: on each terminal word, both families have a vertex whose rates are constant along that entire word. Give each leaf its own corresponding vertices and subtract the first rate from its initial drift. All clean positions are then zero; the same affine test applies at changed measurements. At export, these 675 block witnesses over the full course regenerate their original mixtures, origins, drifts and shared private readings directly. The independent receiver rechecks every exported physical trajectory. Other blocks retain the usual separately counted export solve.

Cuts from each snapshot remain valid at any master point. Check them at the proposed ancestor vector and visit the sibling with the largest recorded lower bound first. After the first full pass, one violated cut can defer its remaining siblings for that iteration. Such a partial pass contributes only lower cuts. The best upper point changes only when all blocks are covered by actual solves, previously solved keys or certified primal witnesses. The 64 courses recorded 1,525 exact-key hits, 2,574 reused primal-band certificates, 5,570 flat-source certificates, 42 reused violated cuts and 11,017 deferred sibling visits. The 16,495 attempts at old primal bands are included in wall time and are outside the LP-row statistic.

## Receipts and reproduction

The [per-prefix paired receipt](../examples/factored-feedback-reuse-benchmark.json) includes design and export counters, radii, receiver outcomes and times. Each arm exported and independently checked all 65,536 five-pulse physical worlds. A one-round or otherwise unfinished run retains its verified lower and upper bounds. The original CLI, standard-library reader and portable packet format are unchanged.

```sh
git show 784621a5432be67993ca8a12d89dc7d66e9be3ae:scripts/design-factored-feedback.py > /tmp/worldlaw-factored-reference.py
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 scripts/benchmark-factored-feedback-reuse.py \
  --reference /tmp/worldlaw-factored-reference.py > comparison.jsonl
```

The comparison used SciPy 1.15.3 and NumPy 2.2.6, alternating execution order within each sequential run. At x1/y1 the initial run rejected a proposed floating solution during exact substitution. The first 46 completed receipts were retained. For the rejected block, the receiver’s master point imposed a common denominator on the RHS. Removing that denominator before rational reconstruction recovered an exact feasible point and exact dual, without changing the LP or its tolerance. The remaining inputs then completed. If both reconstructions fail, the solver still returns no certificate.

The cumulative design-row counts below use the first command as the row and the second as the column. The [previous course](factored-feedback.md) contains the matching baseline table.

| First / second | ref | group | x0 | y0 | z0 | x1 | y1 | z1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ref | 17,532 | 44,897 | 52,679 | 54,964 | 35,905 | 54,822 | 28,676 | 23,596 |
| group | 51,993 | 43,489 | 62,782 | 64,544 | 54,238 | 51,100 | 45,784 | 59,638 |
| x0 | 61,191 | 65,077 | 16,961 | 58,082 | 36,989 | 53,446 | 48,839 | 38,016 |
| y0 | 24,931 | 61,526 | 47,749 | 18,757 | 36,821 | 48,563 | 30,545 | 31,871 |
| z0 | 27,999 | 63,113 | 48,553 | 51,717 | 7,198 | 29,890 | 31,400 | 29,519 |
| x1 | 47,037 | 52,699 | 47,051 | 50,664 | 26,187 | 2,561 | 40,667 | 34,405 |
| y1 | 24,193 | 44,673 | 41,364 | 34,969 | 26,753 | 44,717 | 2,561 | 26,429 |
| z1 | 27,000 | 64,614 | 35,781 | 50,644 | 25,408 | 46,053 | 38,883 | 18,486 |
