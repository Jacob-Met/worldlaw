# Twelve pulses with freely chosen suffix order and dwell

At noise **1/10**, thirteen pulses are necessary and sufficient in the following one-feedback class on the grouped A/B catalog. Apply m ≥ 1 reference pulses and g ≥ 1 group pulses. After their actual readings, choose either named suffix triple, any of its six orders, and a separate positive number of repeats for each command. Commit that entire suffix before receiving its first reading. The final decision may use every measured pulse. The two branches may use different orders and different dwells.

At horizon 12 the class's exact first-failure radius is **1/10**. The equal-dwell schedule with (m,k)=(4,2) succeeds for every smaller noise. At equality, all 36 eligible reference/group count pairs admit a shared measured history which permits a collision for every suffix choice. With thirteen pulses the existing (5,2) schedule succeeds up to its own strict threshold 1/9. These statements leave further feedback during the suffix and interleaved command classes open. [Equal-dwell receiver](equal-dwell-calibration.md)

## Counterfactuals with one common past

For any positive m,g with m+g+3 ≤ 12, set all measured reference positions to zero, including tick zero. During the group block give the linear observations j·s/g on its j-th pulse. Use s=g/2−1/10 except at (m,g)=(5,1) and (8,1), where s=47/100 and 11/20. Every admissible next word at that prefix sees precisely the same past. In particular (4,2) has s=9/10, where the incumbent's two suffix collision intervals touch.

Each word selects three positive integers summing to 12−m−g. In the packet the triples are ordered (y0,x0,z0) then (z1,x1,y1). Each triple uses permutation order from its three listed entries, then increasing first and second dwell, with the third forced by the remaining budget. This gives 12·C(12−m−g−1,2) choices per prefix and 3,960 choices overall. A shorter selected word can be extended to length 12 by increasing its final dwell. Restricting the longer witness to its original prefix therefore also refutes the shorter word.

For each chosen word one row supplies a persistent start, a constant drift and one fixed convex mixture of the literal vertices **for each law**. Only the fourth mass is implicit, as one minus the first three. The file stores 2,693 distinct world pairs and references them by index. The standard-library verifier applies the corresponding exact rate and drift one tick at a time. The two clean paths lie within 1/10 of every shared observation. After the suffix is committed, its remaining measured positions are the midpoints of the two positions. Both laws meet the same physical observations through the end. These private suffix readings may differ across choices, including two choices that happen to have the same first command. A controller allowed to reconsider after observing that first suffix command is outside this certificate.

Thus no decision rule using these prefixes and one committed suffix can identify the law with a sure guarantee at the closed boundary. The retained [budget-13 source and policy](../examples/active-position-drift-dwell-calibration.json) supply the strict positive control. For horizon 12, replacing its budget by 12 gives the strict-below-boundary policy.

## Replay

```sh
python3 scripts/verify-unequal-suffix-dwell.py examples/active-position-drift-dwell-calibration.json examples/twelve-pulse-unequal-suffix-obstruction.json
```

The verifier uses exact rational arithmetic and checks 102,960 original world/tick positions (3,960 words × 2 worlds × 13 readings). It reconstructs the entire continuation list and checks the table against the supplied source catalog. The separate SciPy constructor can regenerate physical coordinates. Floating-point feasibility is used to find candidate witnesses; a successful exact replay establishes the result.

```sh
python3 scripts/design-unequal-suffix-dwell.py examples/active-position-drift-dwell-calibration.json /tmp/unequal.json
python3 scripts/verify-unequal-suffix-dwell.py examples/active-position-drift-dwell-calibration.json /tmp/unequal.json
```
