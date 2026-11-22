# Predicting axial stress from rotational shear measurements

A strain-damped relaxation model reproduced measured torque and small-amplitude moduli within 2.6–8.8% across six NIST reference-material conditions. Its prediction of the first normal stress difference failed both registered comparison gates. At 0 °C and 100 s⁻¹ it predicted **94.96 MPa** for the polyisobutylene solution. The independent axial-force channel measured **7.126 kPa**. Laun’s published rule gave **5.992 kPa** on that row and had the lowest aggregate error across all six conditions.

## Measurements and endpoint

NIST studied an 11.4% polyisobutylene solution in 2,6,10,14-tetramethylpentadecane (SRM 2490) and a polydimethylsiloxane melt (SRM 2491). Each cone-and-plate run supplied a torque-based viscosity and a separate force-based normal-stress measurement. The ideal conversion is N₁ = 2F/(πR²). The force-rebalance transducer had a 20 N range and estimated standard uncertainty u(F) = 0.0008 N + 0.002F for positive force. Calibration used known masses. NIST zeroed the force channel with its first six rates, 0.001–0.01 s⁻¹. Sensor uncertainty, uncertainty of the reported mean, and absence of a reported force are distinct quantities.

Table 8 gives measured viscosity, measured N₁, their combined standard uncertainties, and separately fitted values. This study uses the measured columns. Table 9 supplies measured storage and loss moduli, G′ and G″, from separate parallel-plate oscillatory runs. Twenty-five degrees has a steady-shear run but no direct oscillatory sweep. Every arm combining those channels uses the pointwise geometric mean of the 20 and 30 °C moduli at identical angular frequencies. The 10 and 40 °C sweeps remain in the public input projection and do not supply extra force cohorts. All 138 steady-rate rows, 70 measured force values and 68 rows without a force value are accounted for. NIST marks 6.31 s⁻¹ on all three PDMS curves as reference-only. The primary score includes all three and the published result includes the separate exclusion diagnostic. The source dates describe historical certification measurements.

The source reports averages over a 30 s measurement window after a finite application of shear. The PIB solution at 0, 25 and 50 °C was sheared for 40, 30 and 20 s, respectively, before averaging. Rotations in both directions entered the measurement. PDMS used a 20 s application followed by a 30 s average. Rate history, preparation and zeroing matter. The empirical endpoint is NIST’s protocol-conditioned mean. Individual time histories and a verified complete relaxation of the specimen at each new rate are unavailable here. The six material/temperature curves summarize repeated measurements. They do not supply 70 independent material replicates.

