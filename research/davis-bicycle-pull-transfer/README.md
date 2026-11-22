# Transferring the response to a lateral pull between bicycle runs

The five-run transfer test did not support adding the projected roll equation. With identical measurements and impulse-response basis, the unpenalized spline had lower standardized error on both roll and steer and on three of five runs. Its loss was 0.415581, compared with 0.415741 for the projected model. The projected model improved on the author FIR by 1.25% on the held runs. It had already lost to that FIR and to the sign-reversed mechanical penalty in source-to-source transfer.

The held observations cover 72,719 time samples in five separate repetitions by one rider. The comparison unit is the run. All 40 forecasts were locked before the scoring process decoded held roll and steer. Two public model initializers had been seen during source inspection, and all five held initializers were excluded from every prediction.

## Five held repetitions

Lower loss indicates smaller squared angle error in units of the matching source runs' angle variance. Each coordinate and run receives equal weight.

| Method | Roll | Steer | Mean |
| --- | ---: | ---: | ---: |
| Unpenalized spline | 0.432521 | 0.398641 | 0.415581 |
| Projected roll equation | 0.432742 | 0.398740 | 0.415741 |
| Author FIR | 0.441699 | 0.400298 | 0.420999 |
| Sign-reversed penalty | 0.445980 | 0.401837 | 0.423908 |
| Source-refitted controller | 1.002375 | 0.916845 | 0.959610 |
| Source-initialized controller | 1.208228 | 1.103625 | 1.155927 |
| Zero anomaly | 0.966778 | 1.021947 | 0.994362 |
| Source-refitted controller with held mean wheel speed (supplemental) | 0.494488 | 0.448393 | 0.471440 |

| Held run | Scored samples | Projected | Unpenalized | Author FIR | Sign-reversed |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 186 | 10,533 | 0.409726 | 0.412869 | 0.418695 | 0.403630 |
| 192 | 11,240 | 0.341002 | 0.339031 | 0.331038 | 0.360654 |
| 250 | 17,356 | 0.412253 | 0.412201 | 0.442552 | 0.413351 |
| 253 | 17,162 | 0.365225 | 0.365339 | 0.371387 | 0.355412 |
| 257 | 16,428 | 0.550498 | 0.548465 | 0.541321 | 0.586494 |

The projected model beat the author FIR on three runs. The author FIR was strongest at 5.8 and 7 m/s. Measured mean wheel speed improved the supplemental refitted controller substantially, from 0.959610 to 0.471440. Its extra held input makes it a separate comparison. On the descriptive three-run subset whose published initializers had stayed unseen, the unpenalized, projected and author FIR losses were 0.372190, 0.372827 and 0.381659.

The largest standardized projected-model error occurred on the first measured sample of run 192. Raw roll was 0.137248 rad. Its deviation from the run mean was 0.136043 rad, or 6.025 source standard deviations. All eight forecasts were effectively zero. The raw force was 0.158437 N and the drift-adjusted value was 1.764654 N. No preceding force or angle history was available inside this recording. All 11,240 scored samples from the run, including this boundary sample, remain in the totals. The complete original raw episode, all eight forecasts and the independent raw-array verification are identified in the receipts.

These observations support comparing offline force-conditioned responses for this rider at these five speeds. The differences between models do not establish how the rider produced the measured response. Each speed was recorded on only one of two dates.

A balancing rider can steer or lean while an external operator pushes or pulls beneath the saddle. This study asks whether the roll equation of a bicycle with a rigid rider helps predict the next independently recorded roll and steer response at the same treadmill speed. The physical measurement is the force along an inline load cell. The ball joint lets the experimenter apply a force that is mostly lateral while avoiding an applied moment at the joint. Off-axis force and unmeasured rider actions can affect the true roll equation.

## Runs and signals

The paper subset contains 15 runs from one rider on a horse treadmill. All were recorded at 200 Hz using the same balance-with-disturbance task. The selected experiment contains three runs at each of five desired speeds. All 15 have clear warning and corruption flags. The release dates place the 3 and 5.8 m/s runs on March 9, 2011, and the others on August 30, 2011. Each target is a separate run from the same rider, speed and date as its two source runs.

| Desired speed (m/s) | Source runs | Held run |
| ---: | --- | ---: |
| 2 | 248, 249 | 250 |
| 3 | 184, 185 | 186 |
| 4 | 251, 252 | 253 |
| 5.8 | 190, 191 | 192 |
| 7 | 255, 256 | 257 |

The force channel is a calibrated inline force measurement in newtons. The author's reader reverses its sign in source run 184. All methods use the same sign correction and the original input-defined crop and drift correction. The crop depends on the first and last force crossing of 50 N. The correction fits a line between the beginning and ending force means. The released time alignment compares two vertical accelerometers and interpolates the acquisition streams. These choices support offline prediction conditional on the recorded forces. Online availability at the acquisition instant was not evaluated.

The recorded field `Speed` is the desired speed. The primary methods use that scalar. The author's `ForwardSpeed` is calculated from the rear-wheel angular rate and radius. The author fits use its run mean on the source run, and one separately reported comparison also supplies the measured mean for the held run. The reconstructed `SteerTorque` uses the contemporaneous steer angle, fork and frame angular rates and derivatives, linear acceleration and a steering-column torque measurement. It is excluded from every forecast. Both held orientations are decoded together only in the score process.

## Physical model

