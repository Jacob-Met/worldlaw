# Forced response of a jointed beam from independent shaker decay

A model fitted to full-field beam displacements **lost to the authors’ accelerometer backbone** on eight response-controlled frequency sweeps. Mean normalized force-shape RMSE rose from **0.139675 to 0.291096**. The worst individual sweep rose from **0.259344 to 0.490944**. With the phase units specified in the measurement file, mean folded-phase error rose from **5.3018° to 12.2045°**. All eight sweeps and all 328 measured frequency steps enter these numbers.

## Reproduce the measurement

Use Python with NumPy and SciPy. The command downloads three original author MAT files (about 86 MB combined) and verifies each SHA-256. For a local replay, supply `--data-dir` containing unmodified `ShakerRingdown.mat`, `data.mat` from the author’s SSMLearn example, and `ForcedFrequencyResponses.mat`. Add `--details` for every sweep, model and worst row.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python research/jointed-beam-response/replay.py --check
```

The replay fits five fixed models from the independent ringdown, reads only the frequency and realized acceleration amplitude from each response-controlled sweep, and builds the entire set of predictions. A separate read then opens the force and phase targets. The four force-controlled sweeps stay numerically unopened in fitting, prediction, scoring and the independent recount. The original compressed MAT container passes through the reader as one file. The reader interprets numeric arrays only for the specified fields.

## A unit error reversed the phase comparison

The data authors’ `showData.mlx` plotted unconverted phase values with a degree axis label. The registered receiver followed that label. With that conversion it reported 36.9220° for the author PFF model and 31.2527° for the spatial-energy model. **That apparent improvement was an analysis error.** Each of the eight `FRdata.ResponseControl(i).units` strings says exactly `Hz, N, m/s^2, rad`. After the original outcome opened, an independent receiver read those strings, and we recalculated angles from radians using the same 1,640 frozen predictions of phase and force shape. No parameter or prediction changed. The degree-based receiver is retained for reproducibility.

| Model | Corrected phase MAE (°) | Original degree-reader MAE (°) | Force-shape RMSE | Worst sweep shape RMSE |
|---|---:|---:|---:|---:|
| acceleration-only | 10.4231 | 32.7028 | 0.250068 | 0.426550 |
| author-PFF | 5.3018 | 36.9220 | 0.139675 | 0.259344 |
| constant-linear | 20.5426 | 17.6383 | 0.189304 | 0.294679 |
| constant-shape | 12.2433 | 30.9887 | 0.291829 | 0.492676 |
| spatial-energy | 12.2045 | 31.2527 | 0.291096 | 0.490944 |

The registered test required lower equally weighted mean phase error and force-shape error than author-PFF, and a worst sweep force-shape error no larger than author-PFF’s. Two force tests failed with either angle conversion. Once the measurement units are used, all three comparisons favor author-PFF. The direct accelerometer control and constant-shape ablation also show how small a difference the estimated spatial mass variation made on this apparatus.

## What the model predicts

The experiment concerns a free-free steel beam with a bolted lap joint. In response control, the shaker system regulates the measured response amplitude. We conditioned every calculation on the **realized fundamental acceleration amplitude** at the collocated force/sensor site and the applied frequency. Each of the eight curves has 41 increasing-frequency steps. The source does not give a descending continuation for this comparison.

With angular frequency Ω, the harmonic displacement amplitude is acceleration amplitude divided by Ω². The displacement-to-acceleration phase shift is π. The registered phase metric folds relative phase to 0–90° as `atan2(abs(sin(phi)), abs(cos(phi)))`. This comparison removes sensor-polarity and transform-sign ambiguities, and measures distance from alignment toward quadrature.

The spatial model estimates the local displacement amplitude, frequency, spatial kinetic-energy proxy and decay rate in 115 windows of the independent optical ringdown. It interpolates the measured displacement field to the source’s collocated accelerometer position, 643.8 mm. Its effective mass factor is the spatial mean of squared fundamental displacement amplitude divided by that value at the sensor. The energy proxy is proportional to frequency squared times that spatial mean. A local viscous-equivalent approximation uses the negative time derivative of the log energy as a loss coefficient. The complex dynamic stiffness combines that coefficient, local frequency and the spatial mass factor. These are single-mode assumptions about transferring decay to forcing.

The measured-source PFF control uses the authors’ released peak-finding and fitting tables for the same accelerometer. All 272,128 samples of its acceleration row match Rice acc3 exactly. Its time coordinate equals the Rice coordinate minus 30.332242 s. The separate author metadata describes damping in percent while the plotting code multiplies the stored values by 100. In 36 independent 19-peak blocks of the training acceleration, interpreting the storage as a ratio gave 0.02434/s RMSE against observed logarithmic decay. Treating it as a percent gave 0.98515/s. The original SSMLearn example fits an autonomous DIC model and checks reconstructed accelerations on this same decay. Its released PFF tables provide the measured backbone used here. This course did not execute or benchmark a calibrated forced-response SSMLearn model.

Neither the hammer MAT nor the shaker-ringdown MAT contains an applied force waveform. The cited 300 N hammer peak leaves impulse unknown. A constant input coupling multiplies the predicted force curve, so it cancels from its unit-RMS shape. Each prediction uses **its own** full-sweep RMS; only the measured target is divided by the measured sweep RMS. This experiment does not identify force in newtons from a free decay. All observed curve RMS values were positive, with a minimum of 0.179864 N.

## Where transfer failed

The optical decay supported local displacement amplitudes from 8.55 to 133.93 μm. All 205 steps in the five highest-amplitude sweeps exceeded the fitted optical support. The predeclared receiver clamped each fitted coefficient at the upper endpoint and retained those sweeps in full. The authors’ PFF table covered 0.129 to 229.70 μm. Optical spatial-mass ratios varied from 0.9964 to 1.0423 within the training support.

The largest force-shape error was on the last step of sweep 8. At 81.2 Hz and a measured acceleration amplitude of 80.3742 m/s², the force measured 3.24225 N. Its sweep RMS was 3.47633 N, giving a normalized target of 0.932664. The spatial model predicted 1.770522, a difference of 0.837858. The model’s optical coefficients were at their upper clamp there. The clamp and different experimental excitation are relevant limitations; this measurement cannot isolate one cause.

The largest corrected phase error was also in sweep 8. At 80.45 Hz the raw phase was −1.592890 rad, giving a folded phase of 88.7341°. The spatial model predicted 32.2486°, an error of −56.4856°.

The independent receiver recounted 3,280 predicted scalar components and 80 raw worst-row witnesses. Its largest difference from the original receiver was 1.42×10⁻¹⁴. The registered force-shape failures use the original units and survive the phase correction.

## Sources and frozen records

Rice’s measurements, author notebook and publications are at [BRBtesting, commit 2d42d3a6](https://github.com/mattiacenedese/BRBtesting/tree/2d42d3a618206da58642674d3287ae34dfc7d5e5). The independent decay recording and the authors’ published PFF backbone are documented in the [SSMLearn jointed-beam example, commit 30558111](https://github.com/haller-group/SSMLearn/tree/305581114f62239b70c1fe44bce69cbf939326ea/examples/brakereussbeam). The measurement and identification papers are [Chen et al., Part I](https://doi.org/10.1016/j.ymssp.2021.108401) and [Jin et al., Part II](https://doi.org/10.1016/j.ymssp.2021.108402).

The prospective contract, original outcome, source-unit evidence, per-curve scores and raw worst cases accompany the source. The contract preceded training and any numeric forced-response access. The coefficient and forecast locks preceded the corresponding input and outcome openings.
