# Predicting glycerol sound speed from density and calorimetry

A Gibbs potential fitted to 18 measured densities and 55 ambient-pressure heat capacities missed eight independent, jointly supported sound-speed measurements by **34.82 m/s RMSE**. A simpler volume fit reached 19.40 m/s. The published Tait density relation combined with directly fitted heat capacity reached 13.20 m/s, and an independently measured acoustic correlation reached 8.68 m/s. The proposed model lost on both primary isotherms. All 350 predictions for all 50 physical states were frozen before opening the measured ultrasonic response.

## Measured transfer

The thermal inputs come from Singh, Imran, Windmann and Vrabec. Table 6 supplies direct vibrating-tube densities at 0.1, 10 and 20 MPa on six complete isotherms from 298 to 373 K. Table 7 supplies 55 directly measured heat capacities at 0.1 MPa, from 284.04 to 390.48 K. Densities are in kg/m³ and heat capacities are converted to J/(kg K). The source is CC BY 4.0. Tables S15–S17 and equations 31–32 derive properties from acoustics and were excluded. The fixed experimental Tait acoustic control uses independently acquired speed measurements and has more information than the thermal roles. [Singh et al., 2026](https://doi.org/10.1021/acs.jced.5c00816)

Ahmadi and colleagues measured the evaluation data in a separate laboratory. The 50 pressures and temperatures in their Table 12 were available to the predictor. Only the receiver accessed its measured sound-speed column. Table 13 contains their fitted sound correlation and remained outside construction and scoring. Figure/table comparisons in the later 2026 paper make this an archival cross-instrument study with locally prospective predictions. An early indexed-source query exposed 32 sound values from the 2026 source at 340, 350, 400 and 450 K. The entire 2026 acoustic campaign is archival. [Ahmadi et al., published 2023](https://doi.org/10.1016/j.jct.2022.106975) · [Author institution and license](https://researchportal.hw.ac.uk/en/publications/an-investigation-on-the-thermophysical-properties-of-glycerol/)

The historical instrument used through-transmission ultrasonic transducers specified at 2–2.25 MHz. The supplier reported a glycerol mole fraction of at least 0.995 with at most 0.20% water by weight. Actual matched water content, specimen identity, and a frequency-dispersion correction across the laboratories are unknown. The maximum reported expanded uncertainty of the historical speed measurements is 4.07 m/s. Observations came from one measurement campaign. The eight primary cells span two isotherms and four pressure settings per isotherm.

| Frozen prediction | RMSE, 8 common-support cells (m/s) | Mean absolute error (%) | RMSE, all 50 (m/s) |
|---|---:|---:|---:|
| Gibbs volume polynomial and pressure-dependent heat capacity | 34.819 | 1.6483 | 154.155 |
| Same volume, heat capacity fixed at its ambient value | 34.854 | 1.6498 | 154.268 |
| Same volume, isothermal derivative | 111.406 | 5.9982 | 213.460 |
| Reduced Gibbs volume polynomial | 19.405 | 0.8467 | 90.935 |
| Published Tait density with measured calorimetry refit | 13.203 | 0.5575 | 70.300 |
| Published Tait density with literally printed calorimetry | 11.678 | 0.5436 | 67.230 |
| Published direct-sound Tait correlation | 8.675 | 0.4832 | 7.840 |

The primary intersection is 340–373.15 K and 0.1–20 MPa. Twelve cells fall inside the thermal calibration range alone. All 50 cells were retained, including 38 outside that range. The primary candidate RMSEs at nominal 348 and 373 K were 26.921 and 41.232 m/s. The direct-sound control reached 8.908 and 8.436 m/s. Replication across independent specimens cannot be inferred from these isotherms.

At the worst primary cell, 373.14 K and 1.343 MPa, Ahmadi measured **1,745.92 m/s**. The candidate gave 1,798.951, its static-heat counterpart 1,798.942, the isothermal approximation 1,679.933, and the smaller polynomial 1,760.936 m/s. The Tait density closures gave 1,752.028 and 1,756.395 m/s with fitted and printed calorimetry. Direct acoustic Tait gave 1,737.395 m/s. At the largest full-course miss, 398.16 K and 55.193 MPa, the measured speed was 1,812.98 m/s and the candidate gave 1,404.952 m/s. The direct acoustic correlation gave 1,826.089 m/s at that extrapolation. Every same-row control is retained in the score.

## Why accurate densities did not determine accurate speeds

Let specific volume be v = ∂g/∂p, where g is mass-specific Gibbs free energy. For measured ambient heat capacity and a fitted volume surface, integration gives

    cp(T,p) = cp(T,p0) − T ∫[p0,p] ∂²v(T,p')/∂T² dp'
    c² = −v² / [∂v/∂p + T (∂v/∂T)² / cp].

Both pressure derivatives and integrals use Pa. The fitted polynomial uses centered temperature and pressure, with reduced forms in the protocol. The formula predicts a thermodynamic adiabatic speed. A comparison with finite-frequency measurements also depends on material state and dispersion.

Consider adding a quantity proportional to (p−p0)² to g. It produces a coherent tilt of specific volume with pressure and preserves the full heat-capacity function exactly. Write the change in v as 10⁻⁶ a (p[MPa]−0.1)/20 m³/kg. Across all 18 calibrated density observations, the permitted values under a deterministic ±1 kg/m³ margin include a from −0.59870429 to +0.58432480. Positive heat capacity and compressibility hold on the checked witness grid. The fitted density residual is at most 0.1553 kg/m³ and ambient heat-capacity residual at most 6.81 J/(kg K). At 353.15 K and 15 MPa, those two physically admissible branches give **1,660.17 and 1,913.59 m/s**, around the nominal 1,775.10 m/s, with the same heat capacity of 2,642.43 J/(kg K). This is a finite sensitivity construction under marginal tolerances. No joint probability or actual instrument error is assigned to it.

A separate source audit read all 60 directly measured Ahmadi VTD density observations from Table 10 before scoring acoustics. Eight satisfy the frozen thermal window. Applying their ±1.27 kg/m³ expanded margins leaves both tilt extrema feasible. The two-column reader supersedes an initial 30-row first-column receipt. Neither version entered a fit. A separate 2016 NIST ThermoML deposit was authenticated as 24+36 direct density rows, whole-file SHA-256 d78cfd8a507e9288886c94080a7019465da0b91fd2f6714a2b675c59675314a6. The subsequent numerical intake returned HTTP 403, so its observations do not constrain the witness. [Prieto et al., 2016](https://trc.nist.gov/ThermoML/10.1016/j.jct.2016.05.006.html)

The printed Singh direct-acoustic coefficients reproduce 32 archived source cells within 0.282%. Their printed experimental density coefficients agree with the selected 18 source densities to 0.501 kg/m³. Their printed ambient heat-capacity polynomial differs from the 55 Table 7 observations by mean 3.609% on the authors' calculated-value denominator, although Table 4 lists 0.04% for the fit. Both the literal polynomial and a cubic fitted to the published observations were retained. The literal coefficients yielded the smaller speed error on the historical cells despite their larger calorimetry error. This result identifies neither a typographic cause nor a physical benefit of biased heat capacity. The Egas et al. 5 MHz measurements are another historical comparator. Their retrieved catalog entry did not yield a verified numerical deposit, so no Egas score was computed. [Egas et al.](https://doi.org/10.1016/j.jct.2020.106367)

## Reproduction

The seven-file pre-observation commit is 01ffd965aa15ca52cd0d9b2d3fa37dc5abb8d75f. A fresh native checkout regenerated every byte of the 26,184-byte prediction file before the historical outcome receiver ran. Its SHA-256 is 3b8ea53a8d9e5d15290e392a939e992e10c17f7a7b5170f92e379a117179e5bf. The scoring implementation was then fixed at bedef863e0e8439822c840693daf73a65d9a3633. The original 49,276-byte measured score is SHA-256 8135687dc6219955a51f37a0456b3964494bcf48df3d4f0347eabc6c7e57b8c4.

Run `python3 replay.py` in this directory for the archived arrays and the 65-digit decimal recount. It checks all 350 forecasts, 308 summary values and 77 worst-row identities. The separate native receiver read the original PDF using an alternate layout, keyed all 50 rows by temperature and pressure, and independently computed the same 308 metrics with compensated summation. Its maximum difference was 1.78×10⁻¹⁵. Both native text readers used Poppler. The decimal check differed by at most 1.6×10⁻¹³ on the serialized arrays. To repeat the PDF path, supply the exact public author-deposited PDF to `python3 score_locked.py /path/to/article.pdf --output score.json`. The receiver verifies its whole SHA-256. The manuscript PDF is available from the author institution under CC BY-NC-ND. This package contains source references, numerical observations, predictions, code, and receipts. [Author-deposited PDF](https://pure.hw.ac.uk/ws/portalfiles/portal/76812826/1_s2.0_S0021961422002543_main.pdf)
