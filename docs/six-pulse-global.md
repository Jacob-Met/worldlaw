# Unrestricted six-pulse feedback for the grouped rate families

The unrestricted six-pulse first-failure radius is **1/20** for this eight-command grouped catalog. The strongest verified lower policy starts with **ref/ref**. The next distinct verified lower bound is 1/22 at group/ref. The known global five-pulse bound gives a minimum of **six pulses throughout [1/29, 1/20)**. At 1/20 and above every six-pulse policy has a physical collision, so at least seven pulses are required.

## Results by initial command pair

Rows give the first command and columns the second. Intervals remain open on 3 prefixes.

| First / second | ref | group | x0 | y0 | z0 | x1 | y1 | z1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ref | 1/20 | 2/59 | 1/29 | 1/30 | 1/31 | 1/29 | 1/30 | 1/31 |
| group | 1/22 | 1/29 | 3/83 | 1/28 | 3/86 | 1/31 | 1/30 | 7/206 |
| x0 | 1/24 | 2/57 | 1/33 | 1/26 | 1/32 | 1/24 | 1/26 | 3/92 |
| y0 | 1/27 | 1/28 | 1/26 | 3/109 | 1/32 | 1/26 | 5/147 | 1/34 |
| z0 | 1/28 | 1/28 | 1/32 | [5/163, 1/20] | 3/107 | 3/92 | 1/32 | 1/30 |
| x1 | 1/24 | 1/30 | 1/24 | 1/26 | 3/92 | 1/33 | 1/26 | 1/32 |
| y1 | 1/27 | 1/30 | 1/26 | [5/147, 1/20] | 1/34 | [1/38, 1/20] | 1/37 | 1/34 |
| z1 | 1/28 | 1/29 | 3/92 | 1/32 | 1/30 | 1/32 | 1/32 | 3/107 |

## How the global bound follows

The lower certificate supplies a policy for a particular first pair. Its positive weighted original inequalities cancel all state and reading coordinates and therefore prevent a common history below the reported lower radius. Only the terminal words carrying positive weights are needed by the executable receiver. The [two-word ref/ref policy](six-pulse-ref-ref.md) runs directly from three prefix commands and four measured positions.

For the global upper bound, take the largest upper radius among the 64 verified prefixes. Give any controller the initial observations 0, 0. These fix its first two commands. Use the physical certificate for that ordered pair. At every later tick the certificate assigns one observation per complete command history; the controller sees the same prefix in both worlds before choosing its next action. At a terminal word, the two fixed mixtures, positions and drifts remain feasible on the whole tape and share a final measurement. A collision at a smaller radius is also a collision at the global upper radius. This establishes the boundary for sure identification by adaptive policies on this catalog.

The independent fixed-mixture midpoint control gives 1/16 for every command word. It initialized all 63 new searches; the earlier ref/ref certificate is reused exactly as published. No new direct full-tree LP is used.

## Three bounded searches and their physical upper witnesses

Three numerical LP proposals failed exact rational primal reconstruction. The original runs stopped at that point, and their proofs remain in the shards. The source-only refinements below use fixed mixtures and retain every original bound. The other 61 first pairs have exact individual radii.

| Initial pair | Completed master rounds | Original search interval | Independently replayed interval |
| --- | ---: | --- | --- |
| z0 / y0 | 3 | [5/163, 1/16] | [5/163, 1/20] |
| y1 / y0 | 10 | [5/147, 1/16] | [5/147, 1/20] |
| y1 / x1 | 3 | [0, 1/16] | [1/38, 1/20] |

For z0/y0 the A and B mixtures are (1,3,2,4)/10 and (5,1,2,2)/10. For y1/y0 they are (1,4,1,4)/10 and (5,2,1,2)/10. For y1/x1 they are (2,4,1,3)/10 and (6,2,0,2)/10. In each case both initial command gaps equal 1/10 and every available command gap lies in [0,1/5]. The common readings follow the cumulative midpoint of these two fixed mixtures.

To check a radius, let D(t) be the cumulative rate gap and set E(t) = D(t) − tD(6)/6. For an interval of length k and either sign, the signed difference in E has coefficient ±(6−k)/6 on each gap inside and ∓k/6 outside. Substitute the two actual prefix gaps. Every remaining term is maximized by the upper or lower source gap according to its coefficient. Over all intervals and signs the largest possible difference is 1/5. Center the residual at the midpoint of its range and split the offset and slope equally between the two physical worlds. Each clean trajectory stays within 1/20 of its common midpoint readings. The initial readings can be normalized to zero with the same affine translation. The receiver rebuilds and checks the two physical worlds on every one of the 12,288 affected terminal words.

For y1/x1 the original lower certificate had only the zero-noise domain row. The [five-pulse archive](position-drift-five-pulse-global.md) already certifies 1/38 for this ordered pair. The receiver appends ref to each supported five-command word and maps its original positive row weights through tick five, adding room for the two sixth-tick rows after each family. Exact substitution into the six-pulse equations verifies the inherited inequality and recovers a three-word lower policy. No suffix LP was rerun. Whether any of the three bounded pairs ties ref/ref at 1/20 remains open.

## Work and reproducibility

The original course visited the 63 remaining ordered pairs in source order on one CPU. Each had a limit of 32 master rounds, 512 suffix blocks, and eight terminal words per physical LP. The new prefixes used 3–19 rounds. Each compressed proof was committed after replaying all original physical inequalities. A resumed run revalidates committed prefixes and skips fitting them.

| Course | Design solves | Design rows | Export solves | Export rows |
| --- | ---: | ---: | ---: | ---: |
| Existing ref/ref | 1,149 | 330,206 | 349 | 100,512 |
| New 63 prefixes | 127,466 | 36,740,167 | 28,152 | 8,107,776 |
| All 64 | 128,615 | 37,070,373 | 28,501 | 8,208,288 |

The new course measured 647.14 seconds in design, 141.39 seconds in physical export, and 41.65 seconds in checkpoint verification. The most design rows were required by x0/group (1,022,147). The largest export was ref/group (147,456 rows). The separate standard-library replay covered 32,768 blocks, 262,144 terminal pairs, and 524,288 persistent worlds in 43.01 seconds. The inherited y1/x1 lower proof was then independently checked on its 8,192 worlds. Detailed numerical work and the exact intervals are in [the course record](../examples/active-position-drift-six-pulse-global-work.json).

The portfolio stores one independently compressed physical JSONL certificate per new pair across eight source-ordered JSON files. The receiver validates coverage and reads the original ref/ref packet alongside them. It reconstructs every bound and the winning program from the original equations without SciPy.

```sh
python3 scripts/verify-six-pulse-global.py examples/active-position-drift-six-pulse-tree.json examples/active-position-drift-six-pulse-global.json --export-policy six-pulse-policy.json
python3 scripts/verify-six-pulse-global.py examples/active-position-drift-six-pulse-tree.json examples/active-position-drift-six-pulse-global.json --prefix group ref
python3 scripts/design-six-pulse-global.py examples/active-position-drift-six-pulse-tree.json new-prefix-checkpoints
```
