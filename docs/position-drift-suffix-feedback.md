# Choosing an entire suffix from measured positions

In the Hidden-state workbench, load **Choose a command sequence from prefix readings**. Freeze the plan and enter the starting position and each prefix position. The notebook commits all commands of the chosen suffix at this point. Later positions update the compatible laws and their physical starting states. Exporting and reopening the notebook recalculates the decision from the original prefix.

The same experiment runs in the notebook CLI.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-suffix-feedback.json --create-notebook --output early.json
node scripts/active-linear-family.mjs --notebook early.json
node --test tests/position-drift-suffix-feedback.test.mjs
```

## Certificate scope

Supply one finite rate catalog with its error bound, a fixed prefix and an ordered menu of equal-length suffixes. At most 16 laws, 16 suffixes and 12 total pulses are accepted. Initial position and drift are unknown and persistent. Each reading has an independently bounded additive error.

Create an edge between two laws if they can produce a common prefix record. The exact fixed-tape triple test checks this in both directions. Strict separation supplies a rational contrast witness. Equality leaves an edge. Every realizable survivor set is a clique and thus lies in at least one maximal clique. Enumerate maximal cliques and, for each one, find a suffix whose **complete** prefix-plus-suffix tape separates every pair of its laws. The certificate stores the excluded prefix edges, the cover and the signed three-tick witnesses for the chosen tapes. At reception, the exact persistent-state solver determines the survivors. Choose the first covering row and commit its suffix from those readings alone.

A failed cover is inconclusive. Pairwise compatible laws can require different histories, and different histories for the same pair can favor different suffixes. A failed row carries an actual collision on each whole tape, possibly with a different prefix for each collision. The tests include a three-law catalog for which this cover fails and the complete one-final-command procedure certifies a policy.

Joint suffix geometry matters. For rates (0,0,0) and (0,5,−5), a zero prefix from the reference command admits a common next reading of 2. Both laws can also end at 0 when the intermediate reading is unobserved. Under unit error the complete sequence separates the laws. Replacing 5 with 4 makes the error intervals touch and produces a physical collision.

## A catalog that needs an earlier decision

The authored catalog has four groups. Each contains four laws encoding two bits. The reference rate is zero. The group command has rate 16 times the group index. Each group owns two commands that read its respective bits at rate zero or 16. Those commands have rate zero in all other groups. The reading error bound is one.

Apply the reference and group commands. The second difference of the first three readings gives 16 times the group index plus an error of magnitude at most four. The four closed intervals are disjoint. Commit both bit probes of the identified group. For each probe, subtract the reference position increment from its position increment. Its bit centers are zero and 16 with error at most four. All four groups are covered, at four pulses total. The fixture checks all 512 law/error-corner trajectories with shifted initial position and drift.

Every policy fixing its first three commands misses some group's two probes. All four laws of that group generate the same physical prefix at one fixed starting state. Whatever fourth command is selected from this history, it can inspect at most one private bit, leaving two feasible laws with identical complete readings. The independent dynamics check includes all 1,000 such prefixes and all 10,000 possible final leaves.

Even an unrestricted adaptive policy using only three pulses can receive a common record. Answer tick zero and tick one with zero. These answers determine the first two commands. Pick a group whose probes neither command used. Across its four laws, choose initial position zero and drift equal to the negative first-command rate. Both earlier answers then hold, and the second-command position is the same across the group. After the policy receives that position, its final command still reads at most one private bit. Choosing two laws equal on that bit supplies one persistent zero-error realization per law. The independent test checks all 100 first-two-command cases and each of the ten final choices. This proves four pulses are the adaptive minimum for this catalog. The generic cover makes no minimum claim for other inputs.