For small generalized angles q = (roll, steer), the released model is M q″ + v C₁ q′ + (g K₀ + v² K₂)q = H F + e₂ τ. The released force vector is H = (0.91, 0.014408). The first generalized equation eliminates steering torque τ. It retains a contribution from steer acceleration through M₁₂. Rider lean, reaction forces at the pedals or seat, large responses, and deviations from the intended force direction can violate its assumptions.

We fit two smooth causal impulse responses to the training runs. The candidate adds a penalty for violating the first generalized equation. It integrates the equation against compact smooth test functions and transfers derivatives onto those functions. This avoids taking second differences of noisy measured angles. The control with the same functional basis omits the penalty. A separate sham reverses the sign of all steer contributions to the roll equation. Each selects its strength using only the ten source-to-source folds. A synthetic closed-loop system compatible with the source equations gave a maximum physical weak residual of 9.24×10⁻⁶ at the finest 0.5 ms integration spacing across 2, 4 and 7 m/s. The sign reversal gave residuals from 1.04 to 1.74 in that construction.

## Published comparisons

The nonparametric comparison implements the released 1,025-tap zero-extended Markov regression, the same fourth-order Butterworth smoothing and the author's taper, followed by causal convolution over nonnegative lags. Its implicit cross-products match a literal dense design in three synthetic tests within 1.6×10⁻¹². The original MATLAB aggregate function computes the remnant expression but then assigns an undefined variable to the returned remnant field. Its impulse-response prediction is already computed at that point. We retained the source defect and computed the intended difference in the independent numeric comparison.

The published model-5 comparison uses the source bicycle matrices, the four active controller parameters, and the second-order 2.17 Hz neuromuscular filter. Source-only initializers and separately source-refitted models are averaged within speed. The portable refit uses SciPy least squares and the original source trial's estimated force-related steer response, with a maximum of 45 function evaluations. The linear interpolation of the input is checked against an independent state-space solver. MATLAB and Octave were unavailable on the native run. Differences in optimizer and numerical implementation remain part of the comparison's scope.

## Exposure and score

The split and impulse-response source were fixed before the measured development signals. A source excerpt then exposed the public model-5 **initializers** for two of the five held IDs, 186 and 257. No held model initialization entered a fit, estimate or forecast. The published five-run gate is retained, and runs 192, 250 and 253 form a descriptive subset with no such source exposure. The five held orientation trajectories were separately sealed. Trial 184's pull sign was fixed from the author's reader.

The error for each run and coordinate is the mean squared error of the estimated angle anomaly, divided by the average within-run variance from its two training runs. Each run and coordinate receives equal weight. The scorer removes the measured held run's mean after the forecast lock to define the reference anomaly. It separately reports error against the uncentered observed angles in radians. Predictions and normalization factors are locked before that calculation. The physical model must beat every matched primary comparator and the independently tuned sign sham on the prespecified five-run average.

## Source comparisons

In ten source-to-source folds, the projected model scored 0.574139. The original source FIR scored 0.572437, the sign-reversal control 0.572324 and the unconstrained smooth fit 0.574830. The two source feedback-model variants scored 2.065893 and 1.889674. The zero-anomaly comparison scored 1.052590. Lower values are better. These source results favor the empirical FIR and the sham. The projected model's most extreme source error occurred in run 190, sample 8666, when the measured steer angle was −0.772298 rad and the source-run-191 forecast was −0.001066 rad against a centered target of −0.769429 rad.

The preceding 0.25 s of adjusted pull in that episode ranged from −0.394 to +0.350 N. The complete 11,286-row measurement includes a −336.687 N pull 2.815 s earlier. Its presence establishes recorded input history only.

## Reproduction

The forecast program writes eight arrays per held run, with hashes for every array. The scoring program verifies the whole archive, each run archive and each array before using the held orientations. A separately implemented fresh-process receiver fetched the original measurement release, reconstructed each crop and source variance, and recomputed all 80 run-by-coordinate results in extended precision. Its receipt agrees on all 32 primary and supplemental mean coordinates, all six run-win counts, the worst-sample indices and the failed gate.

Run `python replay_course.py --predictions /path/to/predictions.zip` from this directory to receive the original forecast bytes. Running without the option regenerates the forecasts and requires their complete byte identity before scoring. The replay fetches the public 29,445,451-byte measurement release from Figshare and verifies its digest. The ten-fold source search took 54.585 s on one allocated CPU. The original source and held episode digests are listed in `numerical-custody.json`. The held receipt also includes every per-coordinate RMSE in radians against centered and uncentered observations and each run's largest standardized error.

## Primary sources

- [Schwab, de Lange, Happee and Moore, rider-control experiment](https://doi.org/10.1177/1464419313492317)
- [Released 15-run measurements and author analysis code](https://doi.org/10.6084/m9.figshare.659465.v4)
- [Raw experiment metadata and run-definition source](https://doi.org/10.6084/m9.figshare.1164632.v1)
- [RiderID source](https://github.com/moorepants/RiderID/tree/694a4252585a88dcc3c83a459ad1b76e6fec0864)
- [BicycleDataProcessor source](https://github.com/moorepants/BicycleDataProcessor/tree/fafe2e2c7a7caf5d6bdbd2698a8a91a1a2223cd8)
- [Author's instrument and lateral-force description](https://moorepants.github.io/dissertation/davisbicycle.html)
