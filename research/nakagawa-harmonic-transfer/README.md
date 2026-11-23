# Predicting fourth-harmonic voltage from the second harmonic of a heater sweep

Across 62 measured WTe₂ sweeps, the smoothed harmonic integral predicted high-drive fourth-harmonic voltage with a mean sweep error of **12.85 µV**. A matched fit of the published quartic current dependence gave 156.77 µV. Smoothing improved the overall mean compared with integrating the unsmoothed input (13.93 µV), but its worst sweep was less accurate (87.71 versus 52.48 µV). **Five of eight registered comparisons passed.** The remaining three failed, so all 80 TaIrTe₄ voltage sweeps remain unopened.

Nakagawa and colleagues measured lock-in voltage responses while varying the heater command on low-dimensional semimetal devices. We use all 62 available WTe₂ sweeps across longitudinal, transverse and mixed crystal-axis geometries, two heater configurations, and multiple bath setpoints. For each sweep, all second-harmonic measurements and the fourth-harmonic measurements at or below 65% of maximum drive were supplied at prediction time. The bank contains all 3,024 higher-drive observations' predictions across twelve procedures. This is conditional prediction with high-drive second-harmonic inputs. The 62 sweeps share hardware and devices.

## Measured errors

All entries are mean absolute fourth-harmonic voltage errors in microvolts. Each whole sweep receives equal weight. The worst column is the largest mean error of a single sweep. The eight gates compare the primary procedure to every other procedure in the table, for each statistic overall and within each of three geometries.

| Procedure | Equal-sweep mean | Worst sweep |
|---|---:|---:|
| smooth_integral | 12.850 | 87.715 |
| raw_integral | 13.926 | 52.480 |
| unit_integral | 21.759 | 72.718 |
| published_quartic | 156.769 | 1104.895 |
| quartic_plus_curvature | 163.707 | 996.866 |
| paired_published_quartic | 174.123 | 1584.836 |
| constant_prefix | 200.618 | 1315.833 |
| unconstrained_curvature | 204.996 | 1343.155 |
| quartic_sextic | 241.856 | 1931.944 |
| validation_power | 243.752 | 2415.085 |
| reversed_unit | 418.042 | 2701.729 |
| quartic_octic | 458.701 | 3338.231 |

The smoothed integral won both comparisons in the nonlinear Nernst geometry (7.997/25.561 µV) and both in the mixed geometry (7.685/20.355 µV). It lost both longitudinal comparisons (23.353/87.715 µV versus 21.626/52.480 µV unsmoothed). It won the overall mean and lost the overall worst. The paired-heater control uses the authors’ 200-point common-grid construction, the measured prefix slope ratio and the source quartic family. Our prediction split restricts that procedure to low-drive fourth-harmonic calibration. The authors' fitted full-range symmetrized curves answer a different question.

The largest individual miss was the final row of the longitudinal heater-1 sweep at 25 K. At command 0.752 V the recorded second harmonic was −7.526 mV. The fourth harmonic was **−2.60 µV**, compared with −187.97 µV for the smoothed integral and −66.06 µV for the raw integral. The fitted relative gains were respectively 2.18 and 0.846. The smoothed integral feature at that row was −80.72 µV after subtracting the affine second-harmonic input. Those are differences between complete frozen procedures. The full 188-point drive and second-harmonic trace, 122 calibration fourth harmonics, 66 held fourth harmonics, fitted scales and input features are retained. They do not identify a physical source for the miss.

## Why the second harmonic contains information

If voltage is a fixed function of instantaneous squared sinusoidal heater current, the second and fourth Fourier coefficients are linked across drive amplitudes. Write the squared RMS amplitude as A and the second coefficient as U(A). In the authors' sign convention the fourth coefficient is

    −U(A) + 3 A⁻² ∫₀ᴬ t U(t) dt.

For a monomial of degree m in squared current, the fourth-to-second coefficient ratio is −(m−1)/(m+2). Uniform polynomial approximation extends the relation to continuous static responses. The numerical method integrates a piecewise-linear estimate of U, with a local quadratic smoother. Unobserved inputs below the first positive drive contribute a term proportional to A⁻². The fit uses that term, a constant and a freely fitted relative gain. This permits fixed readout offsets, sign and gain. Amplitude-dependent instrument phase, thermal memory and finite-grid interpolation remain possible explanations for deviations.

Finite drive samples leave the integral unidentified without interpolation assumptions. The exact polynomial construction in `theorem.py` gives identical second harmonics at all four example nodes but different fourth harmonics at every one. It also checks 48 monomial identities. This mathematical statement does not assign any of the experimental errors to between-node variation.

## Archive and verification

The authors’ raw registry lists 154 unique sweeps. Twelve WTe₂ files in the named Higher_temp directory are absent from the archive. The original full-roster comparison could not be admitted. The available-data contract was then fixed before opening per-drive voltages. The source-only instrument mapping printed stored SignalPhase readings in addition to configured reference phases. Those readings are disclosed prior exposure and enter neither predictors nor selection. The raw command column is a voltage; its normalized square represents the heater current squared under a fixed within-sweep conversion. We use no simulated temperature field or inferred thermoelectric coefficient.

The original complete bank was locked before the held-voltage receiver. A separate standard-library implementation read the original WTe₂ tables, recomputed all 3,024 primary predictions with pivoted scalar normal equations and piecewise Simpson quadrature, and recounted all 36,288 errors. Maximum disagreement was 2.65e−17 V for primary predictions and 4.55e−13 µV across 840 curve and aggregate statistics. Both receivers recovered the same eight gate values and worst observation.

Run the following with the authors' `data.zip` in this directory. Forecasting uses NumPy. The theorem and independent receiver use only the Python standard library.

```sh
python3 theorem.py
python3 harmonic.py forecast data.zip WTe2 new-bank.json
python3 harmonic.py score data.zip WTe2 new-score.json --bank new-bank.json --bank-sha "$(sha256sum new-bank.json | cut -d' ' -f1)"
python3 independent.py data.zip bank.json.gz score.json.gz 27dd19078b526fdd21a8e5274b40dcb617e38b23c2a2555ca3611e25e95feb23 b95335ea06c3d53873f0d00a8014caeff65c05ccefd56cd6a8c58c92eb653b4e
```

Original archive SHA256 is `aae5a0a58124b3aac207cfb46699481d354240f61b396cda5300a12ecaf16786`. The fixed protocol and code were registered at `e68aff14a2b2c2b5322e45ed9d70fb340ad2f138`. The two gzip files contain the unchanged bank and score. Decompression reproduces their original SHA256 values in the command above.

Source data by Kurea Nakagawa, Krishnaraajan Sundararajan and Marcos H. D. Guimarães, released under CC BY 4.0. The measurements and protocols are described by K. Nakagawa, K. Sundararajan, C. A. Cordero-Silis, B. J. van Wees and M. H. D. Guimarães. [Source archive](https://zenodo.org/records/24083693) · [Paper and supplementary methods](https://arxiv.org/abs/2607.21808)
