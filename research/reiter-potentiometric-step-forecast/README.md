# Forecasting twelve-hour cell voltage from six hours of a temperature step

On the development cell, a seven-mode relaxation model predicted terminal voltage with a mean condition RMSE of **20.43 μV**. A ridge regression trained on the same cell histories reached **12.15 μV** and had lower error for all four state-of-charge and approach-direction combinations. The relaxation model passed coverage and failed all three accuracy requirements. The two reserved cells and their reserved state-of-charge recordings remain unopened.

Reiter and colleagues measured terminal voltage, current and surface temperature while full cells underwent a programmed sequence of thermal steps. Their published paper examines potentiometric entropy variation and the effects of voltage drift, aging and temperature history. Here the forecast target is the arithmetic mean of the recorded terminal voltage between 11.5 and 12 hours after the instrument's step marker. Electrical relaxation and self-discharge may continue beyond that endpoint. This experiment evaluates a finite-time voltage forecast on the released apparatus. [Primary study](https://doi.org/10.1016/j.est.2025.118897) · [Measurement release and README](https://doi.org/10.17605/OSF.IO/6X5TF)

## Inputs and split

The 18 pristine full-cell files each contain four simultaneous cell records on a shared clock and chamber schedule. The author release supplies explicit column names for voltage, current, cell temperature, ambient temperature, time and step index. Each file has 21 distinct index runs. Step 0 is an initial rest. Steps 2 through 38 last approximately 12 hours. Step 40 lasts approximately 24 hours in every recording. Its endpoint is still taken at 11.5–12 hours. A duplicate timestamp occurs once in each file, with no reversed time. The extractor groups by the authored step index before computing relative time and retains the recorded samples.

| Role | Cell | State of charge | SOC approach direction | Eligible stages |
|---|---|---|---|---:|
| Training | A1 | 10%, 30%, 50%, 70%, 90% | Charge and discharge | 199 of 200 |
| Development | A2 | 20%, 60% | Charge and discharge | 80 of 80 |
| Reserved, same cell design | A3 | 40%, 80% | Charge and discharge | Unopened |
| Reserved, different cell design | B | 40%, 80% | Charge and discharge | Unopened |

“Charge” and “discharge” denote the electrical approach to the state of charge before the chamber sequence. Near-minute sampling supplies 12 half-hour prefix means. Each bin must contain at least 20 samples, with no internal gap over 150 seconds and a sample within 150 seconds of each boundary. The target window uses the same clock criteria. In the A1 70% discharge file, step 22 contains a 5,640.36-second gap. Four required prefix bins failed and the stage was excluded. The development set has complete clock support. Conditions use distinct chamber files across training, development and reserve. Steps within a file share a history. A3 and B share the same reserved chamber conditions. Replicate counts and confidence intervals based on independent stage noise would be unjustified.

Models receive only that cell's six-hour voltage and surface-temperature prefix, its observed ambient-temperature prefix and the scheduled condition. No other cell or future measured forcing enters a prediction. The source paper's retrospective drift correction estimates a slope from hours 6–12 of the measured step. Our controls include a strictly prefix-based late linear fit and a prefix-based temperature-plus-drift extrapolation. The physical comparison uses raw voltage. A retrospective drift correction would change both the information budget and the measured endpoint.

## Source fit and development errors

The candidate combines seven exponentially decaying voltage modes with an affine mean in time and cell surface temperature. Forecast weights reproduce that affine mean exactly on supported inputs. The assumed future surface temperature is the mean of the last four prefix bins. The 11.75-hour time target is the center of the scoring window. Five timescale multipliers and six diagonal noise levels are ranked by equal-condition training RMSE on A1. The winning multiplier was 0.25 and the noise level was 0.0001. This finite covariance model admits signed modal amplitudes and allows thermal and electrical effects to coexist. The covariance gives minimum model-based prediction variance within that stipulated prior and mean space. The observed loss and large absolute weight sum show why this qualification matters when drift, temperature or measurement errors differ from the prior. The fitted timescales do not identify a cell mechanism.

The source-trained generic controls choose regularization or tree size by leaving out whole training SOC values. The matched-stage comparator interpolates A1 endpoint corrections between available training SOCs at the same step and approach direction. The mean below gives equal weight to the four condition-specific RMSEs. Each condition has 20 forecasts. All numbers are in μV.

| Method | 20% charge | 20% discharge | 60% charge | 60% discharge | Mean |
|---|---:|---:|---:|---:|---:|
| Last prefix bin | 203.31 | 215.86 | 325.12 | 42.64 | 196.73 |
| Matched-stage interpolation | 87.07 | 346.21 | 174.48 | 12.08 | 154.96 |
| Gradient boosting | 167.08 | 90.45 | 270.24 | 103.07 | 157.71 |
| Temperature plus drift | 43.95 | 86.52 | 63.55 | 21.34 | 53.84 |
| Late linear drift | 30.30 | 45.68 | 46.00 | 14.76 | 34.18 |
| Ridge | 12.40 | 16.07 | 10.62 | 9.50 | 12.15 |
| Seven-mode candidate | 15.47 | 26.29 | 18.33 | 21.63 | 20.43 |

The four registered requirements were complete coverage, mean RMSE at most 95% of the strongest control's mean, every condition RMSE at most 105% of that same control's value, and worst absolute error at most 110% of its worst. The joint gate failed. The largest candidate and ridge errors occurred at A2 20% discharge, the fourth temperature step. The observed 11.5–12-hour mean was 3.45349016 V. The candidate forecast was high by 84.53 μV and ridge was high by 59.40 μV. The raw near-six-hour sample was 3.45282742 V at 54.0872 °C, and the final sample was 3.45351452 V at 54.1063 °C. A separate 60% charge step rose in temperature while its voltage fell. No single causal explanation follows from those two trajectories. The maximum sum of absolute forecast weights was 33.05, which bounds the model's response to a uniformly bounded perturbation of prefix voltages with all other inputs held fixed. The data do not establish that these numerical errors exceed systematic instrument uncertainty.

## Replay

Download the authors' `MeasurementData.zip` from the linked OSF release. The archive is 378,222,387 bytes with SHA-256 `6d573268a2dec98397ed6b04158103d58b8989fb7490a45d7d239ee0aa570942`. An original HTTP fetch returned a short 334,888,960-byte body. An independently checked HTTP 206 continuation provided the final 43,333,427 bytes and restored the exact published hash. The failed intake stopped before opening any member.

Use Python 3.11 or newer with NumPy 2.2.6, SciPy 1.15.3 and scikit-learn 1.6.1.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python research/reiter-potentiometric-step-forecast/replay.py /path/to/MeasurementData.zip
```

The script authenticates the whole ZIP, opens only training and development condition files, and decodes only the assigned cell's permitted channels and windows. It recomputes all 480 control forecasts, checks 80 real endpoints, and independently reconstructs all 5,970 calibration-grid forecasts and 80 candidate forecasts using a direct saddle-point solve. The separate algebra controls distinguish exact finite prefix interpolation in a signed exponential family from the stronger shape restrictions needed to bound a long-time extrapolation. The authors' qualitative findings on a separate repeated-cycle arm were known during source qualification. Neither those records nor the reserved target channels were used here.
