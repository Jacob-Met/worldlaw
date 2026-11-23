# Changing the backing of a measured Van Gogh paint reconstruction

At 590 nm, a cochineal tint reflected 6.50% on the black side of the chart and 6.22% on the white side. Eliminating film thickness from the black-side reading predicted **72.07%** on white. The nominal-thickness model predicted **6.65%**. The physical inversion was on its valid interior branch. At this wavelength its predicted white reflectance changed locally by −684 units per unit change in the black reading. The experiment makes this instability visible because the same drawdown spans both substrates.

Geldof and colleagues reconstructed historical oil paints, weighed mixtures and used a block applicator over a black–white chart with nominal wet thickness 100 µm. After drying, they measured the patches with a Konica-Minolta CM-2600d, specular-included. Their table contains 84 measured recipes, four curves per recipe and 31 bands from 400 through 700 nm. Its recipe ledger also lists 12E, which has no spectral rows. The statistical unit here is a drawdown. The eight other intermediate-tint evaluation draws remain unopened. [Primary methods](https://doi.org/10.1186/s40494-018-0181-6) · [Author data and CC0 license](https://github.com/fligt/revigo-spectra/tree/f09ed729f0826f0161b70ecb125fe597b31ea297)

## Measurements and predictions

Seventy-two calibration recipes established the source-channel roles without reading any of the twelve reserved recipes. The unprefixed b and w spectra behave as chart backgrounds, with median between-recipe standard deviations of 0.034 and 0.528 reflectance percentage points. The corresponding values for ob and ow are 23.56 and 27.32. We use ob as measured paint on black and ow as measured paint on white. The repository’s public viewer displays boundary examples. Those examples belong to calibration. The experimenters previously used their full set to estimate optical properties, so this is retrospective reuse with a source-bound forecast split.

The four development recipes were 01C, 04C, 09C and 11C. Every arm could use the weighed recipe, both chart references and the paired measured black-backed **coated** spectrum. The target is the measured white-backed coated spectrum in unit-reflectance fractions. All 31 bands count equally within a spectrum. Each recipe counts equally in the mean. No assumption of independent wavelengths or independent manufacturing batches enters the comparison.

| Method | Mean recipe RMSE | Worst recipe RMSE |
| --- | ---: | ---: |
| Eliminate thickness separately in each band | 0.146931 | 0.274472 |
| One thickness from the full black spectrum | 0.046438 | 0.116407 |
| Published finite-layer equation at nominal thickness, training-only refit | 0.042805 | 0.099970 |
| Nominal prediction plus measured black-side residual | **0.030092** | 0.106897 |
| Empirical within-pigment estimate of the backing difference | 0.037093 | 0.119131 |
| Copy the coated black-side measurement | 0.069480 | 0.262959 |

We reconstructed the published non-hiding Kubelka–Munk and Saunderson equations with interface parameters 0.04 and 0.49 and specular collection fraction one. The code fits zinc white and bone black first, then each relevant colorant using its calibration recipes. It uses wavelength-wise squared residuals, positive optical depths and the reported concentrations. The authors’ repository contains a placeholder fitting notebook. The exact optimizer and original all-sample fitted coefficients did not enter this replay. Absolute dry thickness and the separate dimensional K and S values are not identified here.

For a homogeneous layer, let a = 1 + K/S, let B be the internal coated-black reflectance, and let g and h be the black and white chart reflectances. Eliminating the common thickness yields N = 1 − a(B + g) + Bg and H = B − g. The internal white prediction is [H + (N − aH)h] / [N + (a − h)H]. The code applies the inverse and forward interface corrections to coated readings and uses the reported bare chart reading as the substrate boundary. The 480 synthetic comparisons include transparent and strongly absorbing limits. All agree within 1.9 × 10⁻¹⁵ against direct two-flux propagation. Real drawdowns can vary laterally or violate the fitted optical and interface assumptions.

## Raw failures and physical bounds

The worst whole recipe was eosin-wax 01C. Its 31 bands all produced interior solutions. At 530 nm measured black and white were 0.0977 and 0.0951. The inversion predicted 0.615624 on white with local derivative −4.21. Ill-conditioning at the isolated cochineal wavelength therefore does not explain all four failures. For cochineal 04C at 590 nm, the fitted infinite-layer internal reflectance was 0.052737, the bare black background was 0.049700 and the inferred internal coated-black value was 0.049816. The weak dependence on thickness at black gives the derivative −683.67. The inferred relative depth was 0.000593. This is a fitted optical quantity, not a measurement of the dry film.

With nonnegative internal reflectance, the fixed specular-included surface equation predicts at least 0.04. Of 4,464 coated calibration readings, **277** were below this floor. The minimum was 0.0206 on 11A. At otherwise fixed parameters, any reduced common specular collection fraction would have to be at most 0.515 to admit this particular value. The original calibration does not identify the reason for the mismatch.

A single passive identical layer is monotone in background reflectance. This remains true after any common increasing interface transformation. Although bare white exceeded bare black at every retained band, the coated order reversed in **506 of 2,232** calibration pairs and **46 of 124** development pairs. The largest calibration reversal was 0.0134 in 14D at 400 nm. Exact agreement with the black observation then forces at least 0.0134 error on white under this model class. A joint fit needs maximum error at least 0.0067 on one of the two readings. An independently measured patch-dependent thickness, interface correction or noise distribution was unavailable. These deterministic limits do not establish which apparatus or material effect caused a given discrepancy.

## Reproduction

Run `python3 research/revigo-paired-backing/replay.py` with Python 3.10 or newer. For offline operation, pass `--source-dir PATH` containing the two files with their original author basenames. The reader verifies both complete source hashes. It parses spectral values only for the 72 calibration and four development recipes. The independent Decimal reader verifies 744 signed component errors and all 24 per-recipe scores. The eight remaining prospects were not evaluated. The native study preserved the original solver output, role check, conditioning traces and independent measurement recount.
