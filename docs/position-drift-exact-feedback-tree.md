# An exact search over counterfactual feedback histories

In the Hidden-state workbench choose **Find a winning continuation for each measured history**. Freeze the program and enter positions only for the commands it has committed. A later branch remains undecided until its parent segment has been measured.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-exact-feedback-tree.json --create-notebook --output exact-tree.json
node scripts/active-linear-family.mjs --notebook exact-tree.json
node --test tests/position-drift-exact-feedback-tree.test.mjs
```

The v2 source accepts up to four laws, four terminal paths and twelve pulses per path, in addition to the existing command-program structure limits. Every path ends at the same pulse count. A completed search either certifies a policy on this declared program or returns a causal adversarial record covering all its choices. The assignment and linear-work limits can instead produce an inconclusive result. Other programs and the unrestricted minimum horizon remain separate questions.

## Which observations are shared?

A losing initial segment has a *single* measured history at which every child continuation can fail. A child may have its own later observations, but all its grandchildren must agree up to the child's next decision. Assign a distinct coordinate to each position on each program node. Every descendant terminal path inherits that node's exact coordinate IDs, even when simulated with a different law. Sibling nodes have private later coordinates. This preserves the order of decisions while allowing physically different counterfactual futures. At every terminal path a failure needs two distinct laws consistent with all of that path's readings.

For each candidate pair at a terminal path, the unknown initial position and constant drift are eliminated exactly. At ticks i < j < k the weights (k−j, i−k, j−i) cancel both. Each law requires both signs of the resulting contrast to lie within 2(k−i) times the error bound of the same forcing contrast. All triples suffice because the original constraints are strips in a two-dimensional initial-state space. Each leaf therefore keeps one persistent start per law throughout its whole tape. Different hypothetical branches may require different starts for the same law.

During prospective search the root's initial two observed positions can be set to zero by a common affine translation of all branches. The remaining shared and private coordinates enter one rational inequality system. At each leaf, pairs that cannot collide even on the unrestricted fixed tape are screened out first. Search assigns one of the remaining pairs to every terminal path. An infeasible partial assignment excludes all its completions. Its saved positive weights sum the relevant physical inequalities to a strict contradiction. The independent verifier checks these sums by substitution and confirms they cover every candidate assignment.

A feasible full assignment gives one observed vector per node and two physical starting states per leaf. The receiver independently checks each complete path with its original equations. These common ancestor records define a causal adversary for any sequence of program choices. Conversely, a program with no winning strategy supplies a common losing history at its root and one losing continuation for each child. Repeating this finite construction gives exactly a feasible leaf assignment of the kind searched. A complete tree of contradictions therefore certifies a winning strategy. On reception the receiver pins the true measurements at each visited ancestor, screens in only surviving laws, and tests the descendant alternatives again before committing the next segment. No sibling's hypothetical later measurement is used to choose a command.

## A case where the clique cover is inconclusive

The prefix consists of commands a and b. The two possible continuations are c followed by a measured choice of e or f, and the committed sequence d followed by e. The earlier clique-cover planner cannot certify this catalog. The exact search visits four assignments and retains two weighted contradictions.

Independently projecting the complete four-pulse trajectories onto the root's second difference s gives the following closed sets. The contingent c branch can fail at s=2 only. The committed d,e branch can fail on [−10/3,4/3]. They are disjoint. All three terminal paths are essential: removing any one produces a common ancestor record with two physical worlds at every remaining leaf.

At s=1 the receiver must first commit c. If the next normalized position is −11/4 it must choose f. If it is 4 it must choose e. A final position of 6 identifies L0 and L1 respectively. Treating the three terminal paths as choices that all must be committed at the root admits a common refutation at that same s=1. Thus the additional decision depends on a genuinely new reading. The fixture was selected as a structural counterexample and carries no prevalence claim.
