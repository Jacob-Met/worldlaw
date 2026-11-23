# The zero-noise minimum against a reference family

Choose **Find the zero-noise minimum against a reference family** in the Hidden-state workbench. One family must have a single raw rate vector up to addition of a constant across all commands. Its source may contain multiple such vertices. The second family may be any finite convex hull of exact rate rows. The receiver keeps a single mixture, initial position and constant drift throughout the experiment.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-point-support.json --create-notebook --output support.json
node scripts/active-linear-family.mjs --notebook support.json
node --test tests/position-drift-point-support.test.mjs
```

## Why adaptivity cannot reduce the optimum here

Let r be the first vertex of the reference family. On a command subset S the competitor can imitate r exactly when it has a single mixture of rates b and a scalar c such that r(u)=b(u)+c for every u in S. Starting at the same position and shifting its drift by c makes the complete noiseless trajectories identical, in any order and under repeated commands. Boundary mixtures count as valid.

Follow the reference trajectory with initial position and drift zero. Each reply depends only on the command just applied and the accumulated position. On any branch of h pulses an adaptive policy has used a particular subset S with at most h distinct commands. If every such subset admits a match, the competitor on that branch can explain the entire record with one persistent physical state. The matching mixture can depend on which branch the policy actually took. The reference readings are the same causal rule on all branches. Consequently no adaptive policy can guarantee a correct label at that horizon. A nonzero origin and drift can also be used by adding the same affine trajectory to both worlds.

Conversely, suppose S has no match. The reference is a point after quotienting out constant offsets. Its point and the competitor's compact convex rate hull therefore have disjoint projections on S after the same quotient. A strict separating weight vector on S has sum zero in the original coordinates. Apply each command once. The successive position differences equal the rates plus one unknown drift. Taking the returned weighted sum cancels that drift and places every member of the two families in disjoint rate intervals. Thus the global adaptive minimum equals the cardinality of the smallest distinguishing subset. If the full command menu still admits a match, no horizon suffices. The theorem requires zero measurement error.

## Search, substitution and replay

The solver first classifies the full menu and then visits subsets in increasing cardinality. For a minimum k the certificate saves one separating k-command tape and an alias for every subset of size k−1. Any shorter subset extends to one of these. The independent checker verifies the unique subset count, each competitor's barycentric weights, its constant drift offset and the same fixed reference member. It separately checks that the returned zero-sum weights strictly separate every vertex response on the tape. It uses only substitution and counting. The replay API supplies referenceAdversary().pulse(command,repeats) and collision() to reconstruct both physical worlds, including after arbitrarily many repeats from a covered subset.

subsetLimit counts distinct subset classifications, including the initial full-menu test. The source catalog's designWork bounds the shared halfspace computation, and receiverWork bounds physical receiving across all families. An incomplete search reports the reason, number of subsets examined, and the largest completely aliased cardinality. It reports a full-menu upper bound only if the full test actually produced a separator. An exhausted receiver retains the measurements and records an inconclusive outcome.

## The triangle now closes at four

At zero noise the earlier binary minimax comparison gave bounds of two to four on the triangle. The four three-command subsets here have actual competing mixtures (0,0,1), (0,1,0), (1,0,0) and (1/3,1/3,1/3) in source order. The last is strictly interior to the triangle. Four single pulses, one per command, separate every mixture. The source substitution verifier therefore certifies four as the exact minimum.

## Hitting Set is a special case

Take a finite nonempty ground set and a nonempty list of nonempty hyperedges. Add one reference command and one ordinary command per element. The point law has all rates zero. The competitor has one row per hyperedge, equal to its binary incidence vector on ordinary commands and zero on the reference command. Include one additional row that is one on every ordinary command and zero on the reference command.

Without the reference command the all-ones row matches the point up to constant drift. Once the reference command is present, any matching offset must be zero. Since all rates and mixture weights are nonnegative, a mixture can be zero on every selected ordinary command exactly when a supported row is zero on all those commands. Thus a separating tape must include the reference and hit every hyperedge. Conversely the reference plus any hitting set separates. For this polynomial-size binary family, the global adaptive minimum is exactly one plus the minimum hitting-set size. Computing it is NP-hard even with zero noise and a single reference vertex. The bounded solver reports unfinished cases explicitly.
