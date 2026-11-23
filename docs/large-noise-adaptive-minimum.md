# Minimum adaptive pulses at a requested noise of at least 11/16

For the registered eight-command catalog, give the receiver the noise budget directly. It returns the minimum number of pulses, a fixed course that succeeds at that budget, and a physical obstruction for the preceding horizon. The report and measurements use exact rational strings.

For H≥67 the [all-horizon theorem](all-large-horizon-adaptive-optimum.md) identifies the unrestricted adaptive radius as the best fixed dwell radius. For dwell k, success requires k(H−6k)>4Hε, or k>4ε and H>6k²/(k−4ε). This implies H>6k automatically. The rational function 6k²/(k−4ε) decreases up to 8ε and increases afterwards: its derivative has the sign of k−8ε. Only the floor and ceiling of 8ε can minimize it on integer k>4ε. Apply floor+1 to each feasible value before selecting the smaller horizon. This strict step matters exactly at a preceding radius. Dwell ties are allowed; the existing fixed course supplies its own optimal allocation at the chosen horizon.

At 66 pulses, the two balanced source mixtures with a nominal cumulative-mean display have worst-case radius floor(66²/4)/(24·66)=11/16. Every shorter attempt can be padded to 66. Thus when ε≥11/16 the two-candidate solution on the certified horizons is the unrestricted adaptive minimum. For H−1≥67 the predecessor uses the complete terminal-transfer obstruction. At H−1=66 it uses the balanced bound; no exact radius at 66 is required. At ε=11/16 the answer is 67, with preceding bound 11/16 and separating radius 93/134. At ε=93/134 the answer moves to 68.

## Plan, measure and reopen

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-large-noise-minimum.json --large-noise-minimum --output /tmp/minimum.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-large-noise-minimum.json --large-noise-minimum --replay /tmp/minimum.json --readings positions.json
```

Supply the consecutive positions at the three declared checkpoints, beginning with the initial position. The receiver returns the next runs, next checkpoint and current surviving laws. For example at ε=11/16 the selected course has 31 references followed by six dwells of length 6, and positions ["0","0","6"] select A. ["0","0","0"] selects B. A record differing from the regenerated minimum, candidate table, predecessor or course fails replay.

To inspect an adversarial prefix at the preceding horizon, write the report's predecessor.source to a JSON file, then pass it to the run-length receiver with the received commands. Add --balanced-bound when predecessor.method is balanced-midpoint.

```sh
python3 scripts/near-balanced-even-obstruction.py predecessor.json --balanced-bound --runs received-runs.json
```

The lower bound and the fixed separating design are proved for the registered physical source and for the documented noise range. Noise below 11/16 remains covered by the separate horizon-specific results.
