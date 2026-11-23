# Successive decisions on one physical run

In the Hidden-state workbench, load **Choose commands at successive measurement rounds**. Freeze the experiment and record one initial position. At each decision the notebook reveals the next commands permitted by the retained readings. All measurements belong to one trajectory with a persistent initial position and drift.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-feedback-tree.json --create-notebook --output tree.json
node scripts/active-linear-family.mjs --notebook tree.json
node --test tests/position-drift-feedback-tree.test.mjs
```

Each program node commits a nonempty command sequence. An internal node offers one to eight child nodes. All leaves use an equal pulse budget. Intake admits up to sixteen laws, 32 program nodes, four committed segments and sixteen pulses on each path. The source sets a separate limit on the number of distinct node and law-set subproblems.

## Certification and replay

At each node reached with a set of possible laws, test pairwise compatibility on **every command and observation time along the complete ancestral tape**. Each realizable set of surviving laws is contained in a maximal compatibility clique. A leaf separates its inherited laws when all pairs are strictly separated on its complete tape. At an internal node, each maximal clique must have at least one recursively certified continuation. Cached results for one node and inherited law set can be referenced by several rows of the saved decision table.

During execution the persistent-state receiver recomputes the compatible laws from the full measured history. It chooses a covering clique and commits that row's next segment before receiving its later positions. Previously excluded laws cannot reappear with additional readings. Induction along the finite tree shows that a certified course identifies one law at its final leaf for every feasible bounded-error run.

A failed leaf has a physical pair collision on its whole tape. Collisions in different rejected child tables may require different ancestor histories. Clique coverage is sufficient: an uncovered group or exhausted budget leaves the program inconclusive. The planner does not infer one common adversarial history across failed children.

## A four-pulse experiment that needs two decisions

The catalog has three groups, two subgroups per group and one hidden bit per subgroup. The reference rate is zero. The group command has rate 16 times the group index. Each group has one subgroup probe returning zero or 16, and each of the six private group/subgroup addresses has a bit probe returning zero or 16. Probes belonging to another group or address return zero. The error bound is one.

Apply the reference and group commands. Their measured second difference identifies the group with error at most four. Choose its subgroup probe as the third pulse. Subtract the reference increment from the third increment to identify the subgroup, again with error at most four. Only then choose the addressed bit probe as the fourth pulse. The same contrast identifies the bit. The raw dynamics test exercises every law, all six paths and all 32 independent error corners per law.

**No four-pulse policy with one predeclared feedback cut can guarantee identification.** With a cut at tick zero or four, the four-command tape misses at least two private bit probes. With a cut after one pulse, answer the first two observed positions with zero. The entire remaining tape is fixed. Choose an address whose bit probe the tape missed. Its two bit laws realize the earlier zeros with the same drift cancelling their first rate, and agree throughout the tape.

With a cut after two pulses, some group had neither its subgroup nor either bit probe touched. Both subgroups and both bits in this group share a prefix at a fixed zero start. A two-command continuation either misses a private bit or uses both bit probes but leaves the two zero-bit laws identical. After three pulses an untouched group defeats any single last probe. If every group was touched, each received exactly one local probe. In each group choose a subgroup for which this probe returns zero without inspecting its bit. The all-zero prefix then leaves an unprobed bit pair in every group; one last command cannot inspect all three addresses. The independent rate-signature check covers all 121 ordered two-command prefixes and all 1,331 ordered three-command prefixes with every remaining suffix.

**Even unrestricted adaptive control needs four pulses.** Answer the first two observed positions with zero, which determines the first two commands of a three-pulse policy. Choose a group untouched by either and set its initial drift to cancel the first rate. All four laws of this group realize those earlier answers and the same third position. The last command cannot inspect both private bits. These causal witnesses and the successful four-pulse policy establish the exact minimum for this catalog. Other programs retain their own horizon uncertainty.
