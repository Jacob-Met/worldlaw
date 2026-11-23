# Seven pulses at the six-pulse noise boundary

Exactly **seven pulses** are necessary and sufficient on **1/20 ≤ ε < 3/50** for the grouped eight-command catalog. The [unrestricted six-pulse certificate](six-pulse-global.md) supplies the lower bound. Adding a third initial reference to the two-word six-pulse policy supplies the upper bound. At ε=3/50 this particular program has a physical collision. The unrestricted seven-pulse threshold remains in [3/50, 1/14]. The upper endpoint follows from the same universal fixed mixtures with rate-gap spread 1/6 and horizon seven, giving (1/6)·floor(49/4)/(4·7) = 1/14.

## Run the experiment

Apply **ref, ref, ref, group**. Let Y₀ be the initial measured position, Y₃ the position after the third reference, and Y₄ the position after group. At ε=1/20 compute

```text
S = Y₀ − 4Y₃ + 3Y₄
```

If S < 29/20, apply **y0, x0, z0**. Otherwise apply **z1, x1, y1**. Supply all eight readings to the persistent-family receiver for the executed word. For any ε below 3/50 the same rule works with cutoff 3/2 − ε. The physical CLI’s optional `--two-word-rule` evaluates the two collision inequalities from the verified certificate and chooses the larger violation. At equal violations it chooses the second word. This implements the displayed cutoff directly. The existing full-history search can also select a safe continuation when both work.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-seven-pulse-calibration.json --physical-feedback-tree --output seven.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-seven-pulse-calibration.json --physical-feedback-tree --replay seven.json --readings positions.json --two-word-rule
```

With five readings `["0","0","0","0","0"]`, the CLI selects y0. Completing the observations with `"1","1","1"` identifies A. With five readings `["0","0","0","0","1"]`, it selects z1. Completing with `"0","1","1"` identifies B. Both examples run at the previous global failure boundary ε=1/20. The tests exercise the explicit cutoff at equality, large unknown origins, negative drift, and errors at the allowed endpoints.

## Why the measured rule separates

The reference rate is identically zero in both families. Before the group pulse the initial and third-reference readings restrict the constant drift to the interval (Y₃−Y₀ ± 2ε)/3. In the absence of measurement error, S is three times the group's rate for this fixed mixture. The coefficient sums cancel both the unknown origin and drift, including after arbitrary affine changes of the entire trace.

The source rates also give a direct derivation. Define T = 4Y₀ − 7Y₃ + 3Y₇. On the first continuation, A's group displacement plus its three remaining displacements is exactly one. The terminal reading must satisfy |T − 3| ≤ 14ε. On either continuation, B's three suffix displacements sum to zero, giving |T − S| ≤ 12ε. If both families survive the first continuation, subtracting these bounds gives S ≥ 3 − 26ε. On the second continuation, A's three suffix displacements sum to its group displacement, so |T − 2S| ≤ 12ε. Combining that bound with B's gives S ≤ 24ε. The error coefficients 14, 12 and 12 are the sums of absolute coefficients of the corresponding measured positions. T is used for this proof and can be evaluated after the final pulse. The branch choice at tick four uses only S.

The exact lower certificate has 15 positive original-row weights. Multiply each by 50 and sum separately on the two terminal words. All private initial states, mixture weights, and later readings cancel. The remaining necessary conditions for a collision are

| Continuation | Necessary condition for both families to survive |
| --- | --- |
| y0, x0, z0 | S ≥ 3 − 26ε |
| z1, x1, y1 | S ≤ 24ε |

In normalized coordinates the first left-hand side is 4Y′₃ − 3Y′₄ − 26ε, bounded above by −3. The second is −4Y′₃ + 3Y′₄ − 24ε, bounded above by zero. Undoing the affine normalization gives the measured S above. At ε=1/20 the collision conditions are S ≥ 17/10 and S ≤ 6/5 respectively. The cutoff 29/20 lies strictly between them. More generally, their midpoint is 3/2 − ε and their gap is 3 − 50ε. This gives a causal decision before observing any reading on the chosen continuation.

At ε=3/50 the conditions touch at S=36/25. The portable certificate supplies the shared prefix readings (0, 0, −1/25, −3/25, 8/25). The remaining observations can be (8/25, 16/25, 11/25) on the first continuation or (4/25, 11/25, 11/25) on the second. Each word admits an A world and a B world with one constant mixture, origin, and drift throughout. The upper certificate checks the original two-sided position bounds at every tick.

```sh
python3 scripts/verify-factored-feedback.py examples/active-position-drift-seven-pulse-calibration.json examples/factored-feedback-seven-calibration.jsonl
```

## All single-reference placements on the two original words

There are seven insertion slots per original word. Inserting before, between, or immediately after its two initial references gives the same command sequence. Each leaf therefore has five distinct choices, denoted below by the number of original commands before the new reference. Rows refer to the word ending y0, x0, z0. Columns refer to the word ending z1, x1, y1. Each pair uses the full shared prefix of the resulting words, so a different placement on the two leaves can move the feedback decision.

| First word / second word | 2 | 3 | 4 | 5 | 6 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 | **3/50** | 0 | 0 | 0 | 0 |
| 3 | 0 | 1/21 | 1/24 | 1/24 | 1/22 |
| 4 | 0 | 1/22 | 1/24 | 1/24 | 1/22 |
| 5 | 0 | 1/22 | 1/24 | 1/24 | 1/22 |
| 6 | 0 | 1/20 | 1/22 | 1/22 | 1/20 |

Only the shared early calibration separates at ε=1/20. The exact JavaScript receiver certified all 25 menus. A separate one-CPU calculation reconstructed primal and dual witnesses on the original physical inequalities and obtained every matrix entry in 0.33 seconds including the winning packet export. Each program had two terminal words.
