# A dimensioned prediction for a switched hydraulic accumulator

A gas-storage calculation predicted a **36.842 ms** increase in charging time when the ZeMA rig switched its nominal accumulator precharge from 100 to 115 bar. On all 399 held cycles, the calculation missed four of five registered criteria. Across the 24 operating settings with a measured 100-bar reference, its mean absolute error in the setting's mean transit time was **9.947 ms**. This met the 10 ms tolerance. A regression on the experimental settings did better at **9.397 ms**, and two of the 24 measured contrasts ran in the opposite direction.

The rig used four separate 0.6 L HYDAC SBO330 accumulators of the same type. Each vessel had one precharge. These data test transfer between those switched units. There is no independent estimate of the effect of precharge relative to specimen identity.

## Held measurements

The 60 s repeated load cycle closes the load path and charges the selected vessel. Pressure PS1 is sampled at 100 Hz. The target is the elapsed time between first reaching 155 and 180 bar during the first 1.50 s. Each threshold crossed between two samples receives a linearly interpolated time. A record starting above a threshold receives time zero for that threshold. A threshold unreached by 1.50 s receives time 1.50 s. These conventions give every one of the 399 cycles an observed span.

The table reports absolute errors of the **mean span within each condition**, averaged equally across conditions. Its last column is the largest absolute condition-mean error. A condition combines the cooler, valve and pump interventions. The matched 24 had their own 100-bar development data. The other 12 had no development pressure traces at any precharge.

| Predictor | All 36, ms | Matched 24, ms | New 12, ms | Worst of 36, ms |
|---|---:|---:|---:|---:|
| Nominal pump flow and gas-volume increment | 10.483 | 9.947 | 11.556 | 54.260 |
| Keep the 100-bar transit time | 32.711 | 32.545 | 33.043 | 73.247 |
| Linear pressure-level interpolation | 11.203 | 12.090 | 9.429 | 43.513 |
| Three-level shape-preserving cubic (PCHIP) | 9.899 | 10.713 | 8.271 | 52.426 |
| Three-level quadratic | 11.161 | 11.529 | 10.425 | 55.666 |
| Regression on experimental conditions | 9.072 | 9.397 | 8.422 | 46.771 |
| Interpolate using gas volumes | 10.868 | 11.749 | 9.107 | 43.342 |

The worst condition for the nominal-flow model had cooler setting 3%, valve setting 80% and pump leakage stage 1. It predicted **487.692 ms**. The 10 measured spans averaged **433.432 ms**. Nine complete crossings averaged 481.591 ms, while cycle **396** (zero-based source row) started above both thresholds and contributed zero. Across all 399 cycles, 395 contained both crossings and four started above both thresholds. The organizer marked all four as stable. The mean 115-versus-100-bar contrast was −17.417 ms in this condition and −13.824 ms at cooler 3%, valve 73%, pump stage 1. All rows enter the registered result.

## Model and competing explanations

For fixed absolute pressure limits Pa and Pb and a polytropic gas, the oil-volume increment is V0 × P0^(1/n) × (Pa^(−1/n) − Pb^(−1/n)), with V0 = 0.6 L and n = 1.4. The receiver adds 1.01325 bar to the gauge measurements and nominal precharges. It divides the difference in predicted oil volumes for the two precharges by the nominal pump flow, 7.5 L/min. A constant system compliance cancels in this difference if both runs have the same net flow and traverse the same pressure range. The rig measures system flows, but the archive supplies no direct measurement of net inflow to this accumulator. Leakage and relief can change that quantity. The original authors also describe a proprietary real-gas AMESim simulation and show isolated-setting charging traces.

The development cohort comprised 1,207 cycles at 90, 100 and 130 bar in 24 nuisance conditions. All 1,207 remained above their own precharge throughout this observation window. They test the engaged response and supply no direct observation of the engagement threshold. On complete crossings, the nominal calculation predicted a 97.777 ms difference between 90 and 130 bar. All 24 development condition means had positive differences, ranging from 75.483 to 104.031 ms. Among all development cycles, six lacked two interior crossings. Repeating the 100-bar prediction with every cycle included gave 11.088 ms mean absolute condition bias, versus 13.963 ms for straight interpolation.

The broader waveform hypothesis had already failed its development comparison. With the same regression parameters, replacing pressure with precharge-weighted changes in reciprocal pressure improved matched-setting waveform error from 1.4604 to 1.3476 bar, but increased new-setting error from 1.5708 to 1.5789 bar and raised both worst-setting errors. For an engaged isothermal ideal gas with zero additional circuit compliance, the 0.6 L vessel volume cancels from this interpolation. Consequently, a good waveform fit in that coordinate cannot measure the vessel volume or establish a particular thermodynamic law.

The held waveform comparisons remain secondary. Three-level PCHIP in the storage coordinate achieved 1.2261 bar in matched conditions and 0.9697 bar in new conditions, versus 1.2842 and 1.0363 bar for ordinary PCHIP. With the same functional regression, the reciprocal-pressure coordinate instead lost in both groups, at 1.4758 and 1.2278 bar versus 1.4045 and 1.1080 bar for raw pressure. The two raw-pressure kernel entries are identical controls retained from separate model comparisons.

## Reproduce

Use Python 3.10 or newer, NumPy and SciPy. The command authenticates the original 76,601,704-byte archive, projects the 1,207 development records, rebuilds all 7 transit and 10 waveform forecasts, and then opens the registered 151 PS1 samples from each of the 399 target rows. It checks all five gates, the 24 observed contrasts, every aggregate and all ten worst waveform witnesses against the original result. The remaining pressure rows and other sensor channels stay unprojected. For a local copy, supply `--archive /path/to/data.zip`. Add `--details` to print every scalar arm's 36 condition-level errors and worst trial.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python research/hydraulic-accumulator-transfer/replay.py
```

The original prediction lock is SHA-256 `7f31c8fea1d1fe3b1c5f39b5e0b93c381cd4dfd33f1902ff513f886b7a147fb5`. The independent receiver used the original arrays. The public replay checks portable numerical agreement. Development included twelve gas parameter settings and 24 regression configurations. Models used the same declared treatment coordinates and time indices, with no initial held pressure, measured flow, prior cycle, or stability flag as a predictor. Scores describe this apparatus and its four specimens.

[ZeMA data and attribution](https://doi.org/10.5281/zenodo.1323611) · [Helwig, Pignanelli and Schütze, original experiment](https://doi.org/10.1109/I2MTC.2015.7151267) · [Helwig dissertation, experimental circuit and accumulator in sections 4.4–4.5](https://scidok.sulb.uni-saarland.de/bitstream/20.500.11880/27392/1/Diss_Helwig.pdf)
