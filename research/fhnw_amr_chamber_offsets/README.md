# Predicting an array's chamber offsets from coil calibrations

The calibrated field correction failed the registered transfer test. Across 63 chips and three output axes, it reduced RMSE from 0.0026774 for the prior chamber reading to 0.0026398 native readout units. The prespecified halfway update did better at **0.0025028**. The full correction also lost to persistence on X and Z and to the common-axis correction on Y. One board underwent one sequence of exposures.

| Frozen role | Overall RMSE | X | Y | Z | Observable-component RMSE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Calibrated common field | 0.0026398 |0.0029248 |0.0013228 |0.0032560 |0.0019148
| Prior chamber | 0.0026774 |0.0028795 |0.0017478 |0.0031874 |0.0019663
| Common-axis correction | 0.0026523 |0.0029414 |0.0013192 |0.0032729 |0.0019310
| Matched axial mean | 0.0030623 |0.0029317 |0.0015321 |0.0041463 |0.0024655
| Published plotting anchor | 1.0019270 |0.9775383 |1.0179661 |1.0098204 |0.0182387
| Raw three-pose intercept | 0.0135491 |0.0203796 |0.0111760 |0.0032404 |0.0019148
| Paired raw DC change | 0.0128360 |0.0011066 |0.0115173 |0.0189846 |0.0024422
| Projected paired change | 0.0030441 |0.0028935 |0.0020294 |0.0039127 |0.0024422
| Half calibrated update | 0.0025028 |0.0028783 |0.0014541 |0.0028969 |0.0017209
| Half common-axis update | 0.0025101 |0.0028808 |0.0014353 |0.0029227 |0.0017310
| Difference of corrected sessions | 0.0030384 |0.0028965 |0.0020179 |0.0039031 |0.0024344
| Earlier-chamber ridge change | 0.0120715 |0.0025559 |0.0054015 |0.0200364 |0.0022689

The candidate's largest absolute component error occurred on chip 37, Z. The chamber read −0.09035030, the full candidate predicted −0.08320660 and persistence predicted −0.08669318. The equal-axis correction predicted −0.08361095, and the stronger halfway update predicted −0.08494989. Its three raw coil-pose intercepts on that component were −0.10577243, −0.10369151 and −0.05030834. The full recorded target and all 12 forecast vectors for this chip are in `measured_chamber.json`.

## Recorded inputs and target

Vergne and colleagues mounted 64 MEMSIC MMC5603NJ chips on an 8×8 array. Chip 24 was damaged during assembly and excluded in their source code. A single-axis Helmholtz coil was used with three mounting orientations and seven signed current levels. Each raw file contains 300 repeats of IDs 1 to 64. The reader checked the exact row order across all 42 files in the post-3T and post-7T coil sessions. An independent Bartington zero-gauss chamber provided one three-component average per chip in each of those sessions. Only the earlier chamber was used to build forecasts. The later chamber was read after all 12 roles were locked. Its 4,139-byte file has SHA-256 b2577ae0ac57167ccd40fcc244b585d2edc290c95ded3e4cf59689d64f2ddad5.

The source author reports 30 minutes across three axes for the earlier 3T exposure and two minutes on one axis for the subsequent 7T exposure. Calibration occurred after exposure. Instrument remounting, time, background fields, chamber residual and exposure history are inseparable here. The experiment concerns independent chamber readout conditional on bench calibration of the same chips. It does not determine degradation caused by exposure.

The deposit describes mT for input file measurements as inferred from scripts. Commented chamber plotting code multiplies raw readings by 1000 for a µT label. An active coil-offset plotting branch uses a µT label without that conversion. The table is in the common serialized numerical units, with no conversion inferred from the held target. The dataset authors' reported comparison of parameter distributions addresses a different endpoint.

