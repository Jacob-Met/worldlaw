# Solvent-contrast transfer on a polystyrene-coated silicon wafer

A shared-film model lost to three two-slab controls on both held solvent exchanges. It passed **5 of 12** registered point comparisons. The separate absolute-reflectance interval system was already infeasible on calibration and passed **0 of 11** gates. These are results for a new, unstitched reduction of the instrument's reflected-to-direct beam ratios on one wafer.

The beam enters through silicon. D₂O and H₂O supply four calibration scans (3493–3494 and 3500–3501). The frozen predictions cover all 56 bins in each of three CM4 scans (3495–3497) and two silicon-matched water scans (CMSi, 3498–3499). Each row has a measured momentum-transfer coordinate and resolution width. Bins and scan angles share a wafer and solvent-exchange history. The source files carry coincident start and end timestamps even when monitor integration spans hundreds of seconds. The nine reflected timestamps span 9 h 37 min 20 s. Solvent mixing fields are blank. These records leave actual solvent density, hydration and drift unresolved. [Le Brun et al., primary paper](https://doi.org/10.1107/S160057672201086X) · [CC BY 4.0 data and notebook](https://doi.org/10.5281/zenodo.6829895)

## Measured endpoint

The release has 57 raw NeXus files, 17 fitted model files and a demonstration notebook. The four relevant fitted objects contain model settings without the reduced data vectors. Static inspection identified refnx's two finite slabs, solvent-fraction terms, contrast-specific backgrounds and a variable scale on CMSi. Archived fit values and target-specific parameters were excluded. The example notebook demonstrates manual choices on different scans. Exact numerical reproduction of the paper's reduced Fig. 9 was therefore unqualified.

We fixed the integration window from the corresponding independent direct exposure (3470, 3471 or 3472), then used refnx 0.1.57 with monitor normalization, background subtraction, scale one, 2.8–18 Å and 3.4% rebinning. The premeasurement design retained the reflected-run coordinate metadata and substituted direct-beam counts before predicting each Q grid. All observed coordinates passed the registered check. Direct monitor rates differed materially across angles; their ratio supplies no calibrated reflectance correction. All 504 measured ratios, including those above one, enter the corresponding calibration or assessment.

## Registered transfer result

Lower values indicate smaller RMS error in asinh(R/10⁻⁵). Each solvent score gives equal weight to each complete scan. The dry and both hydrated controls call refnx reflectivity, use the same training scans, instrumental resolution and backgrounds, and fit their parameters using only the endpoint solvents. The hydrated control with free endpoint backing density interpolates that density at held nominal solvent fraction.

| Forecast | CM4 | CMSi |
|---|---:|---:|
| Shared complex disk spline | 0.599702 | 1.371904 |
| Dry two-slab control | **0.471728** | 1.142362 |
| Hydrated two-slab control | 0.523211 | 1.178215 |
| Hydrated with free endpoint density | 0.516686 | 1.294877 |
| Linear in nominal solvent density | 1.066546 | 2.100490 |
| Interpolated transformed ratio | 0.716885 | 1.614180 |
| Nearest calibration contrast | 1.359679 | **1.016385** |

At CMSi scan 3498, zero-based bin 18 (Q = 0.019046846 Å⁻¹), the normalized reflected and direct spectra were 0.000001611815 and 0.001912927. Their ratio was 0.000842591 with reported error 0.000086289. The candidate predicted 0.02910778, producing its largest transformed error, +3.542244. The largest error in the original ratio units was on CM4 scan 3496, bin 0. The prediction of 0.31215582 fell 1.34065035 below the observed 1.65280617. The full five scan traces, all seven predictions, and each arm's worst row and raw RMS error are preserved.

The disk fit used 222 least-squares evaluations. The three slab families each used two fixed differential-evolution seeds, followed by local refinements. Dry, hydrated and free-backing used 7,623, 9,317 and 11,011 global evaluations per seed respectively. The corresponding pairs of local evaluation counts were 10/12, 21/17 and 34/22. Both seeds and their training objectives are retained in the forecast archive.

## Conditional passivity test

For a fixed passive, power-normalized film two-port, its reflection as a function of the backing reflection is a disk self-map. At real positive backing admittances the Schwarz–Pick inequality bounds the difference of the reflected magnitudes by |y₁−y₂|/(y₁+y₂). Loss within a common passive film is allowed by this inequality. Changes in the film, backing calibration or instrumental response can invalidate its application across scans.

A bin averages power before any nonlinear transformation. The calculation assigns each bin its own normalized Gaussian resolution kernel on a common incident momentum axis. The reverse L² triangle inequality gives an amplitude allowance comprising the Hellinger distance between the square-root kernels and a donor-kernel RMS bound on the pointwise discrepancy. Unsupported q, including the low-q propagation thresholds, receives the full unit discrepancy. Gaussian left tails are included at each of seven trial depths. Binary64 evaluations use a 2×10⁻¹² numerical cushion. The effective kernels and three-reported-error bands are modeling assumptions. The resulting bounds carry no statistical coverage guarantee.

In D₂O scan 3493, bins 0 through 11 exceeded one even after subtracting three reported errors. At Q ≈ 0.013925 Å⁻¹, the ratio was 2.4841803 ± 0.0366639. The 2,465 inconsistent pairs share their input measurements. Only 34, 17, 0, 2 and 0 rows in the five held scans respectively had locally ordered endpoints. The global feasible set was already empty; its width is undefined and the registered coverage and width gates fail. This result identifies an incompatibility between the reduced ratios and the assumed absolute endpoint. It supplies no test of film passivity or unique solvent-penetration explanation.

The separate exact rational control constructs a two-energy ambiguity in a pointwise real, lossless transfer-matrix class. Both endpoint powers average to 0.3 in both constructions, yet their intermediate powers differ by more than 0.007. The example establishes nonidentification for that relaxation. Physical realizability of both energies by a common material stack requires additional constraints.

## Replay and provenance

Install the six versions in `protocol.json` plus `uncertainties` in an isolated Python environment. Run the two commands from this directory.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python replay.py --raw-dir /tmp/spatz-raw
python exact_controls.py
```

The replay authenticates the frozen calibration and forecast archive, reconstructs all seven point predictions from the locked calibration fits, then reduces all twelve source files. The independent reader uses the same organizer reducer and separately implemented scalar scoring, interval bounds and gate logic. On a second worker its 36 raw vectors agreed exactly. It reconstructed 1,960 held residuals, 35 scan/arm scores, 560 interval endpoints and every registered gate. The maximum difference from the numerically stable interval implementation was 1.09×10⁻¹².

The preregistered eight files are at commit `f6193c513eac5aff4b4f6945ae8a387f4434bf04`. The complete pre-outcome forecast archive is at `62ee21e8d6ecab5b1922ccc5584a14fab046773b`. The compressed files contain ordinary UTF-8 JSON after zlib decompression. `course.py` exposes the original calibration, forecast and scoring stages, and `native-originals.json` records each native run, including the initial metadata-parser failure and the separate placement refusal.
