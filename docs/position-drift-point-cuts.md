# A minimum command set from physical disagreements

In the Hidden-state workbench choose **Find the minimum using physical disagreement sets**. The model is the same zero-noise reference point and competing convex family as in [the support theorem](position-drift-point-support.md). This search asks the physical model about promising command sets and saves a checkable lower proof. Previously frozen exhaustive-subset notebooks retain their original results.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-disagreement-cuts.json --create-notebook --output cuts.json
node scripts/active-linear-family.mjs --notebook cuts.json
node --test tests/position-drift-point-cuts.test.mjs
```

## Why a hitting set supplies a lower bound

Fix the reference rate row r. Take any persistent competitor mixture b and drift shift c, and form its disagreement set D={u : r(u) ≠ b(u)+c}. On every word outside D the two physical members can produce the same reference trajectory in any order and with arbitrary repeats. Every separating subset must therefore hit D. An empty D proves an all-horizon alias.

Seed the search with the source vertices and their barycenter, testing the shifts that agree with the reference on at least one command. All cuts are backed by an actual mixture and shift. A subset cut implies any larger disagreement cut, so strictly weaker cuts may be discarded. The integer search proposes a smallest hitting set S for the retained cuts. If the convex model admits a competitor on S, its new D is disjoint from S and adds a necessary constraint. Otherwise S separates, and agreement of its size with the integer lower bound proves the adaptive minimum. In a completed finite search each unsuccessful proposal is excluded from subsequent iterations; the explicit work budgets can stop it earlier.

The checker recomputes every disagreement from the original rates and checks all mixture weights. Its lower proof either exhibits more pairwise disjoint unhit cuts than remaining commands, or branches over every command of an unhit cut. These branches cover every possible way to hit that cut. A direct zero-sum functional is checked against every original vertex to verify the upper tape. No optimization is needed to check the certificate. The causal receiver follows only the fixed reference trajectory, choosing a compatible physical witness after any subminimum command history.

## Two linear shortcuts before convex search

On a candidate S first solve Σw=0 and (r−v)·w=1 for every competitor vertex v restricted to S. A solution strictly separates the reference from the entire affine hull and is checked on all vertices. If those equations have no solution, solve for weights of one mixture that matches all candidate command differences. Accept a particular solution only when its weights are nonnegative, sum to one, and reproduce the reference under one drift shift. Negative coordinates in a particular solution do not prove infeasibility. All unresolved cases go to the existing exact convex halfspace solver.

At zero noise the new receiver similarly checks the joint measurement equalities on the same mixture, position and drift. Inconsistent equalities exclude the family. A physically admissible particular solution supplies a witness. A solution outside the simplex is inconclusive, so the bounded convex solver handles that case. The complete closed joint region is retained in the notebook.

## The skewed simplex

The example contains a zero reference command and fourteen ordinary commands. The point law is zero. Competitor vertex j has rate j on ordinary command j and zero elsewhere. Each individual vertex already proves that its own command must be tested. On all fourteen ordinary commands an interior mixture proportional to 1/j has constant rate. Its shifted trajectory differs from the reference only on the reference command. The fifteen disjoint singleton cuts prove that every command is necessary. Testing all fifteen gives an affine separator.

The search uses two convex-family candidate queries, 1,648 design work units and 76 integer work units. Both physical families are identified from a complete representative record in 367 receiving units. With twelve commands the search also uses two queries, 1,066 design units and 61 integer units. With twenty-four commands the figures are two queries, 4,150 design units and 121 integer units. At twelve commands the previous exhaustive solver actually checked all 4,095 nonempty subsets and used 69,556 linear units. At fifteen it reached its 100,000-unit design limit after 2,237 subsets, with only sizes through four completely covered. These gains concern the measured affine-separable cases; minimum hitting set remains NP-hard.

candidateLimit bounds calls on proposed hitting sets. hittingWork bounds integer search across all iterations and final proof construction. The catalog's designWork covers seed construction, exact linear solves and the general convex fallback. Its receiverWork bounds physical receiving. Each exhausted search names the limit and gives its last proved lower bound. It does not emit a certified tape.
