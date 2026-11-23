# Thickness contrasts on one stepped aluminum plate

The two late resonances in Watzl and colleagues’ AA7075 scan moved together, but fitting one frequency shift to both spectra underestimated the thickness increase on the right plateau. Across the three plateau contrasts, the shared-shift estimate had an RMS error of 0.001494 in log thickness. The authors’ published laser-ultrasound result achieved 0.000935 against the same plotted screw-caliper levels. The candidate failed every accuracy and graphical-uncertainty requirement.

## What was measured

One plate has three machined levels. The release contains 301 averaged waveforms of 10,002 samples each. Its stage coordinate covers −30 to +30 mm in 0.2 mm increments. Figure 6’s caption reports 2 mm. This replay uses the archived coordinate and preserves the discrepancy. The 1,000 oscilloscope averages at each position are available only as a single trace. The three plotted caliper levels provide two independent thickness contrasts. Neither 301 locations nor 1,000 averages gives a specimen-level uncertainty interval.

Data come from the authors’ [final archive](https://doi.org/10.5281/zenodo.13149584). The paired micrometer reference and original laser result come from Figure 6E in [Watzl et al., *Ultrasonics* 145, 107453](https://doi.org/10.1016/j.ultras.2024.107453). The paper describes a screw caliper. Its three black levels are the held outcomes. Its green curve supplies the actual published estimate. Stage-focus distances and the calibration-signal fields stayed outside the analysis.

Before waveform access, we inspected the design metadata, the schematic, legend, x support of the black artist and the paper’s qualitative conclusion. A schematic crop also included the top row of an adjacent spectrum. A separate flat-pattern measurement supplied the published analysis windows and a control for the inversion arithmetic. The waveform script read the stepped scan’s time, position and waveform arrays. It wrote the original 312,094-byte forecast with SHA-256 `b4bf27714f88cf20c05c7c6c8c6d0a3dfd28d1a540f182126fe8ea34439265ec` before the Fig. 6E green and black ordinates were extracted. The protocol and original resource identities are in `protocol.json` and `observed.json`.

## Comparison

The source time windows separate the early surface-wave packet from the late resonances. We applied the author-supplied Tukey samples for the matching 20-line, 400-pixel, 5-pixel-offset optical pattern. The early window spans 20–817.26 ns and the late window spans 10–45 µs. Windowed, zero-padded Fourier spectra and three-bin log-parabolic interpolation give three peaks per position.

Our implementation of the published CoMLAS method uses both resonance frequencies to recover every admissible Poisson-ratio solution on the authors’ numerical Rayleigh–Lamb chart. The early Rayleigh peak and measured focal-plane line pitch then supply the velocity scale. On the matching, separately released flat-pattern record, all 21 author frequency triples had a unique solution. With equation 8, the largest relative thickness difference from the 21 archived author outputs was 0.01344%. This checks the inverse given the authors’ frequencies. Their full stepped-scan peak-picking program was unavailable. The archived half-space response function alone does not implement CoMLAS. The green curve is therefore an independent, paired comparison to the authors’ actual analysis. All 301 stepped-scan frequency triples also gave a unique numerical chart root.

For the candidate, each late mode’s central-plateau spectra define a normalized shape template. For each position, we search one common log-frequency shift and average the two shape correlations. The counterfactual under test is that the same fractional translation of the two resonances reflects thickness variation. All three arms that use templates share the same central calibration positions. This retrospective within-scan estimate has no future-position or separate-specimen interpretation. The relative-only methods require no caliper level to construct a forecast. The published method’s absolute scale uses a 199.1884 µm focal-plane line pitch measured for the same optical pattern on the separate acquisition.

For scan fraction *u* between zero and one, the three fixed interiors are [0.04, 0.18], [0.42, 0.58] and [0.84, 0.96]. They contain 43, 49 and 37 positions. We score differences between median log thicknesses in those regions in middle–left, right–middle, right–left order. The third contrast is the sum of the first two. All three receive equal weight. Graphic stroke thickness bounds sensitivity to reading the plot. The available source gives no corresponding raw screw-caliper repeats or instrument uncertainty.

| Method | RMS log-contrast error | Largest absolute contrast error |
|---|---:|---:|
| Constant thickness | 0.012789 | 0.018082 |
| Low peak alone | 0.001461 | 0.002065 |
| High peak alone | 0.001465 | 0.002070 |
| Mean of the two log peaks | 0.001390 | 0.001965 |
| Surface-wave adjusted low / high / mean | 0.001238 / 0.000872 / 0.001074 | 0.001730 / 0.001216 / 0.001516 |
| Low / high template alone | 0.001420 / 0.001526 | 0.002008 / 0.002158 |
| Mean of the two individually optimized template shifts | 0.001442 | 0.002033 |
| **Shared spectral shift** | **0.001494** | **0.002108** |
| Reconstructed CoMLAS, equation 8 | 0.000725 | 0.000963 |
| CoMLAS with the exact Rayleigh polynomial | 0.000726 | 0.000966 |
| **Authors’ plotted laser-ultrasound curve** | **0.000935** | **0.001186** |

The vector figure gives plateau centers of 1.698999, 1.715000 and 1.730000 mm. The candidate’s three signed contrast errors were +0.000926, −0.002108 and −0.001182. It missed the frozen requirements of 10% lower RMS than the published curve, 5% lower RMS than every other control and a worst contrast at least as accurate as every control. The same three conservative graphical bounds also failed. Coverage alone passed. A raster measurement of the separately isolated figure artists agreed within 0.000011 mm on the three black levels and 0.000252 mm across the 301 green points.

## Worst locations

At x = +20.4 mm (zero-based row 252), the candidate’s right-to-center log thickness was +0.005250 versus +0.008708 from the caliper. The measured late peaks at 1.637686 and 5.329684 MHz were 0.4833% and 0.5219% below their central medians. The early peak at 14.477144 MHz was 0.1455% above its central median. Both template correlations were high (0.99968 and 0.98023), yet the common shift missed −0.003458 in log thickness. The early-wave-adjusted high mode predicted +0.006773 and local equation 8 predicted +0.006992 there. Using the measured velocity information helps on this position. The scan alone cannot attribute the discrepancy to local material changes, optical scale, propagation, or peak shape.

The two preregistered transition bands [0.20, 0.36] and [0.64, 0.82] span 49 and 55 rows. Relative to the adjacent plateau bracket, the worst candidate excess was 0.000626 at x = −18.0 mm in the first band. The second band had zero excess. Both are bracket diagnostics. There is no independently sampled thickness profile inside either transition. Across every method and slice, 23 distinct positions produced a worst row. Direct Fourier projections from their complete original traces agreed with the 69 stored peak estimates to within 0.000001 Hz.

## Replay

Use Python with NumPy, SciPy and PyMuPDF (verified with PyMuPDF 1.26.6). From the repository root run:

```sh
OPENBLAS_NUM_THREADS=1 python research/watzl-stepped-plate/replay.py --data-dir /tmp/watzl-sources
```

The CLI downloads and verifies three public MAT files and the authors’ PDF. An already downloaded copy of the exact PDF can be supplied as `author-uploaded-paper.pdf` in the same directory. Add `--work-dir /tmp/watzl-replay` to retain all reconstructed spectra-derived forecasts, branch results, graphical levels, every method’s three contrasts, both transition diagnostics, and the independent raw-waveform checks. A synthetic known-shift control in the original receiver recovered shifts to the grid precision and rejected reversed sign. The raw scientific data remain available from the linked authors’ archive.
