# Forecasting image dynamics of two-size colloid mixtures

A model of correlated particle motion missed all four admission criteria when predicting the measured image dynamics of four calibration mixtures. The best empirical control, a radial basis function (RBF) on the known optical recipe, achieved a mean normalized error of 0.09847. The correlated-motion model achieved 0.17814 and lost on each preparation. The three development and three reserve mixture responses remain unopened.

## What was observed

Bradley et al. released differential dynamic microscopy (DDM) data and fits for suspensions of nominally 240 nm and 1,100 nm particles. We use Section 5 of the processed archive. Each composition has one capillary preparation and five successive videos. A preparation receives one vote. The five videos measure variation within that preparation. They do not establish five independent mixture preparations. Source data and article are available from the [University of Edinburgh](https://doi.org/10.7488/ds/3851) and [Soft Matter](https://doi.org/10.1039/D3SM00593C).

The preparation key is the known mass fraction of large-particle stock in the mix. Both stocks have the same stated particle mass fraction. Converting a mass fraction to particle numbers or optical weight also requires material density and a scattering/contrast model. Under a constant optical ratio, rounding the paper’s ten expected small-particle percentages to the nearest percentage point admits a large-to-small optical ratio from 57.774 to 58.143. A nominal size-cubed point-scatter ratio gives 96.282. We retain both the authors’ expected weights and a nominal sphere form-factor calculation as distinct controls. The Table 1 weights are author expectations, independent of the fitted mixture weights. Pure-parent data and calibration recipes supply all fitted quantities.

The archive contains 12 positions with five videos apiece. After reading the two pure parents (0% and 100% large) we opened the 0.02%, 1%, 10% and 70% calibration preparations. Each forecast uses the other three calibration preparations and the two parents. We exclude all released mixture fit files. The 0.1%, 2.5% and 25% development mixtures and the 0.5%, 5% and 50% reserve mixtures were never opened. Our source screen had encountered the paper’s qualitative discussion and illustrative fitted percentages for a separate trimodal mixture. Neither the trimodal experiment nor its numerical fit enters this study.

## Forecast and controls

The target is the measured difference between the image structure function at each lag and its value at 0.01 s. There are 35 Fourier annuli, bins 36–70, and 123 later lags through 31.35 s. Each curve is predicted from the known recipe and training data. The held calibration video supplies no input, offset, fitted gain, or normalization to the primary forecast. The author’s single-spike fit is checked against the raw pure-parent structure functions, their standard errors and the reported reduced chi-squared. Third-order cumulant curves and discrete CONTIN spectra provide additional authentic parent-fit controls.

The candidate assigns each component a stationary Ornstein–Uhlenbeck process whose decay rate is its pure-parent diffusion coefficient times squared wavenumber. The driving noises can correlate within each of three fixed Fourier bands. The average over all 25 small/large pure-video combinations determines the lag-dependent cross term. Three coefficients constrained to [−1,1] are fitted on the three other calibration preparations. The candidate is compared with eleven controls, including the raw pure parent curves, three author-fit parent forecasts, the paper’s Table 1 recipe, a nominal sphere form factor, linear interpolation on raw or optical recipe coordinates, one shared gain, two nonnegative component gains per band, and an optical-recipe RBF with fixed bandwidth 0.25 and ridge 0.05. All eligible mixture-trained methods receive the same three calibration recipes.

Primary error is RMS over all annuli and non-anchor lags after dividing by the parent amplitude predicted from the composition, then averaged over the five videos and equally over the four preparations. A secondary shape score rescales the observed and predicted curves separately by the mean of their final four lag values, before the same RMS and equal-weight reduction. This secondary metric uses measured endpoints for scoring only. The 20 videos give 86,100 video–annulus–lag contrasts. They are repeated measurements in four capillaries.

## Frozen decision and worst cases

| Admission criterion | Observed |
| --- | --- |
| Mean primary error ≤ 0.98 times the best single control | 1.8091 times optical RBF |
| Smaller primary error on at least two preparations | 0 of 4 |
| Largest preparation error ratio ≤ 1.20 | 3.3513 |
| Mean shape error ≤ 1.05 times the best shape control | 1.1515 times author Table 1 |

In increasing large-particle fraction, the primary error ratios against optical RBF are 2.3610, 3.3513, 1.1735 and 1.4022. At 10% large particles, video 5, wavenumber 1.020719 µm⁻¹ and lag 27.08 s, the measured lag difference was 88,941,864 and the model predicted 54,332,259, a normalized residual of −0.62682. At 1%, video 4, 1.756097 µm⁻¹ and 13.68 s, the measured difference was 3,078,291 and the prediction was 5,297,489, a residual of +0.56353. These values are image-contrast units. The frozen output includes the five measured curves and all twelve forecasts at each preparation’s worst candidate annulus.

The fitted correlations also change sign. With the 1% preparation omitted, the three estimates are about +0.599, +0.493 and +0.548. With 10% omitted, they are −0.017, −0.052 and +0.001. Moreover, identical pure-parent curves are consistent with different mixture curves. The exact two-component example in `proof.py` has the same parent dynamics and mixture values of 31/5 or 54/5 at lag ln(2), depending on the noise correlation. For either case, an independent-component model with different positive optical gains reproduces the complete mixture curve. The measured errors reject this forecast on the calibration preparations. They do not estimate physical coupling in the material.

## Reproduction

Use Python 3.11 or newer and NumPy. Download the publisher’s `Processed_Data.zip`, SHA-256 `b73d27b4a383dba28b1e1e71ad78a45910cd11cbbef2ef4c5dc7c149d6a01182`. From this directory run

```sh
python proof.py
python replay.py /path/to/Processed_Data.zip --output replay-result.json
```

The reader authenticates the archive, checks the Section 5 preparation/video roster, reconstructs the ten parent fits and reads only the two pure and four calibration preparations. The replay compares 96 error scores, all 48 method/preparation worst rows, correlations, and all four worst-annulus curve sets with the original `frozen.json` (SHA-256 `3a2732763098548128bc0e5bd00b745da554daf2193d63ea95549e2bf9b4bbb4`). Early placement refusals and source DNS failures produced no scientific scores. An early index query counted 85 structure functions because it included other sections. Restricting the index to the exact Section 5 directory gives 60. The failed calibration gate ended this course before either later panel.
