# Gas calibration fails to transfer an ultrasonic shear correction to brine on sandstone D

The matched gas correction increased absolute error at all seven pressures on the single released plug. Its ultrasonic brine shear RMSE was **126.638** in the workbook's speed units. Carrying over the highest seismic shear gave **32.821**, and extrapolating the brine observations alone gave **40.190**. Within the paper's stated pressure and frequency ranges, the gas-corrected and direct affine forecasts gave **89.102** and **13.216**. Both registered gates failed. Every fitted slope lay within the proposed interval, giving identical constrained and unconstrained forecasts.

## Measurements and input boundary

Ba and colleagues used forced oscillations to obtain seismic elastic modulus and Poisson ratio. They calculated low-frequency P and S speeds from these quantities. They obtained ultrasonic speeds through pulse transmission between end-cap transducers. The methods describe carbonate C and shaly sandstone D, nitrogen and water, 5–20 MPa differential pressure, 1 MPa pore pressure and 1–100 Hz oscillation. The deposited archive contains four workbooks for **one** sample, sandstone D. Their labels are Gas and Brine. Seven corresponding pressures include 1 and 3 MPa, and the ten frequency labels include 128 Hz. Cell C9 in the brine ultrasonic workbook is formatted and empty. The primary uses all seven pressure states and ten frequencies. The prespecified five-state sensitivity uses the common 5–20 MPa and 1–100 Hz ranges and reuses five targets. The published qualitative pressure trend was known before the comparisons. [Article](https://doi.org/10.1093/gji/ggae020) · [Author archive](https://doi.org/10.5281/zenodo.8371594)

Inputs comprised all seismic P and S speeds in both fluids, gas ultrasonic P and S, and brine ultrasonic P at each pressure. The numeric brine ultrasonic S column entered the receiver after forecasts were locked. The trusted extractor parses complete XML members and supplies only registered columns to the predictor. The experimental unit is one plug with no authenticated repeat at each pressure. Raw waveforms, per-mode pulse-centre frequencies, attenuation, repeat uncertainty and inter-apparatus calibration are unavailable in the deposit. Output headings give Pwave and Swave without explicit units. Errors retain that speed scale. The paper fits saturated ultrasonic crack parameters from saturated velocities before producing frequency curves. Its published predictions had access to a different set of inputs.

## Constitutive assumption and controls

At fixed density, isotropic low-loss elasticity gives squared P speed x=(K+4G/3)/ρ and squared S speed y=G/ρ. When bulk and shear storage moduli vary affinely with the same scalar dispersion function and nonnegative amplitudes, y is affine in x with slope between 0 and 0.75 for nonzero combined amplitude. Applying this relation requires both modes to sample a common dispersion state. The acquisition description leaves their effective ultrasonic frequencies and losses uncertain. The comparison tests conditional recorded-value predictions.

The direct model fits the seismic pairs within each fluid and pressure and extrapolates to measured ultrasonic P. The candidate adds the signed gas residual in squared shear speed to the corresponding direct brine prediction before taking the square root. The 15 frozen roles include a cyclic next-pressure residual, unclipped ablations, fixed-Poisson and gas-increment alternatives. Forecast source `e2b8ea6375796c677dbd23f846c94961f46b975d` preceded the lock of 180 predictions at `9b8527658e27fc2eafd4088852afa977813d914e`. The 28,685-byte forecast SHA-256 is `e3da8843cb6f13d994d4c4d5fb1ac5e21bbe5149aaa4a4eb9579e658bbd0d2b6`. Acceptance required smaller RMSE and MAE and a majority of strict paired wins against each designated control, plus noninferior aggregate errors against both unclipped ablations. Coverage was complete.

| Role | Seven-pressure RMSE | MAE | Candidate wins / 7 | Five-pressure RMSE | MAE | Candidate wins / 5 |
|---|---:|---:|---:|---:|---:|---:|
| brine_last_shear | 32.821 | 30.137 | 0 | 53.921 | 52.349 | 0 |
| direct_constrained | 40.190 | 29.960 | 0 | 13.216 | 7.472 | 0 |
| direct_unbounded | 40.190 | 29.960 | 0 | 13.216 | 7.472 | 0 |
| gas_global_increment | 52.902 | 51.773 | 0 | 47.400 | 45.611 | 0 |
| gas_ultrasonic_shear | 61.108 | 57.718 | 0 | 65.751 | 62.195 | 0 |
| brine_last_poisson | 70.313 | 65.747 | 1 | 52.624 | 46.342 | 0 |
| brine_origin_regression | 72.630 | 67.837 | 1 | 80.027 | 74.792 | 2 |
| brine_mean_shear | 75.448 | 72.815 | 0 | 69.521 | 67.687 | 1 |
| gas_shear_increment | 78.588 | 76.581 | 0 | 65.767 | 61.584 | 0 |
| gas_shear_ratio | 80.706 | 78.643 | 0 | 65.989 | 61.557 | 0 |
| cyclic_residual | 125.752 | 120.431 | 4 | 94.125 | 88.884 | 3 |
| calibrated_constrained | 126.638 | 120.847 | 0 | 89.102 | 88.360 | 0 |
| calibrated_unbounded | 126.638 | 120.847 | 0 | 89.102 | 88.360 | 0 |
| all_shear_change | 188.638 | 182.880 | 6 | 173.926 | 166.370 | 4 |
| gas_ultrasonic_poisson | 285.378 | 281.010 | 7 | 255.576 | 254.680 | 5 |

## Pressure-specific failures

| Differential pressure (MPa) | Observed shear | Gas-corrected | Direct affine | Highest seismic shear | Added gas correction in speed |
|---:|---:|---:|---:|---:|---:|
| 1 | 1880.037 | 2091.407 | 1971.285 | 1835.239 | 120.122 |
| 3 | 1955.847 | 2057.072 | 1959.157 | 1920.678 | 97.916 |
| 5 | 2011.218 | 2102.561 | 2046.072 | 1985.654 | 56.489 |
| 8 | 2058.625 | 2169.006 | 2082.503 | 2036.077 | 86.503 |
| 10 | 2075.360 | 2193.973 | 2101.674 | 2065.845 | 92.299 |
| 15 | 2122.035 | 2233.885 | 2132.711 | 2098.637 | 101.174 |
| 20 | 2182.707 | 2283.851 | 2163.267 | 2132.739 | 120.584 |

At 1 MPa, measured brine ultrasonic P was 3496.494. The direct shear forecast gave 1971.285 against 1880.037 observed. The paired gas residual added 488017.8 squared-speed units, or 120.122 in final speed, raising the forecast to 2091.407 and the error to +211.370. The highest seismic shear gave 1835.239. The worst candidate error in the paper-range sensitivity was +95.577 at 15 MPa. All source frequency pairs, target values, role forecasts and signed errors at each worst pressure appear in `worst-cases.json`.

Across the five common pressures, changing just the registered upper seismic frequency from 128 to 100 Hz changes direct RMSE from 24.369 to 13.216. For the highest-seismic-shear control it changes from 29.314 to 53.921. This descriptive postscore comparison uses existing forecasts. The conservative squared-shear error amplification ranges from 5.685 to 8.979 on the primary panel. It bounds deterministic shear perturbations at fixed P. The data supply no measured instrument uncertainty for that bound. Every paired gas residual was positive and every corrected forecast exceeded the brine observation. The experiment leaves fluid-dependent response and cross-instrument effects as possible contributors.

## Reproduction

Run `python3 replay.py .` for the offline published-array verification. For raw execution run `predict.py`, then `score.py` with the frozen `forecasts.json` and `forecast-lock.json`. Raw readers require Python and a system libarchive supporting RAR. The independent receiver uses openpyxl 3.1.5 and libarchive-c 5.3. It fetched the unchanged 49,047-byte archive, read the four workbooks and evaluated affine fits by pairwise differences at 65-decimal-digit precision. It checked 180 forecasts, 180 residuals, 90 RMSE/MAE/worst-error values, 30 worst indices and 30 paired-win counts. Maximum forecast discrepancy was 7.39×10⁻¹³ and maximum metric discrepancy was 6.05×10⁻¹³. Both gates remained false. Six original native commands and complete stdout identities are recorded in `native-receipts.json`.