Source reports and published controls are available from [NIST SRM 2490](https://doi.org/10.6028/NIST.SP.260-143), [NIST SRM 2491](https://doi.org/10.6028/NIST.SP.260-147), [Laun (1986)](https://doi.org/10.1122/1.549855) and [Steller (2016)](https://doi.org/10.1007/s00397-016-0938-3).

## Frozen comparison

The candidate uses nonnegative populations of 36 Maxwell relaxation times from 0.0001 to 1,000 s, seven strain-damping coefficients from 0 to 3, and a Newtonian background viscosity. For a mode with modulus G, relaxation time λ and damping coefficient b, let z = λγ̇. Exponential strain damping gives a steady viscosity contribution Gλ/(1+bz)² and an equilibrium N₁ contribution 2Gz²/(1+bz)³. Small-amplitude storage and loss contributions are G(ωλ)²/(1+(ωλ)²) and Gωλ/(1+(ωλ)²). The fit minimizes the largest relative residual across measured viscosity, G′ and G″ for each condition. The solver-returned solution supplies the point forecast. Other feasible solutions can have very different N₁. The coefficient grid, objective, projections, fits and scoring source were frozen before opening measured N₁.

The comparison includes Laun’s formula 2G′[1+(G′/G″)²]^0.7, with ω numerically equal to γ̇ in rad/s and s⁻¹, respectively. Inside the measured oscillatory-frequency range it interpolates the logarithms of measured moduli. Steller’s published Eqs. 17 and 26 operate on the local slope of log shear stress against log rate. Both run with a shape-preserving local interpolant and with a polynomial degree chosen by leave-one-out torque error among degrees 2–5. All four use the same bounded slope domain. Sharma–McKinley and Wagner slope rules run as additional controls. Actual unconstrained slopes and orders are in the frozen predictions. Several PDMS slopes are poorly determined at the final reference-only point, where the viscosity falls sharply. Steller’s paper used these exact six NIST cohorts when comparing and deriving empirical stress-ratio formulas. The two transparent slope reconstructions are specified implementations of the equations. The paper does not release a unique set of per-cohort slope estimates. This is a prospective analysis of published historical measurements, with no independent new specimen validation.

Point errors are mean absolute error divided by the mean absolute observed N₁ within each complete curve. The primary minimax point had to beat all seven fixed controls on both the equally weighted mean and the worst of these six errors. An arithmetic midpoint is reported as a diagnostic only.

| Material | °C | Axial / torque rows | Candidate normalized MAE | Laun normalized MAE | Observations in envelope | Width / mean absolute N₁ |
|---|---:|---:|---:|---:|---:|---:|
| PIB | 0 | 15 / 26 | 5,690.863 | 0.08965 | 7 / 15 | 8,487.62 |
| PIB | 25 | 15 / 26 | 12,078.429 | 0.04299 | 15 / 15 | 17,789.00 |
| PIB | 50 | 13 / 26 | 2.804 | 0.08123 | 11 / 13 | 1,614.95 |
| PDMS | 0 | 10 / 20 | 106.788 | 0.05874 | 10 / 10 | 1,758.90 |
| PDMS | 25 | 10 / 20 | 0.413 | 0.02351 | 10 / 10 | 2,497.65 |
| PDMS | 50 | 7 / 20 | 0.151 | 0.02407 | 7 / 7 | 275.65 |

Across curves, the candidate scored **2,979.908** and Laun **0.05336**. Their worst-curve values were **12,078.429** and **0.08965**. All point gates failed. The interval program minimizes and maximizes N₁ at each rate subject to nonnegative weights and a common relative input tolerance max(8%, 1.10 × optimal input error) plus a numerical guard of 10⁻⁷. Each rate can have different extremizing weights. Three registered gates required all curves to meet an 8% input residual, contain at least 90% of their observations and have mean width no larger than the mean absolute observation. All three failed. These intervals describe a finite specified model class and numerical input tolerance. Statistical calibration was outside the protocol.

## Raw worst row and slow-mode ambiguity

At 0 °C and 100 s⁻¹, Table 8 reports viscosity 9.08 ± 0.06 Pa·s and N₁ 7,125.98 ± 53.74 Pa, both with combined standard uncertainty. The table’s separate fitted values are 9.53 Pa·s and 6,937.36 Pa. Appendix certificate Table 4a independently rounds the measured values to 9.08 ± 0.12 Pa·s and 7,126 ± 107 Pa with expanded uncertainty. The frozen candidate predicted 94,962,545.98 Pa. One mode with λ = 1,000 s, b = 0 and G = 0.0047465355 Pa contributed 94,930,710.16 Pa and 4.7465355 Pa·s to the modeled viscosity. The 19 positive modes on this curve stayed within the stored 4.26084% input residual. The independent mode reconstruction reproduces all 138 frozen point forecasts within 7.5 × 10⁻⁹ Pa and records all modal contributions to the worst row.

Two mathematical distinctions explain why these measurements need independent axial validation.

1. In an enlarged class allowing storage depending on instantaneous rate of deformation D, add stress c(D:D)D° with c ≥ 0. Here W is the spin tensor and D° = dD/dt + DW − WD is the corotational derivative. The added stress power equals the time derivative of c(D:D)²/4. The term is objective, leaves linear-response SAOS unchanged and adds zero steady shear stress. In steady simple shear its contribution to N₁ is −cγ̇⁴/2. This exact ambiguity uses the stated rate-gradient storage class. It confers no general claim about a real melt, finite-amplitude oscillatory harmonics or the well-posedness of a flow problem.
2. Even ordinary positive Maxwell modes permit an equilibrium ambiguity at finite input tolerance. Add a nonshear-thinning mode of modulus ε/λ. Its steady viscosity contribution is ε, its finite-frequency modulus contributions are bounded by ε/λ, and its equilibrium N₁ increment is 2ελγ̇². Increasing λ can therefore make its equilibrium normal stress arbitrarily large while staying inside input tolerances with positive slack. Startup from rest instead multiplies this increment by 1 − exp(−t/λ)(1+t/λ). At a fixed observation time the increment tends to εγ̇²t²/λ. An unbounded equilibrium construction supplies no unbounded force claim for NIST’s finite-duration experiment.

## Reproduction

Use Python with NumPy, SciPy and Poppler’s pdftotext. The original solver used Python 3.12.3, NumPy 2.2.6 and SciPy 1.15.3. A second runtime using SciPy 1.17.0 produced the identical 38,530 forecast bytes. The command below downloads the two pinned reports into the specified directory when absent and verifies their SHA-256 before projection.

```bash
python research/polymer-normal-stress/replay.py /tmp/nist-rheology
```

The replay first projects torque and SAOS fields and compares all predicted arrays with frozen-predictions.json. It then reads the measured axial columns, reconstructs the full report, resolves the optimizer’s active modes and uses an independent physical-coordinate reader for all 138 rate rows, 140 axial/uncertainty cells, 630 point errors and 140 envelope endpoints. Poppler decodes source pages before field selection. No numeric axial force entered forecast construction. Three source-bound input corrections address a split decimal and two omitted temperature tokens in the scanned text layer. The source measurements, force-empty cells and held decisions remain intact.
