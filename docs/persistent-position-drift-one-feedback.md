# Design one feedback decision from a rate catalog

Choose **Design a last command for a rate catalog** in the Hidden-state workbench, or run:

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-one-feedback.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-one-feedback.json --create-notebook --output my-feedback.json
node --test tests/position-drift-one-feedback.test.mjs
```

The source declares an exact rate catalog, an ordered list of fixed command prefixes and two work budgets. For each proposed prefix the planner asks whether a choice among the catalog's final commands guarantees identification. When it finds a winning prefix, the receiver computes the closed interval of possible final readings for every remaining law under each command. It chooses the first command in catalog order whose intervals are pairwise disjoint. The notebook commits the prefix readings before accepting the selected command's final reading. Opening a saved notebook checks the source and recomputes its scientific results.

## What the outcomes prove

- **One feedback decision certified.** A policy works for the returned prefix at the declared error bound and with an unknown initial position and constant drift. Earlier refuted prefixes keep their counterexamples.
- **Every declared prefix refuted.** Each prefix includes one shared history and, for every possible final command, its own possible last reading and two compatible physical starting states. Any policy choosing its last command from that history can encounter an ambiguous outcome.
- **Search inconclusive.** An assignment or linear-work budget ran out. Completed physical refutations remain available. A partially examined prefix has no identifying or impossibility verdict.

These outcomes concern the supplied prefix list and a single terminal choice. They establish neither a global minimum horizon nor failure of policies that use feedback earlier.

## Closed feasibility test

For a proposed prefix of length m, keep one set of readings at ticks 0 through m. Give each possible final command its own independent last reading at tick m+1. An assignment names one pair of laws per final command. Each branch may have its own physical worlds and error sequence, while all branches share the same prefix readings. Subtracting a common affine function of time fixes the first two shared readings to zero whenever present. The corresponding change of initial position and drift preserves all laws' feasibility. For an empty prefix only the initial reading is fixed.

For one law, subtract its accumulated commanded forcing from the readings, leaving z. A compatible starting state satisfies |z(t)−p−tv|≤ε. These closed strips in the two unknowns p and v have a common intersection exactly when all triples do: apply the planar Helly theorem and note that any two distinct observation times can be interpolated exactly. At three ticks a<b<c the test is

    |(c−b)z(a) − (c−a)z(b) + (b−a)z(c)| ≤ 2(c−a)ε.

Build both signed inequalities for each law and branch of the assignment. Every terminal coefficient belongs only to that branch's last reading. A feasible point is converted back to original shared and private measurements; the ordinary state-region receiver reconstructs two starting states per branch. A single such point refutes the prefix. If every assignment is infeasible, each feasible measured history has at least one command with mutually disjoint last-reading intervals. This proves the runtime selection rule.

The linear solver accepts rational rates and readings with integer time coefficients. It retains the tightest inequality for each equal normal and checks opposite-normal contradictions directly. If a new inequality cuts off the current feasible point, a feasible intersection must reach its boundary (connect the old point to any point satisfying the enlarged system). Eliminate one coordinate on that boundary and solve the reduced system. A successful point lifts by substitution. An infeasibility certificate lifts by adding multiples of the original inequalities. The new boundary's coefficient must be nonnegative, since the previous feasible point satisfies the earlier inequalities and violates the new one. Every returned certificate is checked again: its positive integer weights cancel every coordinate and sum to a strictly negative right-hand side. Equality stays feasible.

## Budgets and replay

The Cartesian product of possible law pairs is walked incrementally. For L laws and C final commands it has (L(L−1)/2)^C members, so the caller declares an assignment cap. The second cap charges input inequalities, active-row checks and boundary reductions. These are implementation work units, not a wall-clock bound. Source parsing, physical witness recovery and output size also cost time. Exact arithmetic and notebook size are subject to the available runtime resources.

`planOneFeedback(request)` returns a policy, concrete refutations or the exhausted budget. `verifyOneFeedbackCertificate(request, report)` checks every assignment proof for a winning prefix by substitution without running the feasibility search. `openOneFeedback(request, report)` rederives the complete saved result and returns a receiver for the certified prefix. The sample refutes the two-pulse prefix and certifies the five-pulse prefix after 37 assignments. It uses the original [case-12 rate rows](position-drift-case-twelve-feedback.md) under renamed laws and commands. The historical replay keeps its registered last-command priority; the generic receiver uses catalog order.

The tests retain both case-12 prefixes, the case-8 three-private-reading refutation, equality and a rational perturbation of less than 10⁻⁸⁰, explicit budget exhaustion, and exact notebook replay. Linear-solver controls include higher-dimensional contradictions requiring positive combinations of three to six inequalities and 120 independently vertex-checked planar systems.
