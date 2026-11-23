# Predicting the hyperfine spacings of silicon monosulfide with two spin-bearing nuclei

The additive coupled-spin model transferred most of the measured splitting from singly spin-bearing isotopes to 29Si33S, but missed its registered accuracy target. Its mean group RMS error was **2.795 kHz**, above the 2 kHz limit. Its worst group RMS was **3.945 kHz**, below the 4 kHz limit. All six relative comparisons passed. The largest predicted change from diagonalizing the two-spin interaction was only **0.115 kHz**, smaller than the quoted 2 kHz uncertainty of every measured feature.

## What was predicted

Müller and colleagues measured resolved rotational transitions of SiS and published line assignments, blended-feature weights and laboratory frequencies. We calibrated on 299 assigned low-J branches of five singly spin-bearing isotopes, corresponding to 297 distinct donor features. The entire doubly spin-bearing isotope supplied the test. It has 47 assigned branches, 41 distinct measured features and six vibrational/rotational groups. Each model predicts the spacing of a feature relative to its own group mean. The measured frequencies undergo the same centering at scoring. This removes six unknown rotational origins and leaves 35 independent linear contrasts. The six groups share a laboratory measurement and assignment process. The target was conditional on published assignments and weights, including five unresolved blends. It does not establish absolute rest frequencies, blind line identification, or independence of the author's blend weights.

The source preamble distinguishes measured frequency (MHz), uncertainty and global-fit residual (kHz). No global-fit residual, fitted parameter file or computed catalog was a donor. The previously visible spin-free high-J table and the authors' qualitative fit conclusion are recorded in the protocol. Double-spin frequency equality classes were identified by comparing source strings before locking the forecasts; their numerical values were first read in a later measurement receiver. [Author paper](https://doi.org/10.1039/B618799D) · [Cologne line list and supplement](https://cdms.astro.uni-koeln.de/classic/predictions/daten/SiS/) · [JPL CALPGM source](https://spec.jpl.nasa.gov/ftp/pub/calpgm/)

## Whole-group comparison

| Frozen procedure | Mean group RMS (kHz) | Worst group RMS (kHz) |
|---|---:|---:|
| Coupled additive operator | 2.794750 | 3.945207 |
| Same coefficients, diagonal only | 2.804861 | 3.960582 |
| Sulfur terms only | 7.889499 | 10.638257 |
| Best possible flexible diagonal family | 2.828092 | 4.088204 |
| Flexible diagonal at the stored origin | 2.828704 | 4.088204 |
| Flexible coupled at that origin | 2.819401 | 4.076861 |
| JPL SPCAT with the same donor coefficients | 2.801072 | 3.957464 |
| Silicon term only | 1553.829539 | 2187.337351 |
| Zero spacing | 1554.982018 | 2189.336062 |

Adding silicon terms to sulfur alone reduced mean error by about 5.09 kHz. Exact recoupling improved on the same diagonal terms by only 0.010112 kHz in mean group RMS and 0.015376 kHz in worst group RMS. This ordering does not resolve the off-diagonal interaction at the experimental precision. The authentic full-rotor SPCAT calculation used the same donor coefficients and a donor-inferred rotor constant. Its largest feature difference from the fixed-J calculation was 0.146139 kHz, including the catalog's 0.1 kHz output quantization. The authors' jointly fitted all-isotope results were excluded from forecasting.

The worst measured feature was the unresolved pair of assignments **505/506**, at **35127.281 MHz** in v=0, J=2→1. The source weights are 0.6418 and 0.3582. The measured centered frequency was −2619.615385 kHz; the coupled forecast was −2610.979368 kHz, a **+8.636017 kHz** residual. The diagonal, sulfur-only and native SPCAT forecasts at the same feature were −2610.920947, −2608.576720 and −2610.833229 kHz. Group RMS values for v/J = 0/1, 0/2, 1/1, 1/2, 2/1 and 3/1 were respectively 2.924964, 3.945207, 2.266099, 2.890684, 1.603483 and 3.138062 kHz.

## What the one-spin data can establish

For fixed J and total F, at most two values of the intermediate angular momentum F₁ can contribute. We recoupled the donor-estimated silicon spin–rotation operator in that basis. Independent exact Racah weights checked 56 angular sectors and 152 squared overlaps. On four synthetic JPL catalogs the largest difference on 39 double-spin branches between the full model and native SPCAT was 0.050 kHz. A pair-only interaction proportional to J(J+1) I(Si)·I(S) is identically zero in every single-spin donor. For J=0→1 the two allowed nuclear-spin manifolds in a synthetic example split by 4λ, even though their weighted centroid is unchanged. The additive model therefore makes a conditional prediction.

The first calibration stopped when the decoder treated literature reference 22 as a blend weight. A source-defined repair distinguished integer citations from fractional weights. The original course then failed its registration requirement of full column rank before any double-spin frequencies were opened. The more flexible donor sulfur model has exactly **19 identifiable combinations among 20 columns**. Rational elimination independently checks 108 source contrast equations. One missing direction affects only v=1/J=2, shifting six centered features by −t/84 and three by +t/42.

The separately frozen successor compares against the entire resulting flexible-diagonal family. Its forecast contains the exact direction and a minimum-norm coordinate origin. After measurement, an oracle minimizes the one affected group's RMS over every real t. This simultaneously gives the smallest attainable mean and worst group RMS. The oracle has additional endpoint information and supplies a conservative comparison. The two flexible point-model diagnostics depend on the chosen coordinate origin. All 41 measured features remain in each loss. The independent receiver reads the primary SPFIT line file, reconstructs the direction from branch labels/weights, and uses 70-digit arithmetic to check 369 residuals, 54 group RMS values, 18 aggregates, and all eight gates. All 41 raw frequencies agree at published precision.

## Reproduction

Install NumPy 2.2.6 and use Python 3.11 or newer with a C compiler and make. Run these commands from the study directory.

```sh
python3 angular_controls.py
python3 replay.py --sources /tmp/sis-measurements
```

The replay verifies the two Cologne files and 20 upstream CALPGM source members, builds SPCAT, regenerates the donor calibration and 328 point forecasts, then compares them with the locked bank. The source-only rank proof and measured recount also run with the Python standard library. The archived original bytes have SHA-256 identities in `receipt.json`. Portable comparison uses a 0.000001 kHz numerical tolerance. The original 7/8 result remains fixed.
