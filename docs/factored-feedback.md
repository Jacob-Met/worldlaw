# Exact feedback design with one suffix block in memory

The factored solver recovered all 64 known five-pulse thresholds while loading at most eight terminal words in any individual LP. The original direct programs loaded 512 words apiece. The independent streaming receiver exports the four words carrying the lower proof for the best initial pair, ref/ref. The existing physical-feedback CLI then runs that menu from actual readings. The six-pulse exhibit gives 3/76 again. The largest improvement is in the size of each linear program; total solver work increased.

## Use the design and independent receiver

The designer requires Python, NumPy and SciPy. The receiver uses only the standard library.

```sh
python3 scripts/design-factored-feedback.py examples/active-position-drift-five-pulse-minimum.json \
  --complete --prefix '["ref","ref"]' --horizon 5 --output result.jsonl
python3 scripts/verify-factored-feedback.py examples/active-position-drift-five-pulse-minimum.json \
  examples/factored-feedback-ref-ref.jsonl --complete --prefix '["ref","ref"]' --horizon 5 \
  --export-policy policy.json
node scripts/active-linear-family.mjs --input policy.json --physical-feedback-tree --output policy-proof.json
node scripts/active-linear-family.mjs --input policy.json --physical-feedback-tree --replay policy-proof.json --readings positions.json
python3 scripts/verify-factored-feedback.py examples/active-position-drift-six-pulse-tree.json examples/factored-feedback-six.jsonl
```

With `--complete`, all continuations of the given prefix are admissible. Without it, use the finite program and horizon in the source. The split depth determines which ancestral readings remain in the master. The defaults limit the course to 32 rounds, 128 blocks and 16 terminal words per block. Oversized implicit menus are rejected before constructing their blocks. When the round cap is reached, both endpoints of the remaining interval have physical/source-row proofs. On ref/ref, a single round returns [0,1/14], covering the final 1/29. A numerical solution that fails exact rational reconstruction produces no certificate.

## Why splitting the physical problem is exact

Normalize the initial two positions to zero using the common affine freedom in origin and drift. Place all readings on histories shorter than the split in a master vector y. For each command prefix at the split, form one block containing its allowed suffixes. All descendants use the same y on their ancestors. Inside a block, readings remain shared up through their complete common action history; each leaf and each law has one private fixed mixture, origin and drift. Blocks communicate only through the master readings and the noise bound ε.

At fixed y, solve for the smallest feasible ε in each block. A positive dual cancels the block-private coordinates, giving an affine lower bound on ε for **all** y. Add violated bounds to the master, retaining their original source multipliers. The master always supplies a lower bound. At a common master point the maximum block optimum supplies a physical upper bound because all blocks agree on every ancestral reading. Keep the smallest such upper bound seen. Equal bounds certify the threshold; every intermediate round still supplies a valid interval. The implementation retains separating rows and one small evaluation record per block and drops each block matrix and private coordinate vector before solving the next block.

To export the physical proof, regenerate one block at a time at the best upper point. Each terminal reading can be the midpoint of its two clean positions. The receiver checks both persistent states through the entire tape, including their final overlap. To export the lower proof, multiply each active master weight by its original local row weights. The receiver checks the expanded combination directly: private coefficients cancel within each block, ancestral coefficients cancel globally, and the remainder is −ε ≤ −R. The source rows with positive weights identify an executable restricted tree. Its threshold is at least R; at equality the inherited upper worlds prove that it matches the whole submitted menu.

A first attempt used a common pair of physical states to cover every continuation from a frontier node. After one refinement its upper bound remained 1/12 on the best five-pulse prefix. The final decomposition gives the counterfactual continuations their own persistent worlds and preserves shared readings explicitly.

## Frozen comparison and work regressions

One CPU processed the 64 five-pulse prefixes in source order with split depth four and the limits above. The reference values came from the [archived complete course](position-drift-five-pulse-global.md). Each prefix matched exactly in one to nine rounds. The designated six-pulse program used split depth five. No unrestricted six-pulse search was performed.

| Course | Direct LP | Largest factored LP | Cumulative design rows | Final export rows |
| --- | --- | --- | ---: | ---: |
| One five-pulse prefix | 16,384 rows, 5,706 coordinates, 512 leaves | 256 rows, 90 coordinates, 8 leaves | 16,385–125,194 | 16,384 |
| All 64 five-pulse prefixes | 1,048,576 rows across 64 direct solves | 21,864 master/block solves | 5,514,560 | 1,048,576 if all are exported |
| Six-pulse exhibit | 144 rows, 50 coordinates, 4 leaves | 72 rows, 24 coordinates, 2 leaves | 1,841 | 144 |

The worst five-pulse row regression was z1/y0, **125,194 versus 16,384** (7.64×), with radius 1/48. The median cumulative row ratio was 5.15×. The six-pulse exhibit cost 12.78× as many design rows. Cumulative rows count each row each time an LP is solved. Peak dimensions refer to the largest individual LP, not process RSS. Full export adds one solve per block, accounted separately. Preliminary archival timings totaled 31.40 seconds for the direct five-pulse solves and 88.58 seconds for factored design on the same worker. The direct timers began after matrix assembly and the jobs were run separately; these timings are descriptive.

Each table entry below is the cumulative count of LP rows processed in design; rows are the first command and columns the second.

| First / second | ref | group | x0 | y0 | z0 | x1 | y1 | z1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ref | 86,117 | 92,383 | 106,724 | 88,190 | 98,400 | 88,293 | 114,888 | 81,985 |
| group | 82,061 | 112,793 | 88,481 | 98,596 | 82,081 | 82,135 | 84,204 | 98,522 |
| x0 | 82,086 | 84,300 | 98,408 | 80,097 | 82,048 | 67,777 | 80,118 | 86,230 |
| y0 | 65,576 | 98,567 | 96,629 | 98,378 | 65,619 | 84,328 | 47,170 | 82,014 |
| z0 | 114,822 | 102,736 | 110,822 | 123,141 | 51,233 | 98,494 | 114,898 | 69,703 |
| x1 | 82,053 | 98,575 | 84,230 | 80,139 | 82,066 | 16,385 | 80,104 | 82,033 |
| y1 | 65,578 | 80,100 | 96,576 | 47,170 | 65,592 | 94,475 | 16,385 | 69,723 |
| z1 | 81,997 | 104,807 | 106,778 | 125,194 | 69,694 | 100,572 | 114,914 | 98,373 |

As a changed higher-horizon control, a two-command point catalog with rate gap 1/7 and an a/a prefix reaches the analytic nine-pulse radius 5/63. With split depth seven, its 128 leaves were checked in 32 blocks of four. Design took eight rounds and 29,158 LP rows; export took another 5,376. The compact five- and six-pulse examples shipped here include the complete upper worlds, even though their executable lower menus use only four words each.
