# Three adaptive pulses with an unknown position and drift

A run starts with one unknown pair of real numbers, position p and drift v. Each pulse advances the position by v + g(u) and leaves v unchanged. Each tick yields a position reading with arbitrary additive error in the closed interval [−1,1]. There is one initial reading and one reading after each command. The four registered laws have these increments.

| Law | off | 0 | 1 | 2 |
| --- | ---: | ---: | ---: | ---: |
| A | 0 | 0 | 0 | 0 |
| B | 0 | 16 | 0 | 0 |
| C | 0 | 16 | 16 | 0 |
| D | 0 | 16 | 16 | 16 |

Both position and drift are unbounded initially. The first two noiseless observations have independent initial-state rows (1,0) and (1,1). Across the run, each law must explain every reading using one pair (p,v).

## What three pulses can distinguish

Every fixed schedule of three pulses confuses at least two laws. If every pulse is on, A from (0,0) and D from (0,−16) both read zero at all ticks. If a pulse is off, some on-command is missing. The adjacent laws that differ only on that command agree on the entire schedule from the same origin. The executable collision generator supplies both starting states for each of the 64 tapes.

An adaptive policy uses the same three pulses and four readings. It begins with off and then sends 1. The second difference y₂−2y₁+y₀ lies within 4 of g(1), since it cancels p and v and the absolute noise weights sum to 4. The resulting intervals [−4,4] and [12,20] are disjoint, including their endpoints. On the lower branch the surviving laws are A and B, so the final command is 0. On the upper branch C and D survive, so the final command is 2. The contrast y₃−y₂−y₁+y₀ lies within 4 of this last command's increment. Its two possible increments, 0 and 16, distinguish the surviving pair. These inequalities cover every admissible real initial state and every bounded noise sequence.

Two adaptive pulses are insufficient. Feed a prospective policy the common initial readings (0,0). Each law can generate them by choosing p=0 and v=−g(first command). The second command is now fixed by this shared history. For any such pair of commands, there are two laws with equal g(second)−g(first). On an on-only pair these can be A and D. If off occurs, choose adjacent laws that differ only on a missing on-command. Both laws therefore give the same third reading.

## Replay from measurements

For each law, subtract cumulative commanded forcing from each reading to form zₜ. The entire feasible state set is the intersection of the closed strips zₜ−1 ≤ p+t·v ≤ zₜ+1. Each earlier/later pair i<j restricts v to [(zⱼ−zᵢ−2)/(j−i), (zⱼ−zᵢ+2)/(j−i)]. Their intersection is exact. At a candidate drift every lower bound on p must be below every upper bound. Comparing those bounds gives precisely the listed inequalities in v. A compatible p is then any member of the common intercept interval.

The receiver saves the strips as well as the exact drift projection and one jointly feasible initial pair for each surviving law. The next action derives from the survivors. An impossible prefix terminates the experiment. In particular, during coasting, [0,0,4] and [0,4,8] each have a feasible origin. Combining them into [0,0,4,8] produces an empty intersection. A reset between windows would lose that evidence.

From a Worldlaw checkout, import `observePositionDrift` and `replayPositionDrift` from `src/science/persistent-position-drift.mjs`. For example, `observePositionDrift([0,0,16,32])` returns the commands off, 1, 2 and identifies D. `replayPositionDrift` rebuilds each round from the saved rational readings and checks the saved commands and full state regions. The record checks internal consistency. It does not authenticate a physical measurement.

Run `node --test tests/persistent-position-drift.test.mjs` to reproduce the fixed-tape collisions, adaptive and boundary checks, raw simulation from saved state witnesses, independent polygon-vertex checks, and replay corruption checks. The result applies to the four registered laws, command menu, persistent dynamics and noise budget above.
