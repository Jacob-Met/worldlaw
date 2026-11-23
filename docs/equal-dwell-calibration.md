# Equal dwell and the fixed pulse budget

In the grouped two-family rate catalog, use **m** reference commands, then **k** group commands. Choose one of the two suffixes in the table below and repeat each of its three commands **k** times. For integers **k ≥ 1, m ≥ 2k**, this program's exact first collision occurs at

    R(m,k) = mk / [10(m+2k)].

For the example's noise **ε = 1/10**, thirteen is the first pulse budget that guarantees a decision **in this equal-dwell class**. Twelve reaches the closed collision at 1/10. Thirteen selects five references and dwell two, and reaches 1/9. Other suffixes, different per-command dwell times and unrestricted policies remain open.

## Choosing the suffix from real readings

Record the six positions at ticks 0, m, m+k, m+2k, m+3k and H=m+4k. Define

    S = kY₀ − (m+k)Yₘ + mYₘ₊ₖ
    T = 4kY₀ − (m+4k)Yₘ + mYᴴ

where Yᴴ is the final position. Both contrasts cancel the unknown starting position and constant drift. The source verifier checks the terminal identities at every vertex. Write g for the group rate. For family A, g plus the sum of the first suffix's rates equals one, and the second suffix's sum equals g. For family B both suffix sums vanish. Both families have zero reference rate. Linearity gives the same identities for each fixed convex mixture of vertices.

| Suffix | Required for both families to fit its full measured history |
| --- | --- |
| y0, x0, z0 | S ≥ mk − (4m+14k)ε |
| z1, x1, y1 | S ≤ (6m+6k)ε |

On the first suffix, A satisfies |T−mk| ≤ (2m+8k)ε. On either suffix B satisfies |T−S| ≤ (2m+6k)ε. On the second suffix A satisfies |T−2S| ≤ 4mε, since m ≥ 2k. Each bound uses the sum of absolute coefficients on the *same* original readings. Combining the inequalities gives the table. Their thresholds have positive gap mk−(10m+20k)ε exactly below R. Choose the first suffix when S < mk/2+(m−4k)ε, and the second at equality or above. Only the three shared readings enter this choice. At the budget of 13 and ε=1/10 the measured cutoff is 47/10.

## Physical boundary at every original tick

Let D=10(m+2k), q=1/D and e=mkq. Weights are given in the anchor order used by the [unit-dwell proof](reference-calibration-family.md). Each row sums to D and is nonnegative. Divide each weight numerator by D.

| Suffix and family | Four numerators | Start | Drift |
| --- | --- | ---: | ---: |
| First, A | 0, 2m+12k, 0, 8m+8k | e | −4kq |
| First, B | 4m+12k, 4k, 0, 6m+4k | −e | 0 |
| Second, A | 6m+14k, 0, 4m+2k, 4k | e | −2kq |
| Second, B | 4m+16k, 0, 6m+2k, 2k | −e | 0 |

All four histories share observations 0, −2mkq and k(4m+4k)q at the first three checkpoints. On the reference block use the line −2kqt; interpolate the group readings linearly between their shared endpoints. Direct substitution into the rate equations gives the clean A-minus-B gaps from the group endpoint through the three suffix endpoints:

    first   kq · (  0, −4k,  2m, 2m )
    second  kq · (−2m, −2m, −2m, 2m ).

All four clean shared endpoints lie in the indicated radius-e tubes. Each private suffix uses the midpoint of its two clean world positions at each subsequent checkpoint. The absolute gaps are at most 2e. Both the measured history and each clean persistent world are affine on each command run, so every intermediate pulse also satisfies the closed bound. This constructs one shared past for either future choice and works even when every reading is available. The guarantee below R uses only the six designated readings.

## Selecting an integer allocation

At fixed k the radius increases strictly with m and approaches k/10. For ε < k/10, the smallest eligible reference count is max(2k, floor(20kε/(k−10ε))+1). When ε ≥ k/10 no finite reference count suffices at that k.

For a budget H ≥ 6, the best schedule uses all H pulses, and 1 ≤ k ≤ floor(H/6). Substituting m=H−4k gives f(k)=k(H−4k)/[10(H−2k)]. Its derivative has the sign of H²−8Hk+8k². The continuous maximum has k/H=(2−√2)/4 and radius/H=(3−2√2)/20. This positive limiting slope allows arbitrarily high noise as the available budget grows.

The integer maximum is among the two integers bracketing that unique peak, clipped to the feasible interval. With u=floor(√(2H²)), the lower integer is floor((2H−u−1)/4), since √2·H is irrational. The implementation compares the two radii as exact rationals and reports all ties. At H=24, (m,k)=(12,3) and (8,4) both reach 1/5. The smaller dwell is the operational default. Independently, the portable verifier finds the maximizers from the sign of the forward difference, H²−(8k+4)H+8k(k+1). At most two radius comparisons and six checkpoints are needed even for a 501-digit H. Integer-square-root and rational arithmetic costs grow with input bit length.

## Replay

Use `worldlaw.position-drift-dwell-calibration/v1` with either a `pulseBudget` or both `references` and `dwell`. The earlier reference-only schema keeps its original proof format. For a different noise bound, edit the source and generate its corresponding proof.

```sh
node scripts/active-linear-family.mjs --reference-calibration --input examples/active-position-drift-dwell-calibration.json --output /tmp/dwell-proof.json
python3 scripts/verify-reference-calibration.py examples/active-position-drift-dwell-calibration.json /tmp/dwell-proof.json --pulse-tick 8
printf '["0","0","47/50"]\n' >/tmp/dwell-readings.json
node scripts/active-linear-family.mjs --reference-calibration --input examples/active-position-drift-dwell-calibration.json --replay /tmp/dwell-proof.json --readings /tmp/dwell-readings.json
```

The [positive-reference extension](all-reference-dwell-calibration.md) covers all m ≥ 1, including the changed eleven-pulse optimum.