- [Vergne, FHNW and University of Basel, open measurements, code and file metadata](https://doi.org/10.5281/zenodo.24110229)
- [INTERMAG Short Papers 2023, experiment report](https://doi.org/10.1109/INTERMAGShortPapers58606.2023.10228508)

The authors license the measurements under CC BY 4.0 and their code under MIT, with a third-party exception documented in LICENSE.md. The study code here implements the declared analysis separately. The original source-only native catalog request failed DNS before receiving scientific inputs. The public catalog supplied all 89 filename/MD5 pairs. A separate native read verified the license, README, both MATLAB source copies and both plotting scripts.

## What the coil identifies

For each session and pose, fit the full three-channel intercept and signed slope per nominal ampere on the seven source level means. Symmetric currents make the intercept their arithmetic mean, independently of the author's 0.5836 mT/A scale or per-chip alignment multiplier. Stack the 63 three-by-three slope matrices into the 189-by-3 matrix M. The conditional model for stacked pose intercepts is cₐ = o + M hₐ, with one three-component ambient coefficient shared across chips in each pose. Then a change o → o + Mq, hₐ → hₐ − q leaves every source intercept unchanged. With rank three, 186 offset contrasts are estimable. The full forecast replaces the missing three-dimensional component with that of the earlier chamber vector z₃ and uses the mean over the three later coil poses for the observable component.

This calculation allows different coefficients in the three physical poses. It does not guarantee a common field across the board or stability of chip response. All measured local slope blocks were invertible, with worst condition number 1.047. Allowing each chip an unrestricted local field would therefore absorb any of its three offset components, removing that contrast identification. A chamber reading can itself include residual fields.

The largest 3T-to-7T change of response subspace was 0.09753°. The later calibrated subspace lay within 1.38310° of equal common-axis subtraction. The operator-norm difference between these projections was 0.0241373. Applied to the current common-offset norm, the calibrated projection could change the equal-axis estimate by at most 0.000301323 RMS; the measured forecast difference was 0.000279755. These quantities establish the limited difference between predictors, not an upper bound on their errors.

On leave-one-chip-out calibration at 3T the measured model improved all three axes over the equal-axis control. At 7T the RMS three-pose mismatch outside the response subspace reached 0.001779 for the Z output in the Z pose. The source improvement did not transfer as a joint win. Both the full candidate and the prior share a 0.00181720 gauge-component RMSE by construction. Their observable components differ. The half update delivered a lower observable-component RMSE than either endpoint.

## Comparators and custody

The original MATLAB estimator uses the readout axis corresponding to each coil pose and fits a line to seven current levels. The author's later plotting script centers these intercepts separately per axis and adds 0.9921. That literal is absent from their README and both deposited MATLAB copies, and no independent-session origin was established for it. This historical plotting comparator was retained exactly and excluded from the matched forecast gate. The same affine centering with independent 3T chamber axis means is an eligible control. Other controls include persistence, all-pose common-axis subtraction, paired coil differences, fixed halfway updates and a multivariate ridge fit selected only by leave-one-chip-out 3T error. No 7T chamber values adjusted a parameter, sensor, axis, scale or metric.

The prospective source was frozen at 6e868c26572e8cbcb08226adecbd8a057d9f2400. The 83,629-byte twelve-role forecast archive was locked and read back at f0827d84ceee264a61c646351888151ae03ea672, SHA-256 35c445c98b4c09d863d8a8905a1ca33bce91740fb5ea23bd00ad263316e79f76. Both 3T and 7T chamber file digests were unique in the 89-file deposit. The two duplicated file pairs were MATLAB scripts and precomputed alignment coefficients. The reader uses the original array order without the damaged chip.

Run `python3 replay.py` for the standard-library receiver. It reconstructs the intercepts and slopes from 7,938 stored level means, solves the three-dimensional gauge by pivoted elimination, and checks all 2,268 component residuals against the 189 measured outputs. The candidate agreed within 1.39×10⁻¹⁷ and the metric maximum discrepancy was 6.67×10⁻¹⁶ in stored native units. The replay verifies the stored measurement and forecast course without a new acquisition of the 300 raw samples per chip and current level.
