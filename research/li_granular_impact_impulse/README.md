# Do coarse basal load and optical shear predict finer pressure fluctuations at higher release mass?

A load-times-shear model missed the growth of fine-scale basal pressure fluctuations when release mass increased to 12 kg. Its normalized RMSE averaged **1.31705** across five quartz grain-size distributions. The empirical model using the same pressure, optical and mass information achieved **0.71566**, squared load achieved **0.74803**, and load alone achieved **1.22083**. All three beat the candidate in each of the five compositions. The preregistered joint gate failed.

## Physical comparison

Li, Wang, Cheng and colleagues released angular quartz down a 40° flume. A flush 4 × 4 cm plate recorded basal normal stress at 1 kHz. Two source workbooks provide raw stress in pascals and optical velocity profiles in m/s with heights in centimetres. The pressure archive contains 45 labelled releases and 187,737 native samples. All clocks start at zero and agree with successive 1 ms steps to within 4 × 10⁻¹⁶ s. The 32 development releases have 4 or 8 kg of material. All 13 available 12 kg releases entered the test. Each of the five grain-size distributions contributed two or three held releases. They share the flume and plate. Sources [Li et al.](https://doi.org/10.1029/2021JB022905) and [revised data release](https://doi.org/10.5281/zenodo.5764145).

The test conditions on a coarse measurement of each held pressure trace. Starting at its first sample, the extractor computes the mean in each disjoint 64 ms block. It partitions the remainder into descending powers of two. At each of six scales the predictor receives only the weighted mean of positive-part block means and the corresponding mean square, with weights equal to the number of detail coefficients in the block. A single fixed mean in a length-(n) block leaves (n-1) real-valued contrast directions free. No overlapping sliding mean enters the predictor. A separate reader obtains the signed orthonormal Haar coefficients within each block and scores their mean square at 2, 4, 8, 16, 32 and 64 ms. Those values have units of Pa². Parseval’s identity accounts for every sample through the DC and detail terms. These packet energies depend on the chosen grid and cover finite, nonstationary pressure events.

Twenty-six optical records supply 384 dated profiles across the 15 mass/composition conditions. For each profile the independent driver is the magnitude of the endpoint velocity difference divided by the observed height span. Equal time-point weights give a replicate mean. Equal replicate weights give the condition mean. Every available profile has at least two distinct heights. These are condition-level sidewall secants assembled from separate optical measurements. Sub-block alignment to individual impacts, local collisional velocity and plate frequency response remain unknown. The optical means were inspected and frozen before held detail extraction. Initial optical source code stopped at leading blank cells and missed most measured profiles. Its original result is retained. The corrected reader uses each author-marked profile rectangle and includes separated leading blanks.

## Model and controls

For a stationary Poisson arrival process with a common pulse shape and independent impulse marks (J), spectral power scales with arrival rate times (E[J²]). Mean force scales with arrival rate times (E[J]). The candidate further assumes that the effective impulse (E[J²]/E[J]) varies in proportion to the optical shear proxy at fixed composition, and that coarse pressure tracks impact load. Each composition/scale gets one development gain. Enduring contacts, correlated arrivals, spatial averaging, pulse or electronics changes and nonstationary signals can violate that approximation. The observed shear omits the region between the lowest tracked grain and the plate. The comparison tests the finite-band predictive consequence on one apparatus and mass transition.

Squared-load, unchanged-spectrum, mass extrapolation, a learned load exponent, a cyclic optical-assignment sham and a pooled log-ridge use the same allowed information. The log-ridge includes measured coarse load, optical secant and nominal mass with separate composition intercepts. The three paper-inspired controls use the published range of normalized-agitation exponents 0.31–0.43 and a static-density inertial-stress proxy. They adapt a reported scalar relation to the squared-load, per-band endpoint. The source’s dynamic density was inferred partly from measured pressure. The original paper’s prediction error and grain impact masses are outside this comparison.

On the authors’ named development example IMF-223:g3, raw minus archived mean matches archived fluctuation to (5.69 × 10^{-14}) Pa. A transcription of the released 21-point, 30-pass MATLAB configuration gives 0.09214 Pa RMSE against the archived mean. A single 21-point pass gives 9.82397 Pa. The 30-pass original differs by 1.00083 Pa at 2.457 s. The source permits adjustment of the filter settings. The comparison does not authenticate one setting for all archived means. A 30-pass interior sample can depend on 601 raw samples, another reason the printed sliding-mean waveform would give substantially more held information than the disjoint block summaries.

## All held comparisons

The independent units for reporting are the 13 labelled releases, grouped into five compositions. Each run contributes six power errors normalized by the mean development power at that composition and scale. Metrics are computed per run, averaged within each composition, then averaged equally over the five compositions. The final column counts compositions in which the candidate has smaller normalized RMSE than the named role.

| Role | Normalized RMSE | Normalized MAE | RMSE (Pa²) | MAE (Pa²) | Candidate wins / 5 |
|---|---:|---:|---:|---:|---:|
| shot_shear | 1.31705 | 1.18686 | 2683.46443 | 2446.57375 | — |
| shot_load | 1.22083 | 1.08079 | 2492.43537 | 2239.86572 | 0 |
| coherent | 0.74803 | 0.62126 | 1474.77641 | 1186.97243 | 0 |
| paper_mid | 0.78590 | 0.66039 | 1539.64363 | 1270.30680 | 0 |
| paper_low | 0.77654 | 0.64962 | 1522.05536 | 1245.36172 | 0 |
| paper_high | 0.79636 | 0.67126 | 1559.73318 | 1295.25934 | 0 |
| source_mean | 1.90297 | 1.81421 | 4028.53106 | 3856.61733 | 5 |
| eight_kg | 1.46386 | 1.34060 | 3148.55523 | 2935.36903 | 4 |
| mass_linear | 1.04727 | 0.90394 | 2196.38572 | 1925.89914 | 0 |
| mass_extrapolate | 0.79411 | 0.68079 | 1609.33678 | 1369.09087 | 0 |
| learned_load | 0.82675 | 0.70555 | 1659.04049 | 1398.74596 | 0 |
| joint_log_ridge | 0.71566 | 0.61843 | 1353.92319 | 1148.77167 | 0 |
| rotated_shear | 1.32549 | 1.19195 | 2744.40851 | 2507.27546 | 3 |

The candidate’s largest absolute error occurs in IMF-232:g1 at the 32 ms scale. The observed power was **10,828.65 Pa²**, against **4,034.76 Pa²** predicted, **6,446.14 Pa²** from squared load and **8,194.92 Pa²** from the empirical model. Its largest measured detail starts at 1.952 s and has coefficient −508.763 Pa. The 32 underlying readings range from −23.466 to 573.542 Pa. The largest normalized error occurs in IMF-235:g2 at 64 ms. Observed power was 6,060.67 Pa² against the candidate’s 1,357.68 Pa². Both original signed raw windows and every comparator at each same endpoint are in [score.json](score.json).

In an exploratory comparison from 8 to 12 kg, condition-average optical shear changed by factors of 0.922–1.044. At those same compositions, mean measured power increased by factors of 1.46–2.40 at 2 ms and 1.60–2.90 at 64 ms. The small optical change helps explain why multiplying by it failed to improve load transfer. These ratios do not isolate a cause of the additional pressure energy.

## Reproduction and original records

The prospective source is `2018e12be5437aeb603d4d154985ca5899fc9aed`. All 1,014 forecasts were locked in `6ae85598acc1703a895e3324c56228d4af66cc01`, before the held fine-scale values were computed. The 42,931-byte [forecast](forecast.json) has SHA-256 `013e4fb7c60d6329d40a014dd884d53d6554c61759c18c8694959419bc6ea9c5`. The online extractor authenticates source archive member size and publisher MD5. The independent Decimal reader separately authenticates the complete pressure workbook by SHA-256. All original native command, request, generation and full-output identities are in [native-receipts.json](native-receipts.json).

Run `python3 replay.py .` from this directory for an offline recalculation against the locked predictions. Run `python3 independent.py` for the distinct 55-digit raw-pressure reconstruction. It rebuilt all 270 band energies from all 187,737 source readings, compared 676 per-release metrics, 260 composition metrics and 52 aggregate metrics, and verified both raw failure windows. The maximum checked relative discrepancy was (1.39 × 10^{-15}) with a unit absolute denominator floor. [Independent receipt](independent-receipt.json).
