# Temperature transfer of Mn⁴⁺ anti-Stokes emission profiles

The fixed mode-energy model lost to the empirical temperature-slope control on all ten held temperature profiles. It also increased the mean absolute error over carrying forward the last development blue profile. The test concerned the registered, normalized spectral shapes across temperature settings in the KSF and MGO preparations. Zhang and colleagues' published results concern intensity ratios of vibronic bands and temperature sensing. Their historical fitted thermometry results remain separate from the whole-profile calculations here.

| Method | Macro MAE | Macro RMSE | KSF MAE | MGO MAE |
| --- | ---: | ---: | ---: | ---: |
| `fit_blue_red_slope` | 0.018171 | 0.023029 | 0.025289 | 0.011054 |
| `fit_blue_slope` | 0.019135 | 0.031857 | 0.030485 | 0.007785 |
| `blue_mode_thermal` | 0.045144 | 0.069956 | 0.063641 | 0.026647 |
| `blue_persistence` | 0.057075 | 0.073559 | 0.067197 | 0.046952 |
| `red_ratio` | 0.081543 | 0.116663 | 0.112398 | 0.050688 |
| `red_ratio_mode_thermal` | 0.087235 | 0.128695 | 0.145125 | 0.029345 |
| `red_ratio_detuning_thermal` | 0.093271 | 0.136919 | 0.150935 | 0.035607 |
| `optical_detuning` | 0.112221 | 0.144858 | 0.153545 | 0.070897 |
| `optical_mode` | 0.120329 | 0.146719 | 0.122826 | 0.117832 |
| `zero` | 0.414353 | 0.516364 | 0.452450 | 0.376257 |

Each error is in units of the mean red-side intensity on the prescribed sampling grid of that scan. Each temperature has equal weight within its host, and both hosts have equal weight. The smallest KSF MAE came from the empirical slope of the blue-to-red ratio. In MGO, extrapolating the blue intensity alone gave the smallest MAE and RMSE. See `protocol.json` for all three acceptance conditions and `result.json` for every temperature and native interpolation bracket.

## What was measured

The author archive contains 21 figure/table workbooks and a readme. Its 3,809,363 bytes match SHA-256 `f54f7e108c16e1bbce3b68da3069f9453e5e43f6ca8c8f438af3c626e5a415a3`. Zenodo identifies the deposited version as CC BY 4.0. The official DOI is [10.5281/zenodo.21387374](https://doi.org/10.5281/zenodo.21387374). The primary methods and figures are in [Zhang et al., Science Advances](https://doi.org/10.1126/sciadv.aeh4432).

The KSF figure-A workbook supplies 15 corrected spectra over 197–477 K in steps of 20 K. The text discusses 10 K acquisitions. The MGO workbook supplies 20 spectra over 97.15–477.15 K in steps of 20 K. In each host the last five temperatures form the held set. MGO at 477.15 K has its own coordinate column and half the wavelength spacing of the preceding settings. The comparison uses the deposited corrected wavenumber columns. The authors describe spectral-response correction and the conversion to photons per constant energy interval. We used their corrected values directly. Lamp-calibration records, unnormalized photon rates and independent temperature-reference readings were not verified here.

The source workbook stores a complete trace in one column. A trusted reader parses the workbook and its coordinate and label metadata. Before the forecast lock it converts only the allowed intensity cells to numbers. The held input is the Stokes branch measured at the same temperature. A red-band mean computed solely from red positions sets the scale of both the forecasts and measured blue. A scalar applied to a whole scan cancels in these quantities. A wavelength-dependent gain error or additive background can survive. No additional samples are attributed to the selected B/C/D panel copies. The ten temperatures are repeated settings across two hosts. Between-specimen reproducibility, absolute radiometry and independent thermometer performance were outside this experiment.

## Transfer rule

At a fixed anti-Stokes detuning, the model starts from the blue value in the last development scan. It multiplies that value, with a fixed 0.02 offset in normalized units, by the measured target-to-donor red ratio and by the Boltzmann change for the nearest published phonon mode. The mapping between blue and red detunings interpolates the authors’ unequal room-temperature peak offsets. Every role uses the same fixed photon coordinates. There is no held-blue peak alignment. The optical comparator applies the theoretical single-mode intensity prefactor and Boltzmann amplitude to the paired red profile. Extending a mode-integrated amplitude to a full band is an additional assumption of this study. The authors already reported resolved-band agreement in KSF and strong overlap in MGO. Those qualitative findings, published peak coordinates, selected integrated coefficients and approximate thermal shifts were known before the profile test.

The role `fit_blue_red_slope` fits the local log blue/red slope versus inverse temperature using the last four development temperatures. It receives the same held red spectrum as the candidate. A second fitted role uses only the blue training history. Further controls remove the red change, remove the Boltzmann change, use observed detuning instead of a discrete phonon energy, and predict zero. The protocol fixes scaling, the complete grid, refusal conditions and role list. The unmodified protocol and scoring sources were committed at `827bd8e647f1fd88e3948b93102ac9dda88320c5`. All 100 forecast arrays (9,750 ordinates) were received in `forecasts.json` at `f40e066f781c50e0ab6274a49d86c30650cfb35d`, before the ten held blue profiles were scored.

## Largest error

At KSF 477 K and +250 cm⁻¹, the candidate gave 2.352639 and the measured normalized blue intensity was 1.211112. The directly adjacent deposited intensities were 0.38931 and 0.29835 at 16,326.53061 and 16,339.86928 cm⁻¹. The query was at 16,327.17042 cm⁻¹ and the red mean was 0.317846. Relative to the last training temperature, the offset-adjusted red ratio was 1.323249 and the thermal factor was 1.206856. The blue ratio actually observed was 0.828635. The true blue change therefore had the opposite sign from the two multiplicative changes. All comparisons use the same measured point. The fitted blue/red control gave 1.267562, the donor gave 1.465712 and the direct optical-detuning role gave 1.211745. The last role's macro MAE was 0.112221. This arithmetic diagnoses the failed transfer at fixed coordinates. It does not distinguish line-center shifts, thermal broadening, overlap or instrument response.

## Replay

Run `python3 replay.py` here to check the complete frozen arrays, stored native bracket interpolation, all profile errors, the fixed gate and the largest discrepancy. Run `python3 independent.py` for the separate original-ZIP receiver with independent worksheet extraction and 50-digit arithmetic. `python3 predict.py OUTPUT` builds fresh predictions and refuses an existing output. `python3 score.py forecasts.json SHA256 OUTPUT` checks all forecast identities before reading the high-temperature blue values. The authoritative forecast SHA-256 is `3c8be4fa779779221fbb2d6d4ef997a5ca36679320294f139693cb41d9628839`.

The original 100,000-byte catalog retention request exceeded the provider’s 65,536-byte limit. Its terminal validation error and the separate binding-not-found observation are retained. A bounded catalog reader succeeded and expanded zero scientific members. Two subsequent header/axis receivers accessed workbook structure, temperature labels and coordinate columns. The original forecast and scoring runs completed with their full retained outputs. The per-scan reader and its Git lock establish the numerical exposure boundary.

The independent receiver obtained the original author ZIP again. Its 50-digit recount checked 975 native interpolation brackets, 9,750 forecast residuals and 260 metric cells. The largest scaled discrepancy was 4.82 × 10⁻¹⁴. The gate, zero wins and worst coordinate matched.
