# How much position error can three adaptive pulses tolerate?

The existing three-pulse planner answers for a supplied error bound. The robustness certificate takes the same two finite-vertex convex rate families and computes the exact first failure bound for every ordered pair of initial commands. A pulse means one chosen command followed by its position reading. The initial reading is also observed. Each physical trajectory uses one mixture of rate vertices, one initial position and one constant drift. Bounds include their endpoints.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-adaptive-hulls.json --three-pulse-radius --output line-certificate.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-adaptive-hulls.json --three-pulse-radius --replay line-certificate.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-triangle-radius.json --three-pulse-radius --output triangle-certificate.json
```

The returned global radius is the maximum of the per-prefix first failures. For any nonnegative error strictly below it, some three-pulse strategy guarantees identification. At equality or above, every such strategy admits a common-history refutation. A zero radius records physical indistinguishability through three pulses even with exact readings. The requested noise verdict applies to the original source. A separate nominal four-pulse control is retained in the source binding and plays no role in this calculation. The original fixed-noise planner still supplies the online command choice at the requested bound. Higher horizons remain open unless another certificate settles them.

## Computing the exact threshold

Subtract the affine interpolation through the first two observations. The remaining observable coordinates are s = y₂ − 2y₁ + y₀ and w = y₃ − 3y₁ + 2y₀. For prefix (p,a) and last command b, each source vertex maps to (r[a] − r[p], r[a] + r[b] − 2r[p]). Their closed convex hull C contains precisely the clean responses. The same four original position errors act on both coordinates through generators (1,2), (−2,−3), (1,0), and (0,1). At error bound ε, the complete observed region is C + εZ, where Z is the sum of the four unit intervals along these generators.

In direction n its support is h_C(n) + ε Σ|n·gᵢ|. All supporting edges of a planar Minkowski sum are parallel to an edge of C or a generator of Z. This follows by maximizing a linear functional over both summands: the exposed face is the sum of the exposed faces, and a one-dimensional face has a segment in at least one summand. The signed edge normals of the nonzero clean edges and the four generators therefore suffice. The unit-error zonotope has interior. For ε>0 these finitely many supports describe the entire polygon. At ε=0 their intersection remains exactly C, since C+εZ decreases to the compact C as ε tends to zero. Points, segments, duplicate vertices and collinear edges obey the same construction.

For each possible last command, apply its two families’ support inequalities to the same (s,wᵦ). Eliminate wᵦ by combining every positive and negative coefficient bound with nonnegative multipliers. Retain constraints independent of wᵦ. This step is exact because an admissible value exists if and only if every lower bound is at most every upper bound. Keep the projected rows for all commands together and eliminate their single shared s in the same way. The resulting rows have the form 0 ≤ h+rε, with r≥0. A sufficiently large measurement bound always permits a collision across this finite experiment, so a row with r=0 must have h≥0. The largest of zero and −h/r over positive r is exactly the first ε that admits a shared history against every final command.

For any positive radius, one active scalar row supplies at most four nonnegative multiples of original supporting inequalities. Their wᵦ coefficients cancel **separately for each last command**, and the s coefficients cancel jointly. Evaluating their support values on the source vertices proves failure is impossible below the reported radius. To prove failure at equality, the program reconstructs s, a separate wᵦ for each last command, and one raw physical state per law per branch. The verifier checks the weights, initial state, all four clean positions and the bounded errors against (0,0,s,wᵦ). These same histories work at every larger bound. Setting the first two observations to zero is legitimate under the unrestricted affine nuisance. Every adaptive strategy can be forced onto one of the checked prefixes. Conversely, choosing a winning prefix prospectively works at every affine translation.

Direct replay checks the lower certificate and the original physical trajectories. It does not need to reconstruct the polygon projections or search over noise. An exhausted design returns no radius. Its replay reruns the limited design solely to verify that inconclusive result. The work count is an implementation diagnostic. Full verification uses the input’s design-work limit.

## Two closed-boundary examples

| Family geometry | Best prefix | First failure | Shared (y₀,y₁,y₂) at that failure |
| --- | --- | --- | --- |
| Original segments | (ref,x) | 1/20 | (0,0,1/2) |
| Two triangles | (ref,x) | 1/26 | (0,0,5/13) |

The original four active supports add to 0 ≤ −1 + 20ε. The triangle catalog adds vertex (0,0,1,1/3) to A and (0,0,1/3,0) to B. Its supporting row proves ε≥1/26 for any common history after (ref,x). All sixteen prefixes in each certificate have a physical history at their own critical bound. Both examples retain a fixed four-pulse separator at equality.

The separate marginal error radii of s and w are 4ε and 6ε. Replacing the shared-generator zonotope by their Cartesian product loses information. In the original 1/24 experiment that relaxation permits s=1/2 to defeat both y and z. At y the independent intervals admit common final contrast 3/4 from clean points (1/2,1) and (2/3,2/3). At z they admit 1/4 from (1/2,1/2) and (1/2,0). The exact shared-error supports exclude both collisions. All other prefixes already lose in the physical model, so the rectangular relaxation would refuse a valid experiment.

The four-pulse extension retains a separate observation at each decision-tree node. [Four-pulse thresholds and a two-decision witness](position-drift-four-pulse-radius.md)
