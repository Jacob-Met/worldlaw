# Forced-cylinder motion and reported hydrodynamic coefficients

A distance based on the prescribed orbit, speed and acceleration improved on displacement alone. A Gaussian process that learned separate input length scales gave the lowest error. Across 260 subsequent entries in Deng’s towing-tank ledger, the orbit model scored 0.6032 and the Gaussian process scored 0.5000. All three development gates failed. The remaining 260 coefficient rows stayed sealed.

## What the source supports

The authenticated workbook has 920 positive forward designs. The first 80 cover 16 fixed combinations of the other inputs at phase angles of 0°, 90°, 180°, 270° and 360°. The other 840 are distinct recipes. The four independent angles in the first panel cannot resolve a response proportional to sin(2θ). The 0° and 360° prescriptions describe the same nominal orbit. The largest absolute difference in the corresponding reported coefficients was 0.623865757 for Ca1 between IDs 45 and 77. Their acquisition independence and the cause of that difference are unknown.

The original question concerned predicting free vibration from forced-motion work and acceleration balance. The two source releases did not establish a paired free-response target. The processing script calls DataDeal and loads information.mat. Its code can select reruns by forward/backward coefficient agreement. Neither dependency is among the nine standalone source/model objects and two ZIP files in the two records. The raw ZIP contains 69 text files. Its 55 distinct filename recipes have zero exact six-coordinate matches among the 920 parsed workbook recipes, including after separate 6-, 5-, 4- and 3-significant-digit diagnostics. Each of the two nominal 2D free-training MAT files contains both a 58×2 xtrain and a 58×1 ytrain variable in an optimizer workspace. No corresponding case/units crosswalk was established. The supplied free plotting script loads GPR_Model1.mat and labels its plotted output Cv. No supplied fitted model forms a prospective holdout baseline here.

The physical responses used below are the four published coefficient estimates for the forced designs. Source code identifies their ordered columns as transverse Cv1/Ca1 and inline Cv2/Ca2. The raw channel mapping, estimator calibration and common free/forced setup remain unresolved. No raw force or displacement values were decoded into scientific results. [Deng’s experimental release](https://doi.org/10.5281/zenodo.18398883) · [Deng and Fu’s model release](https://doi.org/10.5281/zenodo.18398037)

## Prediction task

Each prediction uses the two reported relative amplitudes and frequencies, inline phase and towing speed. The orbit kernel uses displacement, velocity and acceleration harmonic coefficients. The inline phase enters through its sine and cosine, both multiplied by inline amplitude. Each derivative multiplies the corresponding harmonic by its reported angular frequency. The four-channel output is a regression on prescribed conditions. Its kinematic features do not reconstruct a calibrated force. The smallest inline amplitude is 0.1 in the reported dimensionless coordinates. The limiting behavior at zero inline amplitude is an assumption outside this panel.

IDs 1–400 supplied the training coefficients and forward tuning folds. IDs 401–660 supplied the development targets, opened after locking all 8,320 scalar predictions. IDs 661–920 remain reserved. Numbering is the publisher’s ledger order. Its relation to acquisition times and resets is unverified. Some designs were adaptively chosen, so the score is conditional on those inputs. The kernel, control, tuning and acceptance definitions are recorded in protocol.json.

| Forecast | Standardized RMSE |
|---|---:|
| Periodic features with learned length scales (ARD Gaussian process) | 0.49996 |
| Scalar-angle kernel | 0.58479 |
| Conventional periodic kernel | 0.59295 |
| Displacement, velocity and acceleration kernel | 0.60315 |
| Boosted trees | 0.61820 |
| Displacement-only kernel | 0.62430 |
| Nearest periodic design | 0.92524 |
| Training mean | 0.95011 |

The score is the square root of the equally weighted mean of 1,040 squared errors after scaling each coefficient by its training standard deviation. In target order, the orbit model’s unscaled RMSEs were 0.81534, 2.00729, 1.20432 and 0.45883. The ARD model’s were 0.71761, 1.78868, 0.89210 and 0.36902. The orbit model failed the five-percent aggregate improvement, individual-channel and 95th-percentile guards. Its three successive block scores were 0.62471, 0.60707 and 0.57637. Its 95th-percentile row error was 1.30014 against 0.94788 for ARD.

Both models’ worst row was ID 490. At reported speed 0.1 and phase 134.032052°, Ca1 was −13.78347. The orbit model predicted +2.47687 and ARD predicted +2.28633. No matched raw record qualifies an explanation for this sign and magnitude error. score.json retains every development input and output, every method’s worst row, and all nominally equivalent corner measurements.

## Reproduce

Download initial_data_csv.zip from the experimental release. The ZIP’s SHA256 is d0110a8c08d1ed6239e18588cd8d947fef935b789a69559503b6f809fd6e24df. Its member initial_data.csv is an OOXML workbook. The reader selects the named columns and opens response cells only for the allowed IDs. The frozen runtime used NumPy 2.2.6, SciPy 1.15.3 and scikit-learn 1.7.2, with BLAS and OpenMP limited to one thread. Run in a fresh output directory using the actual source directory as STUDY.

```sh
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
python "$STUDY/forecast.py" initial_data_csv.zip forecast.json
python "$STUDY/score.py" initial_data_csv.zip forecast.json "$(sha256sum forecast.json | cut -d' ' -f1)" score.json
python "$STUDY/receive.py" .
```

The original forecast SHA256 is 7a5ca8ef4bd42c6d6772253496a219481c363222eb89b78ed3b9e166ce45c20a. The original score SHA256 is 10965880c992dc38edaf3c5cfb04e9d3a15f901d198d34e348f5c5e4d2a1f269. The independent standard-library receiver also runs directly on copies of the two saved files in an empty working directory. This experiment measures conditional prediction within this ledger. It supplies no independent free-vibration or cross-facility validation.
