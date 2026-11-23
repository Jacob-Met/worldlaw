# Six pulses after ref/ref

The exact first-failure radius for this grouped eight-command catalog and initial **ref, ref** is **1/20**. Every smaller error bound permits guaranteed identification in six pulses. At equality a causal observation tree defeats all 4,096 continuations after that initial pair. The earlier four-word exhibit reached 3/76. The increase is 1/95 in absolute radius and 26⅔% relative. The [global five-pulse certificate](position-drift-five-pulse-global.md) puts the **minimum at six pulses throughout [1/29, 1/20)**. The other 63 initial pairs at six pulses remain unclassified at equality.

## Run the two-word policy

1. Apply **ref, ref, group**, recording the initial position and one more position after each command.
2. Supply those four measured positions to the physical receiver. Its feasible persistent-state regions select either **y0, x0, z0** or **z1, x1, y1**.
3. Apply the selected three commands and supply all seven measured positions. For consistent data below the threshold, one family remains. Each law uses one mixture, one initial position and one drift for the entire tape.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-six-ref-ref.json --physical-feedback-tree --output policy-proof.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-six-ref-ref.json --physical-feedback-tree --replay policy-proof.json --readings positions.json
```

The supplied policy's error bound is 1/29. Tests change the bound to 1/20 − 10⁻⁸⁰, run both continuations with errors of exactly that magnitude, and recover the correct family for every source vertex. At 1/20 both branches admit the normalized readings 0, 0, −1/10, 3/10. On the first branch the remaining readings can be 2/5, 1/2, 2/5. On the second they can be 3/20, 2/5, 2/5. Each branch admits physical worlds from both families. The portable complete certificate additionally supplies collisions for every other feedback choice following ref/ref.

## Source bounds and extraction

The registered course allowed one CPU, one initial pair, 32 master rounds, separator depth five, 512 terminal blocks, and at most eight words per block. The existing finite-tree proof supplies a lower starting point. After independently checking it against its source, the solver maps each positive lower atom by its complete command word and within-word row number into the larger menu. Each target block rebuilds its own raw physical rows. Their weighted sum must cancel every private coordinate. Dividing by the positive noise coefficient then gives a valid cut of the target master. In this case the two cuts recover 3/76 on round one.

For the initial upper bound, take fixed mixtures A = (1/6, 1/3, 1/6, 1/3) and B = (1/2, 1/6, 1/6, 1/6). Their rate difference is zero on ref and 1/6 on the other seven commands. For any word of length n and command-wise rate-difference range Δ, subtract the terminal chord from the cumulative rate difference. Between ticks k apart the resulting difference in chord residual is at most k(n−k)Δ/n in either direction: the k steps inside the interval have coefficient (n−k)/n and all other steps have coefficient −k/n. Center the entire residual range, then give the two laws equal and opposite affine corrections. Each law lies within Δ floor(n²/4)/(4n) of the cumulative midpoint observation. The midpoint at each tick depends only on commands already given. A single affine transformation normalizes the first two readings to zero. This yields the independently realizable initial upper bound 1/16.

At round 14, the master lower and a completed pass through every block agreed at 1/20. The exported positive dual uses seven original rows on each of just two words; all other raw rows have zero weight. Their terms sum to −ε ≤ −1/20 with every state and reading coordinate cancelled. Keeping these two words suffices for the lower. The complete upper witness retains both physical worlds for every one of the 4,096 words plus shared readings keyed by their full ancestral history. The standard-library receiver checks both claims directly and reconstructs the sparse policy. The JavaScript receiver separately solves the two-word experiment, recovers 1/20, and replays actual histories.

## Measured work

| Phase | LP solves | Cumulative LP rows | Other checks |
| --- | ---: | ---: | --- |
| Design | 1,149 (14 master, 1,135 physical) | 330,206 | 386 of 512 blocks admitted constant-vertex controls |
| Export | 349 physical | 100,512 | 163 blocks exported analytically |
| Independent raw replay | 0 | — | 512 blocks, 4,096 terminal pairs, 8,192 persistent worlds |

Physical LPs had at most 288 raw rows and eight terminal words. The largest master had 336 cuts and no terminal worlds. A direct matrix for this fixed prefix would contain 147,456 original rows. Cumulative design rows were 2.24 times that size. No direct six-pulse LP or other initial pair was run. Design, export and two streaming verification passes took 8.77 seconds together on the original worker. The saved JSONL is 319,486 bytes.

```sh
python3 scripts/verify-factored-feedback.py examples/active-position-drift-six-pulse-tree.json examples/factored-feedback-six-ref-ref.jsonl --complete --prefix '["ref","ref"]' --horizon 6 --export-policy extracted.json
python3 scripts/design-factored-feedback.py examples/active-position-drift-six-pulse-tree.json --complete --prefix '["ref","ref"]' --horizon 6 --split 5 --rounds 32 --block-limit 512 --word-limit 8 --seed-proof examples/factored-feedback-six.jsonl --upper-mixtures '[["1/6","1/3","1/6","1/3"],["1/2","1/6","1/6","1/6"]]' --output new-certificate.jsonl
```

The first command needs only Python's standard library. The second uses SciPy to propose LP solutions and exact rational arithmetic to accept them. A fixed work limit can leave distinct lower and upper bounds: the portable certificate replays them independently.
