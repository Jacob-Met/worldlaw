# Higher-order common histories

In the Hidden-state workbench, choose **Check which laws can share a prefix**. The example offers two fixed, two-pulse suffixes after four prefix pulses. The [pairwise suffix planner](position-drift-suffix-feedback.md) leaves the example inconclusive. Each of the six law pairs and all four law triples can produce a common prefix, yet the four laws together cannot.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-history-suffix.json --create-notebook --output history.json
node scripts/active-linear-family.mjs --notebook history.json
node --test tests/position-drift-common-prefix.test.mjs
```

## How the certificate works

Each law has a physical position trajectory of the form `p + t*v + F(t)`, where the known forcing `F(t)` is its cumulative rate along the fixed prefix. Initial position and drift may differ between hypothetical laws. All surviving laws must explain the same measured positions within the declared error at every tick. Subtract the affine line through the first two readings from all readings. This changes only the nuisance position and drift of each world, so both first readings can be fixed to zero.

For three ticks i < j < k, use the weights (k−j, i−k, j−i). They cancel the nuisance line. The resulting contrast of the readings lies within 2(k−i) times the noise bound of the same contrast of the forcing. These conditions on all triples are sufficient for a single persistent intercept and slope, since every three physical strips in their two-dimensional space intersect. Keeping both signs makes equality feasible. Write each law's inequalities on the same remaining measured coordinates and intersect them exactly. A feasible point yields common readings and one replayed physical start per law. Otherwise a positive weighted combination has all left coefficients zero and strictly negative right side.

The planner starts with the maximal pairwise-compatibility cliques. It accepts a group immediately if a whole suffix separates every pair on its complete tape. For a group without such a suffix, test common-history feasibility. An infeasibility certificate may use only a subset of the group. Every physically possible survivor set must omit at least one law from that support. Removing each supported law in turn covers every remaining possibility, and each child has fewer laws. Repeated subsets share their result. The accepted leaves contain the actual survivors of every feasible prefix. Once measured, that prefix selects one leaf and commits its entire suffix.

The v2 source adds two explicit search limits. One counts distinct subset visits. The other counts construction and intersection work on shared-prefix inequalities. The inherited v1 size caps bound prefix-graph and pairwise tape tests separately. Exhausting either new limit leaves the policy inconclusive. A common prefix for an uncovered group and separate collisions on each whole tape also leave the cover inconclusive: those tape collisions can require different histories. The procedure certifies this sufficient family of covers. More general policies may exploit where inside a surviving region the readings fall. V1 sources keep their original pairwise result and saved notebooks.

## Four laws that require a four-way exclusion

Write the three normalized readings after the first two positions as x, y and z. Four necessary inequalities follow directly from the supplied rate rows and the unit error bound.

| Law | Ticks | Inequality | Weight |
| --- | --- | --- | ---: |
| D | 0, 1, 2 | −x ≤ −2 | 9 |
| A | 0, 1, 3 | y ≤ 3 | 4 |
| B | 1, 2, 4 | 3x − z ≤ −1 | 3 |
| C | 0, 3, 4 | −4y + 3z ≤ 5 | 1 |

Adding them at the indicated weights gives 0 ≤ −4. Each proper triple has a physically feasible normalized prefix.

| Possible laws | Prefix positions | Committed suffix |
| --- | --- | --- |
| B, C, D | 0, 0, 2, 4, 7 | x, rest |
| A, C, D | 0, 0, 2, 8/3, 5 | x, rest |
| A, B, D | 0, 0, 2, 2, 7 | y, rest |
| A, B, C | 0, 0, 0, 0, 1 | y, rest |

The tests reconstruct all twelve law-specific starting states and suffix rollouts. For the first row, positions 6 and 8 after the suffix leave only law B. Each offered whole tape also has a two-law collision if the initial four-law clique is kept intact. The four-way exclusion permits a six-pulse policy on the supplied menu. Its minimum horizon is undetermined.
