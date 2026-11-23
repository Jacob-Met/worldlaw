# Two measured decisions after eight reference pulses

At ε=5/32, consider a sixteen-pulse policy that begins with eight references and x0. The policy may use the initial reading and all nine pulse replies to choose its tenth command, then use the tenth reply to commit its last six commands. An adversary can keep both original position/drift laws possible at every tick. This extends the [one-decision certificate](sixteen-pulse-feedback-boundaries.md). The unrestricted H16 radius remains in [5/32,5/31].

The initial reading and all eight reference replies are zero. After x0 the adversary reports 27/128. Its tenth report depends only on the command just issued.

| Tenth command | Tenth reading |
|---|---:|
| ref | 27/128 |
| group | 91/128 |
| x0 | 27/64 |
| y0 | 43/128 |
| z0 | 11/128 |
| x1 | 59/128 |
| y1 | 43/128 |
| z1 | 11/128 |

After the controller commits six commands, the receiver chooses one pair of physical worlds from the table for the tenth command. Each world has one original vertex mixture, initial position and drift for the entire tape. The two states reproduce every earlier report within ε. In particular, both endpoints of the constant-reference segment are checked, which bounds the error at its seven intermediate ticks by linear interpolation. Later reports are the midpoint of the two positions. No choice of physical world changes a previously issued report.

For a given pair let g be its position difference after the tenth action and d(c) its full per-step difference on command c, including drift. Over all permutations of a tail with counts h(c) and all their prefixes, the smallest difference is g+Σh(c)min(0,d(c)), and the largest is g+Σh(c)max(0,d(c)). Both extrema are attained by putting the corresponding signed commands first. Containment in [−2ε,2ε] therefore checks the entire measured continuation, including repeated commands. The [packet](../examples/sixteen-pulse-second-feedback.json) has 156 pairs across the eight tenth commands. The integer [receiver](../scripts/sixteen-pulse-second-feedback.mjs) verifies their coverage on 8×1,716 histograms. The lower-dimensional searches and greedy witness selection used to find the packet are unnecessary for verification.

Run `node scripts/sixteen-pulse-second-feedback.mjs` for the ninth report. Add one command, for example `x0`, to obtain the tenth report before choosing a tail. Add all six tail commands to print the shared readings and both persistent states. Use `--verify` to check the complete cover against the published original vertices.

World choice depends on the committed tail. A policy retaining another decision among its final six actions falls outside this certificate. A different opening can also lead to a different result.
