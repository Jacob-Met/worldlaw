# Four pulses with two observation-dependent decisions

Two convex rate families can require both feedback decisions. In the eight-command grouped example, every four-pulse experiment that selects a suffix once at a fixed cut can collide even with exact readings. A four-leaf program using both cuts succeeds for every position-error bound strictly below 1/40. Its boundary collision at 1/40 applies to this particular menu. The unrestricted four-pulse threshold for the grouped catalog remains open.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-two-feedback-groups.json --four-pulse-feedback --output group-proof.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-two-feedback-groups.json --four-pulse-feedback --replay group-proof.json --readings positions.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-four-pulse-tetrahedra.json --four-pulse-radius --output four-classes.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-four-pulse-tetrahedra.json --four-pulse-radius --replay four-classes.json
```

A readings file contains one through five consecutive exact positions, including the initial reading. Rational strings and safe integer tokens follow the existing notebook input convention. For example, `[17,20,24,27,31]` follows ref, group, x1, y1 and retains A. Shorter records return the next command from the observed prefix. The certificate replay binds the input families, noise level, work bounds and menu. Design or receiving exhaustion returns a distinct inconclusive status.

## Why the grouped catalog needs both cuts

Each physical family mixes four source vertices with persistent, nonnegative weights summing to one. The vertices belong to group zero or one and to within-group coordinate zero or one. Let W be the total mass of a chosen group and x the mass at its second vertex. The command ref has rate zero, group measures the mass of group one, and local command x measures x in either family. The local (y,z) rates are (W−x,0) in A and (0,−x) in B.

With exact readings, ref and group reveal which group has mass at least one half. Probe that group’s x. If x≤W/2, y separates the families. Otherwise z separates them. The checked positive certificate accounts for bounded errors and one unknown start/drift pair in each physical world. Its eight nonnegative supporting rows give the exact failure radius 1/40. At that bound every branch shares normalized initial contrast 9/20. Separate third-command branches may then have different intermediate readings, and sibling final commands after the same third command receive the very same intermediate reading.

For the single-cut lower bound, the verifier checks all 64 possible two-command prefixes when one suffix of length two is chosen after two pulses (early), and all 512 three-command prefixes when the last command is chosen after three (late). Repetitions are allowed. At the early cut one shared third position defeats every committed suffix; its fourth position may depend on the entire suffix that was already chosen. At the late cut both the third and fourth positions must be common to all last commands. The example contains 8,192 counterfactual leaves and two exact physical trajectories per leaf. Each pair uses persistent denominator-four barycentric weights. Initial position zero and drift equal to minus the first rate reproduce the recorded first two zeros; the verifier directly accumulates each subsequent command rate. These clean overlaps persist for every larger noise bound. The denominator-one search misses 20 prefixes and returns inconclusive. A finite grid only supplies physical witnesses: an unsuccessful grid search never certifies separation.

A fixed tape belongs to either single-cut class. Every shorter strategy can be padded to four pulses under the early cut, since the first two readings carry only the unrestricted affine nuisance and the third pulse can depend on the first informative contrast. Consequently the grouped catalog has minimum adaptive horizon four for 0 ≤ ε < 1/40. More general decision-timing conventions and larger pulse budgets are outside the single-cut lower bound.

## Computing a four-pulse radius

For a word (p,a,b,c) normalize five raw positions to (0,0,s,w,v), where s=y₂−2y₁+y₀, w=y₃−3y₁+2y₀, and v=y₄−4y₁+3y₀. The affine transformation shifts only the initial position and drift. A rate vertex maps to (r[a]−r[p], r[a]+r[b]−2r[p], r[a]+r[b]+r[c]−3r[p]). The attainable set in each family is its clean convex hull plus the common five-error zonotope scaled by ε. The unit zonotope generators are (1,2,3), (−2,−3,−4), (1,0,0), (0,1,0), and (0,0,1).

Find both signs of the cross products of every pair of directions taken from all clean vertex differences and the five error generators. Each facet of a positive-noise Minkowski sum is exposed by maximizing a linear functional over the two summands. The resulting face is their sum. Its plane is spanned by two independent directions drawn from the clean-face edges and the exposed error generators, including the case of one edge from each summand. Thus the collected normals contain every facet direction; surplus normals supply valid supporting inequalities. At zero noise the same finite supports still recover the clean hull by the closed limit, including point, line and planar cases. For a source normal n the clean support h is a vertex maximum, and the noise support r is Σ|n·gᵢ|. Using a product of marginal intervals would enlarge this set.

Each possible continuation is a leaf with the inequalities of both families. Put its n coefficients in the three columns corresponding to the observations that exist on its own ancestral path, giving Mx ≤ h+rε. The table below shows how leaves share observations after the first two normalized zeros.

| Class | Chosen prospectively | Shared observations |
| --- | --- | --- |
| Fixed | One four-command word | One observation path |
| Late | First three commands | s and w across every last command |
| Early | First two commands | Only s across committed suffix pairs |
| Full | First two commands | s across all leaves, w across siblings of the same third command |

Every realized history of a failing course has one shared assignment to these columns, with a separate persistent state per law per leaf. Conversely, a feasible assignment gives the causal adversary: use its recorded value at each visited node regardless of which allowed future command will be chosen. An unavailable common assignment yields a winning online strategy by finite backward induction. In the measured menu receiver, at a supplied s the final coordinate is eliminated separately in each leaf, giving each candidate final command’s closed unsafe w interval. Choose a third command whose sibling intervals have empty **common** intersection. After receiving w, choose a final command whose interval excludes that specific w. Actual readings are also checked against complete persistent rate trajectories. No future observation enters either decision.

To minimize ε, the exact rational simplex starts at zero in the dual max −h·λ, with λ≥0, Mᵀλ=0 and r·λ≤1. Writing each coordinate equality as a pair of inequalities gives a feasible slack basis even for degenerate physical regions. Bland’s entering and leaving rules settle zero-step pivots. At optimality the row prices recover feasible shared coordinates and the failure radius. The report keeps the nonnegative source-support weights: they cancel separately in every ancestral observation column and prove ε cannot be smaller. For the converse it reconstructs one raw starting position, drift and barycentric mixture per family per leaf at the boundary. The direct verifier evaluates the original supports and physical states without rerunning simplex. A zero lower bound uses only ε≥0. The maximum first failure over prospectively fixed prefixes is the class radius; equality is already a failure.

| Catalog | Fixed | Late only | Early only | Full |
| --- | ---: | ---: | ---: | ---: |
| Original lines | 1/16 | 1/14 | 1/16 | 1/14 |
| Enlarged triangles | 1/22 | 1/18 | 1/21 | 1/18 |
| Changed tetrahedra | 1/68 | 10/659 | 1/65 | 1/65 |

All three rows are global within their four declared classes, with every ordered prefix/word checked. On the changed tetrahedra at ε=2/131, early and full succeed and late and fixed fail. That row alone does not require two decisions. The eight-command grouped source supplies the stronger distinction with a restricted winning menu and exhaustive single-cut failures.
