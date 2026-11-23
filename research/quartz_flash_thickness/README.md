# Cross-thickness prediction of quartz laser-flash voltage shapes

The squared-thickness time warp beat the registered conduction kernel in all six direction–temperature groups. Mean waveform RMS errors were **0.150646 for the warp and 0.205023 for the kernel**. The kernel beat every control in 0/6 groups. The prespecified rule required the lowest mean and at least five such group wins. The measured comparison used 18 shots on two HT2 platelets from one synthetic crystal.

## What was predicted

Each forecast used one or three HT1 thin-platelet traces acquired within 2 °C of the thicker target, along the same crystallographic axis. The matched recordings had an InSb detector, a 12.7 mm beam, a nominal 1538 V laser setting, a 100 filter setting (instrument field in mm), gain 127 and a 0.127 ms analogue filter setting. The c-axis room-temperature thicknesses were 1.999 and 4.706 mm. The a-axis values were 1.986 and 4.022 mm. Room-temperature thickness was the available named thickness on the selected headers. The thin source, thick target, coatings, absorbed power and time-varying material properties can differ between runs.

The endpoint was the voltage shape over 0 to 8,000 ms at 10 ms intervals. Each shot used its own pretrigger median over −300 through −10 ms and its RMS over the 801 post-trigger points. The sign and the trigger sample were retained. Scoring performed the same transformation on the held detector voltage. The result assesses shape, with absolute baseline and amplitude removed. The recorded acquisitions extend beyond the scoring window.

The delay kernel follows from the insulated homogeneous slab solution under a shared front pulse and linear detector. It applies to the normalized derivative of rear temperature, or after consistent integration to the baseline-corrected rise. The measured-source convolution also carries source deviations forward. The squared-time control samples the measured source at time scaled by the squared thickness ratio. The Parker controls use the author-equation conduction shape, an actual finite-pulse exemplar, and source-only fits with zero, common or inverse-thickness-scaled first-order heat loss. These are transferable controls derived from the published equations. The historical in-house fitting software and its target-fitted parameters did not run. The source pulse exemplar covers 0.798 ms, contains 400 samples, and has a positive-weighted mean time of 0.314821 ms. Its header uses analogue filter 0.010 ms and gain 10. The shot-to-shot source pulse and the shared readout transfer remain assumptions.

## Results on every group

| Frozen role | Mean RMS | Error at the worst candidate sample, prediction minus target |
|---|---:|---:|
| Positive thickness-delay kernel (candidate) | 0.205023 | -13.808862 |
| Unwarped thin trace | 0.355973 | -12.162414 |
| Linear thickness time warp | 0.242072 | -12.272762 |
| Squared-thickness time warp | 0.150646 | -12.276960 |
| Parker model, zero loss | 0.169828 | -13.808862 |
| Parker model, common loss coefficient | 0.203848 | -13.808862 |
| Parker model, surface-scaled loss | 0.163898 | -13.808862 |
| Measured trace, loss-corrected squared warp | 0.159867 | -12.209025 |
| Measured trace, loss-corrected kernel | 0.165006 | -13.808862 |

| Axis and approximate temperature (°C) | Candidate RMS | Squared-time RMS | Lowest-error role |
|---|---:|---:|---|
| [001], 25 | 0.307700 | 0.264129 | Squared-thickness time warp |
| [001], 50 | 0.188947 | 0.104153 | Squared-thickness time warp |
| [001], 99 | 0.124653 | 0.071787 | Parker model, surface-scaled loss |
| [100], 25 | 0.366548 | 0.299486 | Squared-thickness time warp |
| [100], 50 | 0.152325 | 0.114103 | Squared-thickness time warp |
| [100], 99 | 0.089965 | 0.050220 | Squared-thickness time warp |

Each row averages three shots. Repeated shots at a given setting supply within-specimen information. The six group means share two platelets and one parent crystal. No confidence interval across independent crystals is available.

## The worst sample

In the first [100] shot at about 25 °C, the detector recorded **7.421 V at exactly 0 ms**, with a pretrigger median of **−1.185 V**. The preceding sample at −2.666 ms was −1.147 V and the following sample at 2.666 ms was −1.089 V. The normalized trigger was 13.808862. The candidate predicted about zero and the squared warp predicted 1.531902. The three matched thin traces recorded 9.999, 0.260 and 0.486 V at the trigger. Without an independent optical or electrical monitor for each shot, the origin of the brief excursion remains unresolved.

A postscore decomposition assigned 56.79% of the candidate's pooled squared residual to the 18 trigger samples and 90.70% of its worst shot's squared residual to its trigger. The interval 2.01–8.00 s still contributed 29.39% of pooled candidate squared error. Pooled squared-residual fractions use a different aggregation than the registered mean of shot RMS values. All triggers and all later samples remain in the registered score. No model was fitted again after the target reader.

## Source eligibility and prior exposure

The programme authenticated the original 40,327,680-byte public RADAR BagIt TAR and its 40,309,964-byte measurement ZIP. It catalogued 1,333 CSVs comprising 1,285 specimen thermograms and 48 pulse exemplars. Among 110 thick-cube shots, zero had a thinner same-direction record at ±2 °C matching all declared settings. The 110 cube response arrays remained unopened. All 392 HT2 shots matched a thin source on sensor, beam and flash settings, and 19 also matched on analogue filter and gain. Eighteen occurred below 150 °C, the regime where the authors describe their radiative contribution as negligible. The other [001] shot was near 575 °C. Only the 18 preregistered low-temperature shots supplied target values.

The original header inventory retained some instrument-derived summaries for 543 recognized curves and displayed nine exemplar rows, including one HT2 room-temperature shot on each axis. Those fields included half-time and pulse maximum. The forecast and scorer do not read them. The raw HT2 voltage series stayed closed until the 162 forecast arrays were locked. The paper's diffusivity trends and thick-cube crossover were prior aggregate exposure. [Measurement source](https://doi.org/10.35097/1215) · [Breuer and Schilling, sections 2.1–2.2](https://doi.org/10.5194/ejm-33-23-2021) · [Detector correction](https://doi.org/10.1007/s10765-019-2562-9)

## Reproduction and evidence

Run `python3 replay.py .` from this directory for the offline authenticated forecast and score check. Run `python3 independent.py` for a fresh public-archive scalar recount with Python's standard library. The independent receiver re-read all 18 original target series, rebuilt 129,762 residuals and 225 summary cells, and agreed to 1.12×10⁻¹⁶ on the reported RMS values. The independent reader verifies every forecast digest before opening the target inputs. Its original output is in `independent-original.txt`. The native producer and NumPy/SciPy scorer are retained separately.

The first forecast run stopped during pulse lookup because it scanned the outer BagIt member names. The archive diagnostic authenticated the named inner ZIP and exact pulse file. Source commit 03ac2ccf49f7b3707a16d253e238b909e0f5bd89 corrected file access while keeping the previously frozen roles, roster, metric and model equations. The subsequent original forecast SHA-256 is 5a80dc0a1eaf10d305464b0acc8ea9d4082d323d11450778d050c174bf5cc06f over 1,038,096 bytes. The source lock is commit ead1b42a3cf77eed3e0d2900c5c04e1691010d92. The six source-only ideal-slab discretization checks recorded a maximum absolute normalized-rise difference of 0.000343 and a maximum RMS difference of 0.0000263 on the 10 ms grid. See `native-receipts.json` for the 13 original terminal receipts, including the failed first forecast. The stronger performance of the squared-time warp here does not establish the mechanism behind the measured trigger or the material's true thermal diffusivity.
