# A three-pulse feedback experiment for two continuous families

In the Hidden-state workbench choose **Choose a final pulse for two continuous families**. Each family is the convex hull of finitely many exact command-rate rows. One set of mixture weights, one initial position and one constant drift apply throughout the physical course. Each measured position can have any error in the closed interval [−ε,ε]. The planner checks all ordered choices of two initial commands and every allowed third command, including repeats. A separate four-command fixed control may be supplied or set to null.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-adaptive-hulls.json --create-notebook --output adaptive-hulls.json
node scripts/active-linear-family.mjs --notebook adaptive-hulls.json
node --test tests/position-drift-three-pulse-hulls.test.mjs
```

## What two measured contrasts preserve

For positions y₀ through y₃, subtract the line through the first two readings. The remaining coordinates are s=y₂−2y₁+y₀ and w=y₃−3y₁+2y₀. Two raw histories with identical (s,w) differ by an affine function of time. Shifting the initial position and drift absorbs that difference without changing the mixture or the measurement errors. A common point in this plane therefore corresponds to common raw readings, including the representative (0,0,s,w).

For a command word (p,a,b), a rate vertex r maps to the clean point (r[a]−r[p], r[a]+r[b]−2r[p]). Convex combinations of the input rows give exactly the convex hull of the clean points. A single vector of four original errors contributes (e₂−2e₁+e₀, e₃−3e₁+2e₀). Its complete image is the convex hull of the 16 signed error corners, including when ε=0. The attainable family polygon is the Minkowski sum of these two hulls. Both coordinates use the same errors and the same mixture.

Intersect the two family polygons for each proposed final command b. Vertices of their closed intersection are contained input vertices or edge crossings. Collinear overlap endpoints are included by the containment test. Points and segments are handled explicitly. Projection onto s gives exactly the closed unsafe interval Iᵦ, or the empty set. A measured prefix is resolvable when some final command has s outside its interval. The online receiver first checks the actual prefix for physical consistency, then commits the first such command; no possible final observation enters that choice.

If all Iᵦ have a common s, the prefix loses. For each possible last command choose a common w from the overlapping vertical sections at that same s. The saved refutation reconstructs two original mixtures, starting positions and drifts, and verifies their raw positions against the four readings (0,0,s,w). Different final commands may have different w and different physical worlds. They must share all three earlier readings.

## Why the three-pulse decision is complete

One command cannot identify a family under unknown initial position and drift. At two pulses the scalar s has a closed interval under each family. Disjoint intervals give a fixed two-command experiment; otherwise a common s is possible. At three pulses an arbitrary strategy can use the numerical first readings to choose the first two commands. For a lower bound the adversary can always reply y₀=y₁=0 because the two affine nuisance coordinates let each hypothetical physical history realize these values. That branch chooses an ordered prefix. If every such prefix has a shared s defeating every last command, no adaptive strategy can guarantee identification. A winning fixed prefix and conditional last-command rule work on every physical affine translate.

A fixed triple separates exactly when its intersection polygon is empty. The optional four-pulse control checks joint feasibility of two persistent mixtures and the difference of their initial position and drift at all five ticks. The two measured tubes intersect precisely when the clean trajectories are at most 2ε apart at each tick. A positive weighted contradiction certifies separation. A feasible point supplies raw common readings and independently recovered physical worlds. The planner claims a four-pulse minimum only when the shorter class has been excluded and this control separates. A design or receiving budget cutoff has its own inconclusive result.

## The strict threshold

On commands (ref,x,y,z), the example families are A(t)=(0,t,1−t,0) and B(t)=(0,t,0,−t) for t in [0,1]. At ε=0 every fixed triple has an exact alias. For the four possible omitted commands in source order, the respective parameter pairs are (2/3,1/3), (1,0), (0,0), and (1,1). The first pair differs by the constant offset 1/3 on (x,y,z). Words with repeated commands are subsets of one of these triples, so their aliases persist as well.

After (ref,x), the y continuation can be ambiguous only if s≥1−10ε. Indeed A's clean w is 1, while B has clean w−s=0. The two error radii are 6ε and 4ε. For the z continuation B's clean w is zero and A's w−s is zero, so ambiguity requires s≤10ε. For every ε<1/20 at least one of these two commands is safe. At ε=1/24 their exact unsafe intervals are [7/12,7/6] and [−1/6,5/12]. The receiver can select either command at a measurement strictly between these intervals.

At ε=1/20 the intervals touch at s=1/2. The planner reconstructs a common prefix with private final readings for all four choices. It does the same for each of the other fifteen ordered prefixes, proving that every three-pulse strategy fails. Increasing ε preserves these physical counterexamples. The fixed course (ref,x,y,z) has clean contrast y₄−4y₁+3y₀ equal to 1 for A and 0 for B, with per-family error radius 8ε. It separates at both 1/24 and 1/20. Thus the first case has adaptive minimum three and fixed minimum four. At equality both minima are four. At ε=1/16 this particular control also has a physical collision, leaving longer horizons open.
