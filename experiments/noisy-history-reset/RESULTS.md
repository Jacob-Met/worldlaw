# A paired-reset test of hidden memory

Two preparations can end at the same visible state and still leave a different hidden coordinate or delayed history. In this experiment the simulator imposes the same visible reset and then applies the same forcing to both preparations. If the resulting sensor intervals are disjoint at any common time and channel, a deterministic law of the visible state alone cannot fit both recordings. Intersecting intervals leave that question open. A measurement on a real system would also need to bound mismatches in the imposed reset, timing and forcing.

The original registration used a spatial preparation that became nonfinite for Fisher–KPP. Its incomplete archive is retained under run 45297451145. Before inspecting partial case scores, the successor registered two fresh coefficient/initial-state seeds and a bounded spatial preparation. All 22 families, both hidden-dynamics controls, and all three noise levels (15, 25 and 40 dB) entered the calculation.

| Original decision | Closest two contenders | Four-model committee | Equal-power random | Passive constrained differential fit |
| --- | ---: | ---: | ---: | ---: |
| Correct / 132 in-roster | 128 | 128 | 129 | 125 |
| Wrong in-roster admissions | 0 | 0 | 0 | 6 |
| In-roster abstentions | 4 | 4 | 3 | 1 |
| Hidden controls admitted before paired reset / 12 | 2 | 2 | 3 | 2 |
| Hidden controls admitted after paired reset / 12 | 0 | 0 | 0 | 0 |
| Replanned time-shuffle admissions / 144 | 0 | 0 | 0 | 0 |

The auxiliary reset pair yielded a separating observation in 11 of 12 hidden controls and zero of 132 in-roster cases. Both delay seeds at 15 dB separated. The remaining ambiguous pair was hidden-Z Lorenz at 15 dB for seed 831319. The ordinary forecast gate already refused it. Every arm received the same extra two preparations and recordings. The sensor bounds come from a calibrated synthetic instrument, and the visible-state reset is exact in this simulation.

The registered acquisition gate failed. A subsequent census enumerated every available drive while fixing the estimator, pilot, verification recording and noise stream. Each of the three active/random arms' 144 saved fits matched its corresponding recomputed drive, giving 432 exact original joins.

| Number of drives producing the correct admitted family | Cells / 132 |
| --- | ---: |
| All eight | 128 |
| Six | 1 |
| Zero | 3 |

The single drive-sensitive case was KdV, seed 492983 at 40 dB. Drives 1, 2, 3, 5, 6 and 7 recovered it. The contender selected 4 and the actual random control selected 6. No offered drive recovered quartic spring or Morse at seed 492983 and 25 dB, or Lotka–Volterra at seed 831319 and 40 dB. The best possible selector on these exact measurements therefore scores **129/132**, which the random control already reached. An independent uniform drive per cell would score 128 with probability 1/4 or 129 with probability 3/4, for a mean of 128.75. This is a retrospective finite-menu bound with common simulated noise. Alternative excitations, estimators and future worlds lie outside the calculation.

The passive arm selects two-coefficient templates by smoothed differential regression. Free-support SINDy and laboratory transfer remain separate comparisons.

## Reproduction

With Node 24.22.3, run from the repository root:

```sh
node --test tests/reset-history-intervals.test.mjs tests/noisy-field-intervention.test.mjs
node scripts/noisy-history-reset.mjs history-output
node scripts/receive-noisy-history-reset.mjs history-output
node scripts/noisy-history-drive-census.mjs history-output/report.json drive-census.json
```

The original complete report SHA-256 is `cf21e2fa364f8b0c9590005c8ab469d0cdb77d0fb61f672082d625365f618ad3`. The first complete archive contains both raw bounded readings for every cell. The independent receiver recounts their interval gaps and all four arm decisions. The retrospective receiver checks the original report hash and full fitted records before counting alternative drives.

- [Original 144-cell run and raw recordings](https://github.com/Jacob-Met/worldlaw/actions/runs/45297719173)
- [Original eight-drive census and independent intake](https://github.com/Jacob-Met/worldlaw/actions/runs/45298118627)
- [Registration and first incomplete spatial preparation](https://github.com/Jacob-Met/worldlaw/actions/runs/45297451145)
