# The printed amplitude spread of circular-tank Faraday waves

On average the symmetric-mode calculation predicted too little separation between the printed curves at half fill and too much at 0.67 fill. Swapping the two nominal geometry ratios reduced RMSE at both fills. At 0.67 fill, copying the upper plotted envelope also beat the model. One prespecified bin contained only two eligible green pixels, so the full-coverage gate already failed before the lower envelope was scored.

**The original physical sidewall-to-centerline question remains unscored.** A native request for the 1.52 MB measurement archive returned HTTP 403 before receiving its file inventory. The public paper supplied a separate observable through its raster figures. The test below concerns visible chart strokes. An upper envelope can include any of the three antinode curves, including the centerline itself. These bounds are two statistics of one plotted image, not separate sensor channels or independently measured phase extrema. [Measurement archive](https://doi.org/10.24382/87c2f31a-524d-41ec-95d4-383fa82b10b8) · [Colville et al., Journal of Fluid Mechanics](https://doi.org/10.1017/jfm.2025.16)

## Geometry and conditional prediction

The narrow tank has a circular cross-section 400 mm in diameter and depth 40 mm. A camera measures the moving tank and free surface at 60 frames per second. The paper's vertical forcing targets the first symmetric mode around twice its eigenfrequency. Its reported local amplitude is half the peak-to-trough height. The authors derive the two-fluid potential-flow eigenproblem and the Mathieu forcing equation. Their qualitative asymmetry, period tripling, selected steepnesses and described examples were known. Three repeats were performed on 16 of 123 physical cases. We have no basis for treating successive chart stripes as experimental replicates.

In the linear mode, both wall amplitudes are W and the center amplitude is rW. The ratio of the smaller to the larger antinode amplitude is min(r,1/r). Folding loses the center-versus-wall identity. To compute r without measured amplitudes, the finite-element calculation solves Laplace's equation separately in the two circular-segment half-domains, with no normal flow on the rigid and symmetry boundaries. It eliminates the interior velocity potentials, combines the two interface kinetic-energy operators with the gas/water density ratio 0.001204, imposes zero integrated interface displacement, and extracts the lowest nonconstant symmetric mode. The code preserves the physical state and matrix definitions.

| Fill h/D | Modal frequency, Hz | Center / wall amplitude | Smaller / larger |
|---|---:|---:|---:|
| 0.30 | 1.892984 | 0.776939 | 0.776939 |
| 0.50 | 1.939542 | 0.960919 | 0.960919 |
| 0.67 | 2.060105 | 1.112185 | 0.899131 |

The geometry original reports meshes of 16, 32 and 64 divisions. A rectangular control returned the analytic opposite wall/center ratio to 9e−15, and its frequency was 1.930969 versus 1.930307 Hz analytically. The half-fill gas-density test reproduced the exact squared-frequency Atwood factor 0.5384615384615387. These checks qualify the numerical model under its assumptions. Finite amplitudes, curved contact lines, symmetry breaking and camera measurement locations can change actual antinode transfer.

## Printed-figure split and scores

The 2,331,908-byte version-of-record PDF has SHA-256 `feb7fae7eeb196abeb81b2282c2ec70d3de6b3fda7528c7c01486e5ebbf504cf`. Figure 11 (652 × 509 raster) supplied all three development curves at 0.30 fill. Figure 15 (664 × 509 raster) supplied the 0.50 and 0.67 fill groups. Its repeated 0.30-fill condition was excluded from scoring. PDF text-layer legend and axis positions were qualified before reading held curve pixels. The three antinode line styles of each fill share a color. Solid, dashed and dotted strokes can overlap, disappear under symbols or be sparsely sampled. Recovering three complete independent surface trajectories from those marks would exceed the source.

For each of 41 prespecified f/f* columns from 0.980 through 1.020, the estimator uses an equal frequency width of 0.001, left of both legends. The forecast receives the 95th percentile ordinate of color-qualified pixels. Its target is the 5th percentile of the same marked pixels. Fewer than three pixels yields an abstention. The colors are inferred from each plot's legend and the y scale from its printed axis ticks. Development supplied 122 observed drive/frequency stripes out of 123 potential stripes. The pooled estimated lower/upper coefficient was 0.700172. The target itself, marker class and target-specific calibration were unavailable to all forecasters. The extractor reads the pixels while the forecast function receives the upper summary only. No numerical source-archive observations, native acquisition-level forecast or underlying plot-point count is claimed.

| Frozen role | 0.50 fill RMSE, 41/41 stripes | 0.67 fill RMSE, 40/41 stripes |
|---|---:|---:|
| symmetric mode folded | 0.006580 | 0.005363 |
| upper equals lower | 0.009901 | 0.002930 |
| lower zero | 0.075758 | 0.071627 |
| development pooled ratio | 0.015846 | 0.019877 |
| development affine | 0.017861 | 0.022560 |
| development quadratic | 0.015242 | 0.017169 |
| development frequencywise ratio | 0.015708 | 0.019990 |
| calibrated mode gap | 0.005444 | 0.007840 |
| reversed fill assignment | 0.001566 | 0.001784 |
| unfolded high fill | 0.006580 | 0.002930 |

The printed ordinate is dimensionless A_s/D. The half-fill primary worst was f/f* = 0.980. Its 64 eligible pixels gave lower 0.098383 and upper 0.113502. The model predicted 0.109066, versus 0.102053 with the swapped geometry. The 0.67-fill worst was f/f* = 1.007. Five pixels gave lower 0.068256 and upper 0.068704; the model predicted 0.061774. The missing 0.67-fill stripe at 0.995 had two pixels and remains in the fixed denominator. Neither the fill swap nor the low-count stripe establishes which physical antinode had the larger amplitude. No model or extraction change was made after the forecast lock.

## Reproduction

The plotting protocol is frozen at `41975baa4df2d525c9f7a631b5d4e62006256271`; the byte-identical public PDF was cached across readings in the subsequent forecast implementation. Forecast SHA-256 `b81a47b026d46cebc8dd1f44c3cb9d23dbc39c41cb6d22ae6465ff2f3a7a5d98` was committed at `7c8508f1811847bcab1e79a5fd9ee79b9a3f9998` before scoring. The independent receiver recomputed the color masks from the original JPEGs, independently fitted the empirical regressions, reconstructed 810 predictions on observed stripes, checked all 20 worst-bin indices and reproduced 40 RMSE/MAE cells with maximum discrepancy 2.93e−15. Largest endpoint/forecast discrepancy was 8.24e−15. It reused the pinned PDF/JPEG decoding libraries, while its per-pixel arithmetic, quantiles, polynomial solves and scoring are separately implemented.

Run `python3 replay.py .` for offline verification of the forecast lock, score receipt, geometry controls and exact extreme-row records. `independent_printed.py` reopens the public article with PyMuPDF 1.25.3 and Pillow 11.1.0. `printed_forecast.py` and `score_printed.py` are the original producer and receiver (NumPy 1.26.4). The original archive HTTP refusal, valueless HTML-attribute parser failure, and pre-admission retained-output request refusal are preserved separately. The public article's 0.30-fill numerical development curve, text metadata and synthetic mode outputs are distinct evidence classes.
