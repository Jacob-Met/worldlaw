# An early reading improves the unrestricted sixteen-pulse upper bound

For the registered eight-command source, the unrestricted adaptive H16 radius lies in **[5/32,14/87]**. This improves the [nominal-prefix upper bound of 5/31](sixteen-pulse-terminal-bound.md) by exactly 1/2697. The existing ten-reference fixed tape still separates below 5/32. Equality at 5/32 remains unresolved.

The earlier [seven-row original-source dual](../examples/sixteen-pulse-nominal-prefix-limits.json) also makes 14/87 sharp for this reading rule. On y1 y0 z0 z0 x0 x1 z1 x0 followed by eight references, the rule keeps the nominal observations through tick eight. The dual uses only ticks 0, 7, 8 and 16 and allows a free final observation. Any further decrease in the unrestricted upper bound must therefore change an earlier reading on this suffix-first word, even if all subsequent replies change.

## The causal reading rule

Let μ be the mean rate of the two original balanced mixtures, with canonical weights A=(1,2,1,2)/6 and B=(2,1,2,1)/6. Through tick eight, publish the cumulative nominal reading. At tick nine inspect only the nine commands already received. If they are eight references followed by x0 or x1, subtract 1/174 from the current nominal reading and retain that same additive correction through tick fifteen. All other prefixes keep the nominal readings. On the six branches beginning with eight references and a suffix, the final reading is the midpoint of the two reconstructed physical positions. Elsewhere retain the previous balanced/terminal reading rule with the new bound ε=14/87.

The shift is small but acts before the ninth reading is committed. On the word that forced 5/31 while the ninth reading was nominal, the x0 reply changes from 1/4 to 85/348. At equality the procedure returns a common history for every controller. Commands can be selected after each reading.

## All continuations of the changed opening

The [packet](../examples/sixteen-pulse-early-worlds.json) gives a physical witness for each of the six ninth commands after eight references and each histogram of the final seven commands. Across the six branches, 776 distinct table entries cover all 20,592 branch/histogram cases. For each law the witness consists of convex weights on the original four vertices, one initial position and one drift. A physical state stays fixed for the entire sixteen-pulse trajectory. The world pair may depend on the realized full word because the first sixteen readings, from tick zero to tick fifteen, were prescribed by the causal rule independently of this choice. At tick sixteen the final command has already arrived. An adaptive controller following the common earlier readings therefore reaches a unique word on which both physical worlds can be reconstructed.

Here is the finite all-order test. Through the reference segment each physical line is checked against the nine zero readings. Let b be a world's residual at tick nine and let d(c) be its per-command rate including drift minus μ(c). Any subsequently retained **nonterminal** reading has residual b plus the sum over a proper partial permutation of the seven commands. Fix each possible last command in turn. The extrema over all preceding partial permutations are b plus the sum of the negative increments, or b plus the sum of the positive increments, of the remaining six. Both bounds must lie in [−ε,ε]. Finally, the two full-word positions must be at most 2ε apart, which puts their midpoint within ε of each. The [cold test](../tests/sixteen-pulse-early-bound.test.mjs) uses integer arithmetic directly on the raw vertices to verify every assignment, including repeated commands. No LP or floating-point arithmetic is used by the public receiver.

## Every other opening

For the balanced mixtures, the signed difference is zero on the baseline commands ref/group and 1/6 on each suffix. Every proper-span chord has radius at most 7/45. On a full span the balanced contrast can exceed the threshold 384ε=1792/29 only for pure opposite blocks of lengths (7,9), (8,8) or (9,7). A single wrong-category action at these splits costs at least seven units of the split product. The largest product at any other split is 60. Thus mixed words outside the six source-checked branches retain the ordinary balanced solution.

For an exceptional pure word write b,s for baseline and suffix lengths, C=(bs−384ε)/(6b), α=1/12−2ε/b and β=1/12−2ε/s. The [source transfer proof](all-large-horizon-adaptive-optimum.md) applies whenever the corresponding directional inequalities hold. For b=7,9 all five inequalities still hold. For b=s=8 the suffix-first inequalities hold, with (s−1)C=2ε. The baseline-first slack α−C is −1/348, so using the former baseline-first argument there would be invalid.

If an eight-baseline-first word contains a group command, move C divided by its group count from the neutral group vertex of B to its zero vertex. This changes only the group rate and reduces the baseline-block total by exactly C. Exchanging and negating the signed block roles converts the problem to the verified suffix-first case. The mass shift is at most C=4/87, less than the available 1/3. If all eight baselines are references the appropriate one of the six original-source branches above applies. At the adjacent splits the prior within-group or cross-group transfers still apply, including the role swap for a uniform within-group histogram containing a group command.

The command below is the existing public receiver with its new mode. Passing a JSON run list with `--runs` returns measured positions and both persistent physical states. Every partial transcript keeps the same readings when extended. A witness returned for a partial changed prefix is obtained by padding privately with references; this cannot change an earlier reported value. The historical `--terminal-bound` mode still reproduces 5/31.

```sh
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-sixteen-pulse-upper.json --early-bound
```
