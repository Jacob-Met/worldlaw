# Moving six acoustic sampling points improves a worst-case bound and loses the measured comparison

Moving six axial sampling points from 4 cm to 8 cm reduced a certified worst-case center-pressure error bound from 1 to 0.698569. On the Haneda–Ren raw acquisition, the relocated layout lost all eight registered comparisons. Keeping the close axial samples gave the lowest development-selected error on both held loudspeakers. A competing 8 cm layout also beat the proposed layout with the same estimator and the same number of observed points.

## Measurement and layouts

Part 0 contains four loudspeaker placements in one room. A 48-channel microphone line was moved across 51 lateral and 26 vertical positions. Each location has 4,800 samples at 48 kHz after a two-second time-stretched pulse. All four HDF5 files carry the same 63,648 indexed coordinates and nominal sound speed of 340 m/s. Intake checked every whole-file publisher MD5 and computed SHA-256. The complete coordinate table verified row = x + 48y + 2448z. Frame reflections are present in these raw responses. [Raw acquisition](https://doi.org/10.5281/zenodo.19656813) · [Author methods](https://yh-audio.github.io/meshgrid-ir.html) · [Measurement paper](https://doi.org/10.1109/ICASSP55912.2026.11461569)

The supplied raw MATLAB example displays one common time slice across the mesh. Its global normalization serves visualization. The study uses unnormalized recorded amplitudes, the original sample origin and all 100 ms for each Fourier sum. The archive supplies no physical timing-error bound between traversals or per-channel phase calibration. The reported room reverberation time is 0.65 s. Time truncation and the moving scattering frame limit interpretation as one monochromatic source-free field.

The 50 centers occupy disjoint 9 × 9 × 9 spatial blocks within each source. Positions 1 and 3 supply calibration. Positions 2 and 4 are the complete held-source tests on the same spatial grid. Every layout uses 26 of 32 possible donor measurements. The original cube has six axis, twelve face-diagonal and eight body-diagonal donors. Relocation preserves the twenty diagonals and places the six axes at twice their former radius.

The equal-aperture control exhaustively compares 559 sets of 26 donors formed by removing three opposite pairs. Each retains the same maximum radius of 8 cm. At each source and center it minimizes directional-kernel conditional variance at 3,680 Hz, then holds that layout fixed at all seven frequencies. Direct solves check the principal-submatrix deletion formula. At every held center the optimum retained all close and distant axis points and removed six body diagonals. Thus it changed which six measurements remained available while keeping the maximum radius and sensor count fixed.

## Continuous-direction result

Write h = 0.04 m and α = 2πfh/c. The model comprises propagating plane-wave superpositions with complex angular total variation at most one. Each donor has independently bounded complex measurement error at most 0.01. The center magnitude is at most one. Throughout α² ∈ [183/25, 187/25], both signs of the field p(x,y,z) = cos(kx/√3)cos(ky/√3)cos(kz/√3) have unit center magnitude. On the original cube every donor magnitude is bounded by 49/5300 < 0.01. Both fields can produce the same zero donor vector. Every estimator has worst absolute error at least one and returning zero attains one.

For the relocated layout, weight the far-axis, face and body donor means by −1/2, −3 and −1/2. A rational Taylor enclosure over 1,429 cells of the squared-direction simplex bounds the coherent-field error by 9878531969/15000000000. The sensor-error allowance adds 1/25. Their sum, 10478531969/15000000000, covers every real direction and frequency in the band. A second proof covers 25,600 stereographic cells with rational cosine enclosures and angular and frequency remainder bounds. It gives an independent upper bound of 0.794151. Finite observations still leave field ambiguity. No measurement establishes this room's angular mass or normalized error radius.

Suppose instead that each translated y,z recording line has an unrestricted unknown phase, with the center line defining the reference. For either layout, let a be one or two for the two same-line axial donors at ±ah. Set dₓ = π/(2aα) and dᵧ = √(1−dₓ²). The unit-angular-mass field cos(kdₓx)cos(kdᵧy) vanishes on those two donors. Reversing its sign and changing every other line phase by π leaves all observations unchanged and reverses the center. Both layouts then have worst-case error one. The example describes an enlarged uncertainty class. It supplies no estimate of actual trigger jitter.

## Held results

The primary score averages frequency-specific NRMSEs at 3,670, 3,680 and 3,690 Hz, the three 10 Hz bins in the certified band. Each NRMSE divides squared prediction error summed over 50 centers by observed center energy, then takes the square root. The seven-frequency score also includes 1,840, 2,760, 4,600 and 5,520 Hz. The two held source placements are the comparison units.

| Held source | Layout | Development-selected predictor | Primary NRMSE | Common directional-kernel NRMSE | Seven-frequency selected NRMSE |
|---|---|---|---:|---:|---:|
| 2 | Original | Shell ridge | 0.209776 | 0.377131 | 0.210096 |
| 2 | Relocated | Isotropic kernel | 0.406573 | 0.417795 | 0.464827 |
| 2 | Equal-aperture optimum | Directional kernel | 0.286287 | 0.286287 | 0.282996 |
| 4 | Original | Shell ridge | 0.212036 | 0.357460 | 0.177694 |
| 4 | Relocated | Isotropic kernel | 0.369325 | 0.375853 | 0.440066 |
| 4 | Equal-aperture optimum | Directional kernel | 0.256535 | 0.256535 | 0.248802 |

Koyama’s source-released isotropic and directional kernels use the actual 26 positions at every frequency. The directional control uses the source coordinate, concentration two and published regularization of 0.001. Direct solves check its callable coefficients. Selection on the two development placements also includes same-line directional interpolation, shell ridge, full complex ridge and ridge residuals added to the directional kernel. Both complete development sources exchange training and validation roles before a final fit to both. The outcome bank retains all methods per frequency. The fixed rational filter itself scored 0.400489 and 0.398568 in the primary band. [Authentic kernel implementation](https://github.com/sh01k/MeshRIR/blob/ff6a145e3b2631e46e8cd4e47156ad33bff3acb8/example/sf_func.py)

The largest relocated selected error on source 2 occurred at lattice center (5, 7, 17) and 3,670 Hz. The observed transfer was 910.241978 − 153.914199i. The prediction was 301.831607 − 542.876931i, an absolute error of 722.118541 in stored FFT units. At this same point the original selected predictor erred by 193.636763 and the equal-aperture optimum by 287.691098. The 32 raw donor magnitudes ranged from 164.601004 to 1,314.114125. Source 4’s largest relocated selected error was 474.055026 at (41, 7, 17), also at 3,670 Hz. The independent receipt includes the complex measurements and endpoint samples for both complete neighborhoods. These observations leave the separate contributions of calibration, truncation, frame scattering and room structure unresolved.

## Replay and custody

With NumPy 2.2.6, SciPy 1.15.3 and h5py 3.12.1, run `python3 research/haneda-equal-budget-layout/replay.py --archives /directory/with/the/four/raw/h5/files`. This rebuilds the original source projections, regenerates all forecasts, scores the immutable forecast and reconstructs the direct Fourier coefficients and worst neighborhoods. The alternative `--verified-projections` route accepts the six original NPZ digests in `digests.json`. The two rational certificate scripts run with the Python standard library.

The source freeze preceded numerical response selection. The complete forecast lock preceded either held-center opening. Each held projector verifies the complete forecast hash and roster before selecting center data. An independent scalar reader checked 700 directly computed Fourier coefficients, 450 score comparisons, 50 worst rows and all eight inequalities. Maximum differences were 9.92 × 10⁻¹¹ across the raw/worst quantities and 1.98 × 10⁻¹⁴ across scores. The record retains the initial dependency DNS failure, partial fourth-grid TLS refusal, four successful whole-file acquisitions and original synthetic controls. [Frozen study](https://github.com/Jacob-Met/worldlaw/commit/ef688b11e97f2f319569a7283148e705971e55c0) · [Forecast lock](https://github.com/Jacob-Met/worldlaw/commit/cc1a2a943637edd85b7b4c4796a95e9f742f0609)
