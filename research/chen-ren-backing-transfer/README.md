# Predicting the reflection of a perforated face sheet after changing its backing

A projective model predicted three measured face-sheet/core assemblies better on average than four equal-input comparisons. Its mean complex-reflection error was **0.06638**, compared with **0.11788** for additive impedance, the best comparison on average. The single reserved assembly reversed the ranking. On sheet A8 with an empty backing cavity, the projective error was **0.09369**, compared with **0.06430** for local complex ridge. All five reserved checks failed.

## Measurements and split

Chen and Ren measured eight perforated face sheets in a 100 mm impedance tube. Each sheet faced the incident sound with its small aperture section first. The same nominal 20 mm cavity behind the sheet contained air alone (0) or a Schwarz Primitive (P), Gyroid (G) or Diamond (D) core. The four configurations share a nominal reference plane at the front of the specimen. The rigid piston, 97.6 mm core diameter and nominal 1.2 mm radial clearance are documented. Each core is shorter than the nominal cavity depth by 0.44, 0.54 or 0.67 mm. The source does not independently establish the exact seating or back-face pressure field after a configuration change. These measurements test the predicted response of an assembly. They cannot separately identify an intrinsic two-port for each component.

The instrument exported complex mean reflection and three consecutive acquisitions per configuration without remounting. Its microphones were 50 mm apart and switch-calibrated. Speed of sound and density were computed from software defaults. Calibration factors, coherence, signal-to-noise ratio and independent remounting measurements are unavailable. We used the authors’ recommended 340–1600 Hz band, 631 lines spaced 2 Hz apart. Before freezing the split, the author reduction source disclosed an aggregate instrumentation artifact below 150 Hz. That range is outside every score. Source measurements and method descriptions are available under the authors’ article and data record. [Article](https://doi.org/10.1038/s41597-026-08826-4) · [Version 2.0 data](https://doi.org/10.5281/zenodo.23494742)

The four complete calibration sheets A1, A4, A6 and A7 occupy the even-parity corners of the design with three binary geometric factors. At each queried sheet the solver received the three other backing means. All frequencies and repeat acquisitions of the target sheet/backing were withheld together. Three development targets were A2-D, A3-G and A5-P. Remaining A8 data stayed closed until development passed. The separate reserve forecast used only the original calibration set and three measured A8 core-backed means. Its empty-cavity target was decoded after the reserve forecast lock. Each complete spectrum contributes equally to the reported development mean. Frequencies, technical acquisitions and FFT averages do not provide independent specimen counts.

## Comparisons

Suppose each face sheet maps four common complex loads into measured front-face reflections through one nondegenerate fractional linear transformation. The cross-ratio of the four measured reflections must then be common across sheets. Each calibration sheet supplies a two-component homogeneous cross-ratio direction at each frequency. The leading eigenvector of the sum of the four unit projectors estimates a common direction. Inverting the four-point relation with the three observed target-sheet anchors gives the predicted fourth reflection. Exact independent synthetic transformations, a deliberately perturbed target, and a degenerate anchor set exercise this calculation. The cross-ratio identity is established mathematics. The physical prediction tests whether the four measured calibration responses actually share it precisely enough.

The controls predict the same physical target with an unweighted same-load donor mean, the nearest geometry in the three-factor design (averaging ties), an additive difference in normalized impedance averaged over all donor/anchor pairs, and a local complex affine ridge using all three anchor responses. Donor-only leave-one-sheet-out comparison of nine settings selected a 160 Hz halfwindow and penalty multiplier 1 for ridge. Every method uses the same unit-disk projection for its delivered prediction. Unprojected errors and singular fallbacks are retained. No target values selected a model setting. The unweighted same-load and geometry controls consume a subset of the permitted inputs. The released author CSV columns define the measurement reference.

## Results

Values are root-mean-square complex differences in dimensionless reflection coefficient.

| Held sheet and backing | Projective | Additive impedance | Local ridge | Same-load mean | Nearest geometry |
|---|---:|---:|---:|---:|---:|
| A2-D | 0.059804 | 0.177070 | 0.201484 | 0.240357 | 0.237427 |
| A3-G | 0.094755 | 0.094504 | 0.130144 | 0.139348 | 0.152492 |
| A5-P | 0.044576 | 0.082080 | 0.118006 | 0.261986 | 0.259111 |
| A8-0 | 0.093694 | 0.079179 | 0.064297 | 0.095577 | 0.106411 |

The registered mean hurdle required at least 5% lower RMSE than each comparison. Every assembly also had to stay within 5% of its best comparison, and each of the three band means had to stay within 10%. The bands were [340,700), [700,1100) and [1100,1600] Hz. Development passed all seven checks despite a small A3-G loss to additive impedance. The unchanged reserve contract failed the mean, unit and all three band checks. A8-0 is the only held empty-cavity target. Its load type and sheet geometry vary together, limiting attribution.

At the 600 Hz reserve maximum, the measured mean was 0.77415 + 0.15751i. The projective prediction was 0.82376 − 0.19076i with absolute error 0.35179 before and after projection. The individual observed imaginary components were 0.14024, 0.17214 and 0.16016. Four single-donor predicted imaginary components ranged from −0.07675 to 0.04874. The two singular values of the stacked unit donor constraints were 1.42905 and 1.39922. These nearly equal values weakly distinguish a shared direction. The final normalized denominator was 0.31944, far above the frozen 1e−10 fallback threshold. The joint point prediction lies outside the range of the four individual imaginary predictions. This is evidence of inconsistent donor constraints at that frequency. The records do not determine their mechanical or acoustic cause.

The calibration-only candidate already showed a projected error of 1.61494 at 404 Hz for A7-D under leave-one-sheet-out testing. It remained in the training report and triggered no parameter change. A3-G had the largest development error, 0.30921 at 632 Hz. The independent receipt retains measured repeats, the three anchors, each prediction, each donor’s separate extrapolation, and the two singular values at every unit's worst frequency.

## Reproduce

Use Python 3.10 or newer with NumPy. Download the publisher's `TPMS_PPSA_dataset_v2.0.zip` and run:

```bash
python research/chen-ren-backing-transfer/replay.py /path/to/TPMS_PPSA_dataset_v2.0.zip
```

The replay verifies the full archive SHA-256 `9b93ad7d7dfe8b576c65836f4c884caa0b34b65c599778dac557abffdd950e59`. It trains the nine ridge settings, materializes and rereads both forecast locks, checks every scored physical mean and repeat, and invokes a second solver. The second solver estimates the cross-ratio by direct singular-value decomposition and fits the selected local ridge using explicit centered observations and augmented least squares. Across 12,620 complex forecasts, the largest independent difference was 3.29e−13. Across 140 whole-spectrum, band and repeat scores it was 1.93e−13. The replay checks complete numeric records with scoped floating-point tolerance and hashes the publisher's mean/replicate members. Fresh NumPy archive bytes can vary between environments. The original two pre-label manifest hashes and forecast hashes are preserved in `protocol.json`. Measurements are the authors’ processed instrument exports. No reconstruction of microphone time series or independent physical calibration is implied.
