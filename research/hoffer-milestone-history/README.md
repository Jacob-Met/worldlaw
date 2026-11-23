# Does earlier recorded extension improve midpoint-to-passage forecasts?

The Hoffer, Neupane and Woodside equilibrium optical-tweezer release contains short, selected successful transitions. We trained nine first-passage probability forecasts on time-reversed unfolding columns and scored the locked forecasts on forward folding columns. Earlier history improved the two comparisons against shuffled history. It lost both comparisons against predictors that used the issued coordinate and clock, optionally with recent displacement. **Two of four registered criteria passed; the joint criterion failed.** The result concerns recorded bead extension in this archive. It cannot determine whether the underlying molecular dynamics are scalar Markov.

## Issuance and comparison

We matched the source's construct, cadence and exact pair of recorded extension boundaries. Within each 301-sample column we calculated `q=(x−lower)/(upper−lower)` using the stored field order. We issued a forecast on the first sampled crossing of 0.5 after a visit to 0.2 or below. If the crossing had not occurred by the last sample permitting 128 µs of follow-up, we issued there. All 175 scoreable timeouts across the three constructs and handles control count. The endpoint was a recorded value of at least 0.8 by 2, 4, 8, 16, 32, 64 or 128 µs after issuance, including the issue sample.

Each predictor used only reversed unfolding donors in the matched stratum. `state` used the attained coordinate, issue clock and two boundary flags. `recent` added the recent 8 µs displacement. `history64` added elapsed time since the last source-side visit and current displacement relative to the preceding 32 µs window. The shuffled control moved the two earlier-history features together within coarse donor cells of the issued state and recent displacement. Neighbors, scaling, ties, grouping, horizons and the nine-arm roster were frozen before held suffix decoding. Forecast construction authenticated and grouped raw file bytes, including repeated headers/blocks. Its numeric coordinate accessor only decoded held values through the case's issue sample.

Mean squared probability errors used all seven horizons. We averaged within each observed stratum, then equally across strata within each construct. The primary mean and maximum treat the three constructs as three groups. The handles-only record remains a separate control. The original paper examined mean transition-path shapes, transit dynamics and pauses. Its direction-averaged curves do not provide individual seven-horizon forecasts under these inputs. The archive's separate simulations were outside the matched physical-record comparison.

| Forecast | Mean Brier | Worst construct |
|---|---:|---:|
| prior | 0.195317 | 0.202605 |
| state16 | 0.107841 | 0.135263 |
| state64 | 0.111244 | 0.132528 |
| state256 | 0.126901 | 0.137918 |
| recent16 | 0.111539 | 0.136530 |
| recent64 | 0.115125 | 0.133895 |
| recent256 | 0.130905 | 0.139763 |
| history64 | 0.120589 | 0.136498 |
| shuffled64 | 0.121255 | 0.137695 |

Each hairpin separately had a lower observed mean loss with state16 than history64. The handles-only means were 0.126830 and 0.145187 respectively. Common metadata and neighboring columns do not establish independent molecules or prospective physical instrument latency. Acquisition filters, finite sampling, successful-event selection, construct differences and finite donor counts limit biological interpretation. This comparison of fixed predictors cannot establish the optimal conditional risks.

## What the release permits us to count

We authenticated the 780,782,293-byte original ZIP, its 723 members, eight extensionless metadata tables and all physical member headers. We found a missing 30R50T4 folding member `_0` (620 declared) and a one-byte member `_145` (one declared) without a column header. We counted exact duplicate same-stratum, same-direction blocks once. The donor audit found eight repeated 20R0T4 blocks and one repeated handles block. Direct parsing gave 260,278 donor columns, 260,266 usable. The forecast bank retained all 260,018 present unique held columns, six with insufficient observations. The independent receiver scored 260,012, including 6,112 handles-only. Counts per construct and all stratum sums are in `outcome.json`.

| Construct | Scoreable columns | Conditional unknown | Scoreable / declared strata |
|---|---:|---:|---:|
| Hairpin 20R0T4 transitions | 75369 | 1 | 23 / 23 |
| Hairpin 20R100T4 transitions | 30820 | 2 | 15 / 15 |
| Hairpin 30R50T4 transitions | 147711 | 624 | 145 / 146 |
| Handles only transitions | 6112 | 0 | 8 / 8 |

Under the authors' counts for the two unavailable tables, 627 held outcomes are unknown. Bounding every paired difference in [−1,1] yields a mean history64 minus state16 difference of +0.010400 to +0.015011. The analogous shuffle difference ranges from −0.002971 to +0.001640. These are deterministic sensitivity bounds, without assignment of individual missing physical events. The primary four criteria use the observed stratum means as registered.

## A raw failure and a mathematical control

The largest individual history64 error was 0.870989 for 30R50T4 folding member 73, block 0, column 848, at 1 µs/sample. At sample 18 the recorded coordinate was 0.513722. It reached 0.927334 at sample 19. All seven events were true. History64 predicted zero through 16 µs and then 0.03125, 0.046875 and 0.5. State16 also missed the immediate crossing. The independent receipt includes the full 301-sample coordinate trace, the issued prefix and all nine forecasts. A second worker obtained the source independently, received the original forecast banks, and recounted 16,380,756 squared errors across 192 strata. Its largest difference in any stratum sum was zero.

In an ideal reversible five-site continuous-time chain, two hidden rate lanes can switch at either end. Each reactive path selects a lane with probability one half. For the conditioned 1→2 and 2→4 passages the lane-specific mean durations are (1/2,1/4) and (2,1). Their covariance is exactly 1/16. Thus reversibility can coexist with prefix information at the middle site. The construction is synthetic. It supplies a logical example and carries no fitted kinetic or molecular interpretation.

## Replay

Use Python with NumPy 2.2.6 and SciPy 1.15.3. The command authenticates a cached source ZIP or downloads the public v1 file if absent. Supply a new scratch directory. It rebuilds donors, issues forecasts before scoring, runs a separate raw line parser, checks every stratum and reproduces the conditional missing-case bounds. It reports the reconstructed bank's byte identity separately from numerical agreement.

```sh
python3 research/hoffer-milestone-history/replay.py --archive /tmp/TransitionPathData.zip --scratch /tmp/hoffer-replay
```

The primary [article](https://doi.org/10.1073/pnas.2101006118) and [original dataset](https://doi.org/10.6084/m9.figshare.14897091.v1) identify the acquisition. `forecast-lock.json` records the pre-outcome source and original transport hashes. The original retained archive and independent response receipt remain distinct from a replay.
