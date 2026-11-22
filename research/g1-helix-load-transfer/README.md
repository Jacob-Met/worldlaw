# Predicting hub bending moments across cyclic-pitch amplitudes

This experiment asks whether a complex response matrix fitted on one- and three-degree cyclic-pitch runs predicts both components of the corrected hub moment in separate two- and four-degree runs. It uses 19 recorded runs on the upstream G1 turbine in a three-turbine wind tunnel experiment. Opposite helix directions provide two forcing directions for fitting all four entries of the complex transfer matrix. The measured input is the actual three-blade pitch and azimuth.

## Held results

The unrestricted common matrix fitted by absolute least squares had the lowest aligned mean and worst error. Adding a squared-amplitude term increased mean complex-vector error from 0.03284 to 0.07040 N m on the two-degree runs and from 0.04945 to 0.20392 N m on the four-degree runs. The cubic candidate failed all nine registered comparisons.

| Model | 2° mean (N m) | 4° mean (N m) | Worst aligned run (N m) |
| --- | ---: | ---: | ---: |
| Common matrix, absolute fit | 0.03284 | 0.04945 | 0.05079 |
| Common matrix, equal gain | 0.03661 | 0.07003 | 0.11477 |
| Matrix affine in amplitude | 0.05686 | 0.12932 | 0.14134 |
| Matrix affine in squared amplitude (cubic) | 0.07040 | 0.20392 | 0.24462 |

Run 996, at four degrees, clockwise and zero yaw, had the largest cubic error in the two-component fundamental phasor (0.24462 N m). This metric compares full-run harmonic coefficients. Instantaneous peak loads are outside its scope. Its measured nodding phasor was 0.7230 − 0.7082i N m and its yawing phasor was 0.6830 + 0.7077i N m. The cubic forecast was 0.89784 − 0.59612i N m and 0.71986 + 0.83156i N m respectively. Its errors were 0.20766 and 0.12928 N m by component. The common absolute fit’s error on the same run was 0.05079 N m. The aligned design condition numbers were 1.0015–1.0074; the yawed designs had condition numbers 1.2247–1.3749.

Compared with the absolute common fit, cubic increased the three registered errors by 0.03756, 0.15447 and 0.19383 N m. Over the ten common clock-index origins the upper bounds on changes in these margins were 0.00223, 0.01217 and 0.01424 N m respectively. In contrast, descriptive comparisons to the five shorter load blocks change sign for each margin. For example, the four-degree pair’s block margins (common minus cubic) ranged from −0.18584 to +0.10048 N m. The decision uses the full-run phasor.

The secondary yawed run 1037 had a matrix setting of 0.076, a measured fixed-frame frequency of 0.89783 Hz and a measured frequency ratio of 0.07502. Its cubic and absolute-common errors were 0.18020 and 0.13276 N m respectively. The raw component errors, phasors and all eight runs are in `comparison.json`.

## Replay

Run `python compare_helix.py` with Python, NumPy, SciPy and h5py. The program fetches the official ZIP directory and the 19 required files using bounded byte ranges. It checks each NetCDF member against its published experiment-record SHA-256. Downloading an entire archive is unnecessary. To use a previously downloaded unchanged organizer ZIP, pass `--zip /path/to/SteadyWindDir.zip`. The replay constructs every model’s eight forecasts before reading held moment datasets. Whole NetCDF members, including opaque bytes for the moment channels, arrive during input projection.

## Signals and design

All runs in the analysis are dated 8 July 2025 in the test matrix, with steady wind direction, Mod-TI inflow, three turbines, the same positions, and a turntable angle of zero. All turbines have the same 46 W and 100% settings. WT1 has a yaw setting of zero or −20 degrees. We fit the two yaw groups separately. The recorded mean inflow speed spans approximately 5.40–5.46 m/s. At zero yaw, the measured forcing frequencies are 0.96748 and 0.96203 Hz at two degrees, and 0.93659 and 0.93515 Hz at four degrees. A linear system with frequency-dependent response can therefore contribute to an apparent amplitude dependence. One secondary run, 1037, has an approximate frequency ratio of 0.076 rather than 0.075; the forecast and error are reported separately. There is one held run for each amplitude, handedness and yaw combination.

The upstream PLC records measured pitch at 250 Hz through CAN. The azimuth and fixed-frame moments are on the 2,500-Hz clock. The source files store the corrected components under `WTsData/WT1/FilteredLoads/Hub/NoddingFixed` and `YawingFixed`. The authors describe projection to a fixed frame, imbalance correction and removal of rotor-weight effects. The authors report filtering above 6P for fatigue-equivalent loading calculations. The released channel metadata do not specify a complete phase transfer for these fixed-frame signals. For pitch, the reported calibration-line residual is typically 0.05 degrees and zeroing repeatability is 0.1 degrees. The estimated azimuth zeroing accuracy is 0.2–0.5 degrees. The first blade points upward at zero azimuth. Positive azimuth is clockwise when looking downstream, and positive pitch feathers a blade.

The measured multiblade-coordinate vector uses the blade passing order, the measured signed rotor direction, and the cosine and sine of each blade’s azimuth. A full complex matrix permits different linear responses to clockwise and counterclockwise forcing, even at the same amplitude. Each phasor uses positive frequency, with a constant and linear trend fitted alongside the harmonic over seconds 5 to 55. The frequency is estimated from the measured input alone within the registered interval surrounding the matrix setting. Each output has units of N m. Each run has its own clock origin, used identically for pitch and load.

The common response matrix is fitted both by absolute moment least squares and with a weight of one over the measured input norm. The cubic candidate uses a matrix affine in the **squared** norm of that phasor; a same-size comparator uses its unsquared norm. All four models see the same complete training runs. Primary evaluation weights complete runs equally: mean Euclidean error in the two complex components within the aligned two-degree pair and four-degree pair, plus worst absolute error across the four. All nine candidate-versus-comparator conditions have to hold. Performance of the common matrix concerns these selected fundamental responses. The full physical system can have additional frequency and amplitude dependence.

Five ten-second block estimates quantify within-run variation. A sensitivity analysis recomputes the predictors and fits for each of ten uniform fast-clock offsets of the pitch acquisition; the registered primary always uses offset zero. These are neither independent runs nor calibrated clock-error intervals. The reported phase is conditional on the source acquisition convention. Channel latency, aerodynamic and actuator contributions, and physical frequency dependence as rotor speed varies remain unresolved.

[Measurement methods](https://doi.org/10.5194/wes-11-4005-2026) · [Original test matrix and NetCDF archive](https://doi.org/10.5281/zenodo.18723855)

## Verifiability

The design roster, estimator source, complete forecast lock, and each native input and outcome projection have separate SHA-256 identifiers in the comparison record. The 19-member manifest authenticates the selected NetCDF bytes. Each original ZIP member also passes its CRC. A complete checksum for the 110,107,273,259-byte ZIP was not recomputed.
