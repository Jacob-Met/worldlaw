# Center pressure from a 26-neighbor cubic stencil

Each trial estimates the complex transfer function at a cube center from its 26 neighbors. MeshRIR S1-M3969 contains one loudspeaker and 3,969 positions in one room. Its 21 × 21 × 9 grid splits into 147 disjoint cubes. The central height supplies 49 calibration centers. The 98 centers at the other two heights are the held observations. Every position has one role. The seven frequencies span 375–4,500 Hz and include the predicted loss of observability near 3 kHz.

The microphone was moved by a robot. The room responses were acquired between 23:34:50 and 05:23:38 in the archive's wall-clock timestamps. Each cube takes 4,811–4,944 seconds to assemble. The 25 ambient temperature readings cover 26.2–26.3 °C. A single PC and Dante interface controlled the excitation and acquisition. The authors synchronously averaged three sweeps per position and deconvolved them circularly. A full-length FFT of each released sequence preserves the published time origin. The measured comparison applies to these sequentially acquired transfer functions, conditional on source and room stability. [Dataset](https://doi.org/10.5281/zenodo.10852693) · [Acquisition paper](https://arxiv.org/abs/2106.10801)

## Why the frequencies matter

Let h = 0.05 m. For an acoustic plane wave with real propagation direction d, averaging complex pressure over six axis neighbors gives the mean of cos(kh dₓ), cos(kh dᵧ) and cos(kh d𝓏). The 12 face diagonals give the mean of their three pairwise products. The eight body diagonals give their product. At each frequency the proposed estimator assigns three real weights to these three shell means. Cubic symmetries permit this reduction for the direction-independent worst-case problem. The weights minimize the maximum error on the frozen directional grid plus 0.01 times the sum of the absolute weights. The latter term represents a bounded error per donor in a normalized model. The absolute angular mass and measurement error of this room were not independently established.

The response of any propagating plane-wave mixture with angular total variation at most one is bounded by the largest single-direction error. A separate angular grid evaluates that error. If b is the angular grid spacing, bilinear interpolation bounds the excess between samples by b² Σₛ |wₛ|[(krₛ)²+krₛ]/4. This follows by bounding each pure second derivative in each spherical coordinate and applying one-dimensional linear-interpolation error twice. The bound addresses unsampled directions. Numerical samples and LP solutions use floating point.

There is an exact obstruction on this geometry. The regular source-free wave p(x) = ∏ⱼ cos(kxⱼ/√3) is an equal-weight sum of eight plane waves. At f = √3 c/(4h) = 3,007.7062 Hz for c = 347.3 m/s, p(0) = 1 and all 26 neighbors vanish. Its negative has exactly the same donor values. At 3,000 Hz the greatest donor magnitude is |cos(kh/√3)| = 0.0040246221. A rational enclosure follows from 600² < 3(3473/10)² < 602². Using sin(t) ≤ t and π < 22/7 gives an upper bound of 11/2107, below the assumed 0.01 per-donor error. Both signed fields can therefore produce the same zero observations. Every estimator has worst-case complex magnitude error at least one in this normalized model. Always predicting zero attains one. This theorem does not establish that the test room contains this standing wave.

## Comparisons

Both author controls call the pinned functions `kiFilterGen` and `kiFilterGenDir` with their own 0.001 regularization, identical donor geometry and the same frequency values. The directional version uses the source direction as viewed from each center and the author's concentration of two. The full untruncated positive-frequency coefficients are recovered from the callable outputs and cross-checked against directly assembled kernels. The authors' separate 18-microphone, low-pass planar demonstration has a different geometry and evaluation signal. Two empirical controls fit complex linear coefficients from 3 shell means or all 26 donors with leave-one-x-column-out tuning on the 49 development centers. A radial spherical-mean approximation, an equal-donor average and zero complete the comparison. [Author source](https://github.com/sh01k/MeshRIR/blob/ff6a145e3b2631e46e8cd4e47156ad33bff3acb8/example/sf_func.py)

## Measured transfer

The registered comparison failed. Five of 14 inequalities held. The direction-minimax filter beat the spherical-mean approximation and the unweighted average on both scores, and beat zero on mean error. Both authentic author filters and both empirical regressions beat the proposed filter on mean and worst-frequency error. The strongest mean came from the empirical three-shell regression; the source-direction author filter had the lowest worst-frequency error.

| Arm | Mean frequency NRMSE | Worst frequency NRMSE | Lower layer mean | Upper layer mean |
|---|---:|---:|---:|---:|
| direction_minimax | 0.271267 | 1.000000 | 0.278833 | 0.262404 |
| radial_mean | 0.478667 | 1.874129 | 0.466616 | 0.489800 |
| author_isotropic | 0.179096 | 0.444591 | 0.199939 | 0.155136 |
| author_directional | 0.154852 | 0.293344 | 0.168960 | 0.138375 |
| empirical_shell_ridge | 0.138418 | 0.376706 | 0.149930 | 0.126308 |
| empirical_26_ridge | 0.153995 | 0.378177 | 0.160193 | 0.147181 |
| equal_26 | 0.678233 | 1.073105 | 0.678564 | 0.677555 |
| zero | 1.000000 | 1.000000 | 1.000000 | 1.000000 |

At 375, 750, 1,500, 2,250, 3,000, 3,750 and 4,500 Hz, the candidate's NRMSE was 0.014188, 0.027185, 0.084181, 0.153082, 1.000000, 0.202424, 0.417808. Its 3,000 Hz weights were exactly zero, so the strict worst-frequency comparison against zero was already impossible for a nonzero-energy held frequency. This implication was recorded before held-center access. The measured data supplied the remaining comparisons.

Its largest absolute Fourier-component error occurred at microphone 3304, lattice index (7, 10, 7), at 3,000 Hz. The measured transfer was 5.454309 − 1.628866i. The candidate predicted zero, with error magnitude 5.692336 in the archive's unnormalized DFT units. At that same point the author directional filter predicted 4.929019 − 1.722086i, giving error 0.533498. Two independent direct Fourier sums from separate archive copies agree to 1.02 × 10⁻¹⁴ on all 26 neighbors. Their magnitudes span 0.261117–5.266062, with RMS 3.202920 and largest magnitude 92.51% of the center magnitude. These measurements contain substantial signal even where a field with invisible donors is mathematically possible.

## Reproduce the comparison

From the repository root, run `python3 research/meshrir-cubic-center/replay.py --archive /path/to/S1-M3969_npy.zip`. Omitting `--archive` retrieves the official archive. The original used NumPy 2.2.6 and SciPy 1.15.3. Replay fetches the exact author source, checks its digest, rebuilds the 5,488 forecasts, verifies the two published compressed banks, and recomputes the scores from the 98 held center files. A second reader parses the raw NPY headers and evaluates seven direct Fourier sums without importing NumPy or the scorer. It checks every held coefficient, all 216 layer/frequency metrics, the eight worst witnesses and all 14 registered inequalities. It also reconstructs the 26 actual surrounding measurements at the candidate’s largest error.

The [source freeze](https://github.com/Jacob-Met/worldlaw/commit/be35f37d7dca1188e52392520572260051825395) preceded response access. The [forecast lock](https://github.com/Jacob-Met/worldlaw/commit/a90845dcd37dbd391cede27430ef0939fd5174ec) preceded numerical access to held center files. Two workers separately received and authenticated the complete archive. Native records include two placement refusals, a dependency-resolution failure and a command that failed to start because its argument exceeded the operating-system limit. The successor received the identical locked data via standard input. The failed startup recorded no descendant-wait field. Raw impulse responses remain in the authors’ archive.
