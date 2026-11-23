# Can low-gradient calibration transfer a thermoelectric module's full current curve?

Four of eight commercial Bi₂Te₃ modules supplied the higher-gradient tests. The candidate combined a temperature-dependent terminal-voltage model with an empirically measured normalized curve shape. Its average current RMSE was **0.065802**, against **0.047807** for the most similar calibrated donor module, **0.062814** for an ordinal-indexed shape correction and **0.065691** when another test module supplied the candidate's calibration scale. The nearest-donor and ordinal controls each beat the candidate on all four devices. The joint gate failed.

## Measured inputs and acquisition order

Ider and colleagues reported measurements on eight SP-184827145 generators using a hot plate, regulated cold side, electronic load, opposing supply, voltmeter and two type-K temperature sensors. The experiment held the cold setpoint near 20 °C and varied the intended temperature difference from 10 to 90 °C. The repository contains one text file per module and nominal gradient. We froze modules 1–4 at all settings and modules 5–8 at 10 and 20 °C as calibration (44 curves, 17,712 rows). The held set contains all seven other settings on modules 5–8 (28 curves, 14,656 rows). [Public data](https://doi.org/10.17632/tfg4byhch8.1) · [Paper](https://doi.org/10.1016/j.mseb.2023.117122) · [Author thesis, chapter 4](https://repositorio.unifei.edu.br/jspui/bitstream/123456789/3428/3/Tese_2022043.pdf)

The files contain two headerless decimal-comma columns. The first coordinate increases in all 44 calibration sweeps, with median steps of 4.86–4.96 mV, consistent with the reported 5 mV applied-voltage increments. The second coordinate declines toward zero and is interpreted as current. We report errors in the released current-coordinate units. A per-file SI units declaration, load-state timestamps, thermocouple values and calorimeter readings are absent from these rows. No instrument-independent amperage calibration was verified. All calibration sweeps start at a small negative measured voltage. Negative initial coordinates and terminal rows remain in the analysis.

The instrument stopped on the observed open-circuit voltage. Handing a predictor the entire held voltage range or length would disclose an outcome. The stored functions were frozen before accessing any held file body, range or row count. The receiver then supplied each measured voltage and row ordinal separately. Every released target row was scored. The estimand is conditional current over the measured, outcome-stopped voltage grid. It does not include prospective prediction of the sweep length.

## Predictors and controls

For each calibration curve, ordinary least squares on current versus voltage yielded an effective open voltage E and resistance R. The two low-gradient curves anchored each test module's E/d and R, where d is nominal temperature difference. The structural model assumes a thermopower affine in temperature, so its integral from a fixed cold boundary has E = a·d + b·d². It also assumes a first-order change in R under a roughly linear thermal profile. Donor data fix the relative slopes. A common normalized residual to the ideal terminal law I = (E − V)/R is learned on calibration curves against V/E. This residual is an empirical correction. The calibration data show a source point departing by 0.27978 native current units from its own linear fit, giving the linear-law assumption a direct experimental stress test before the held curves.

The nearest-donor control chooses the module with the smallest distance in the two logged calibration-anchor coordinates and carries its entire normalized curve and relative E/R change at the same imposed setting. Other controls include a row-ordinal shape with the candidate's E/R, cyclically swapped calibration, literal reduced Thévenin behavior, same-setting empirical transfers, and local and pooled temperature trends. Source and target use one sweep direction, so index dependence and static load dependence are confounded. The paper reports fitting its full observed curves with self-adaptive differential evolution. Such per-curve calibration has more information than a held forecast. This course uses the printed electrical response class with explicit same-information comparators. It does not reproduce the authors' optimizer or refit it on held sweeps.

## All current results

Within each sweep, native rows have equal weight. The primary RMSE and MAE average equally over seven sweeps per test module and equally over the four modules. The last column counts how many modules favor the candidate on RMSE against each comparator.

| Role | RMSE | MAE | Signed bias | Candidate wins / 4 |
|---|---:|---:|---:|---:|
| integrated_shape | 0.065802 | 0.061481 | -0.060332 | — |
| integrated_line | 0.070642 | 0.061641 | -0.060265 | 4 |
| elapsed_shape | 0.062814 | 0.058397 | -0.056581 | 0 |
| constant_thevenin | 0.107754 | 0.091199 | 0.055682 | 3 |
| source_mean_curve | 0.063403 | 0.051882 | -0.035931 | 2 |
| relative_by_setting | 0.068991 | 0.060749 | -0.057524 | 4 |
| relative_by_setting_shape | 0.064159 | 0.059723 | -0.057203 | 0 |
| additive_by_setting | 0.086436 | 0.080296 | -0.079597 | 4 |
| local_gradient | 0.194140 | 0.191323 | 0.058405 | 3 |
| shrunk_local | 0.089595 | 0.086390 | -0.016201 | 3 |
| quadratic_shared | 0.063124 | 0.059202 | -0.057447 | 0 |
| nearest_corrected | 0.047807 | 0.043236 | -0.035059 | 0 |
| wrong_module | 0.065691 | 0.060923 | -0.060556 | 2 |

| Test module | Candidate RMSE | Row-ordinal shape | Nearest donor | Swapped calibration |
|---|---:|---:|---:|---:|
| 5 | 0.084007 | 0.080742 | 0.061616 | 0.048755 |
| 6 | 0.033524 | 0.031467 | 0.026055 | 0.104640 |
| 7 | 0.090171 | 0.087385 | 0.067382 | 0.051827 |
| 8 | 0.055506 | 0.051662 | 0.036174 | 0.057544 |

The candidate's largest error occurred on TEG7 at nominal 80 °C difference, at the very first sample. Measured voltage was −0.004707838 V and recorded current was 1.297. The candidate gave 1.006147, the closest donor 1.104206, the constant-parameter Thévenin control 1.292744 and the local-gradient control 1.298324. The latter two methods have larger overall errors despite their near-exact values on this particular row. The six available raw samples from row zero through row five and all aligned model outputs are preserved. On the preregistered first 16 rows the candidate's mean RMSE was 0.112059, compared with 0.063674 on the remaining rows. The inherited normalized shape improves the early portion against its uncorrected linear law (0.192189), but loses to the ordinal control (0.108501) and nearest donor (0.053518). [Complete score, hashes and worst episode](score.json)

## What electrical measurements identify

Chapter 4 of the thesis supplies N = 128 junctions and Z = 0.00209 and uses an external temperature-control system. Its three electrical equations depend on the junction resistance R and the product S·(Tₕ−T𝒸), with electrical power W = VI. Two distinct known loads with different nonzero currents can identify those two combinations in the ideal model. Electrical observations alone leave a common temperature translation and a compensating thermopower/span rescaling free. Independent surface thermometry, externally supplied Z, bounds and material parameters add information.

A parallel passive thermal path at fixed face temperatures increases the hot-side heat requirement without changing any terminal I(V) value in this model. For three positive thermal conductances an exact rational check gave identical terminal power of 0.2704 W and three distinct efficiencies, all below Carnot. The same test verified 909 transformed electrical observations at 101 loads. It used synthetic constants and does not estimate the efficiency of these eight modules. The paper's 2.97% aggregate efficiency at 90 °C difference was already exposed in the literature. No held electrical or calorimetric accuracy claim uses that number.

## Custody and verification

The 44/28 split was frozen at `3f4a947387a24743e535d2d84db6604e62853f76`. Protocol and implementation were frozen at `4dcaaa64a8bd4d5f808f644ee1d1455f6a45454f`. All 364 response functions were locked in `77466fd8b3dc4047393fa065654b77709189bcef`. The 38,960-byte file has SHA-256 `40c70a27033bf30b75a718d76ebaa043a0824715bd47011d5dec1140cdf534ab`. The successful original receiver authenticated member identifiers and publisher SHA-256 for all 28 inputs, and evaluated 190,528 current predictions. The 117,856-byte [complete score](score.json) is the exact decoded payload of the primary receipt. [Native receipts](native-receipts.json)

The independent raw-file reader exited at the publisher's HTTP 403 catalog response before it opened any target file. Its original error is retained. A separate 55-digit offline receiver recalculated all 728 locked E/R values from the original development fit summaries, 416 module and 104 overall metrics from the stored sweep scores, and all 78 predictions on the six surviving raw samples in the worst episode. It also recovered the unchanged failure decision. Those checks do not independently reconstruct all 14,656 raw measurements or all normalized shape tables. Run `python3 replay.py .` from this directory for the original stored-result gate or `python3 independent_offline.py` for the separately implemented check. [Independent receipt](offline-receipt.json) · [Original 403](independent-raw-refusal.json)
