# Seven adaptive pulses first collide at 1/16

The [paired-suffix controller](paired-suffix-calibration.md) with three references identifies the two registered rate families for every ε<1/16. At ε=1/16 the receiver below produces one transcript compatible with both families for **every adaptive seven-command policy**. This closes the previous interval [1/16,1/14] at its lower end. Together with the six- and eight-pulse certificates this gives minimum seven throughout [1/20,1/16) and minimum eight throughout [1/16,1/14).

## Only the final reading needs to change

Use source A masses (1,2,1,2)/6 and B masses (2,1,2,1)/6. Their rates differ by 1/6 on the six suffix commands and zero on the two baseline commands. Starting at zero, return their cumulative mean μ through tick six, regardless of the commands received. Every such prefix is feasible: the worst balanced affine-fit error at six ticks is at most floor(6²/4)/(24·6)=1/16. No ordered early state or adaptive change to an earlier reading is required.

At tick seven, 124 of the 128 binary baseline/suffix patterns still admit the ordinary mean. The four exceptional patterns are B³S⁴, B⁴S³ and their reversals. They have 27,648 literal command words in 1,568 two-block multiset classes. Each class stores one pair of original physical worlds whose mixture, origin and drift are constant across the whole tape. All past positions fit the already displayed μ within 1/16 under both laws and every permutation within each block. The terminal positions depend on the complete command counts and differ by at most 1/8, so return their midpoint. The command at tick seven has already been committed. This choice cannot change a command or reading at an earlier tick.

The receiver checks all four masses directly from the original vertices; the stored fourth mass is reconstructed by subtraction. It verifies the actual extrema over within-block permutations: at each partial count j, the j smallest increments yield the minimum and the j largest the maximum. A separate test expands all 27,648 exceptional words in literal order using integer-scaled arithmetic and checks the two original position trajectories at all eight times. The 1,548 distinct stored pairs plus the ordinary classes cover all 8⁷=2,097,152 words. The closed obstruction and the strict lower policy establish the radius without inference from numerical optimization.

A stationary virtual rate table cannot attain the seven-pulse upper at 1/16, even if physical worlds depend on a complete ordered tape. Applying the [seven stationary-tape inequalities](eight-pulse-causal-obstruction.md) with three references and four suffixes rescales each rate-unit noise allowance by 7/6. Their sum gives 1≤14ε. The balanced table attains 1/14. The final reading adjustment is the part that improves this bound.

```sh
python3 scripts/verify-seven-pulse-causal-obstruction.py examples/active-position-drift-seven-pulse-upper.json examples/seven-pulse-causal-obstruction.json
python3 scripts/verify-seven-pulse-causal-obstruction.py examples/active-position-drift-seven-pulse-upper.json examples/seven-pulse-causal-obstruction.json --commands ref ref ref x1 x0 y0 y1
```

## Exact minimum for the registered catalog

Each upper endpoint is the first noise at which **every** policy of that row's horizon can collide. The adjacent row supplies a policy that succeeds strictly below its own endpoint. All intervals include their left endpoint.

| Minimum adaptive pulses | Noise interval | Certificate |
|---:|---|---|
| 4 | [0, 1/40) | [Four-pulse prior and policy](position-drift-four-pulse-radius.md) |
| 5 | [1/40, 1/29) | [Five-pulse global](position-drift-five-pulse-global.md) |
| 6 | [1/29, 1/20) | [Six-pulse global](six-pulse-global.md) |
| 7 | [1/20, 1/16) | This obstruction and the [paired-suffix controller](paired-suffix-calibration.md) |
| 8 | [1/16, 1/14) | [Eight-pulse global](eight-pulse-causal-obstruction.md) |
| 9 | [1/14, 1/12) | [Nine-pulse global](nine-pulse-causal-obstruction.md) |
| 10 | [1/12, 1/10) | [Ten-pulse global](ten-pulse-terminal-adversary.md) |
| 11 | [1/10, 5/44) | [Matching fixed and adaptive bounds](ten-pulse-terminal-adversary.md) |
| 12 | [5/44, 1/8) | [Matching fixed and adaptive bounds](ten-pulse-terminal-adversary.md) |
| 13 | [1/8, 7/52) | [Matching fixed and adaptive bounds](ten-pulse-terminal-adversary.md) |
| 14 | [7/52, 1/7) | [Near-balanced even horizons](even-near-balanced-adaptive-optimum.md) |
| 15 | [1/7, 3/20) | [Fifteen-pulse early obstruction](fifteen-pulse-early-obstruction.md) |

At ε=3/20 the minimum is sixteen. The [even-horizon theorem](even-near-balanced-adaptive-optimum.md) extends the known higher-horizon equality to H congruent to 2 or 10 modulo 12.
