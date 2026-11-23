# Two upstream dye records did not improve downstream pipe-profile transfer

One fitted transport speed predicted a programme of accelerating pipe flow more accurately than a model that split dye into fast and slow components using a second upstream observation. Across 50 held injections and three downstream stations, their mean relative errors were 0.2328 and 0.3143. An independently optimized, constant 50:50 mixture also beat the observed-boundary split. All four registered comparisons failed.

| Curve transfer on programme 3 | Mean | Worst condition | During ramp | At 13.06 m |
|---|---:|---:|---:|---:|
| Physical-time Gaussian, from Hart Eq. 3 | 0.3087 | 0.4551 | 0.3840 | 0.4857 |
| Flow-weighted Gaussian, monotone projection | 0.2729 | 0.3511 | 0.3070 | 0.4315 |
| Flow-weighted Gaussian, fitted command ramp | 0.3459 | 1.2907 | 0.5304 | 0.4838 |
| Fitted one-speed transport | **0.2328** | **0.3214** | **0.2571** | **0.2711** |
| Fitted constant two-speed mixture | 0.2623 | 0.3316 | 0.3041 | 0.4290 |
| Two-gauge spectral ridge | 0.7908 | 1.6754 | 1.2469 | 0.9590 |
| Two speeds with measured-boundary split | 0.3143 | 0.4624 | 0.4292 | 0.4897 |

Each station error integrates absolute concentration residual over the complete archived time interval and divides by the time integral of absolute measured concentration. Ten conditions and three stations receive equal weight. Predictions use the complete archived upstream profiles and hydraulic record. The source subtracted a first-30-second background and zeroed samples outside a station-specific window determined by 1% of its eventual peak. This is an offline comparison of those processed profiles. No held peak, lag, centroid, window or downstream concentration entered any forecast.

## Experimental units and clocks

Hart and colleagues measured rhodamine dye in a nominally 24 mm pipe at Warwick. The archive coindexes flow and optical readings at 30 Hz. The rig uses an electromagnetic flow meter and Turner fluorimeters. The authors describe cross-sectionally averaged optical concentrations; the files do not supply spatial sensitivity maps or independently calibrated relative channel delays.

The v2 index matches all 57 steady files and all 265 flow-programme files by their literal programme/run IDs. The published paper reports 220 injections, including 80 during the ramps. The archived workbook explicitly identifies 45 additional “At end of acceleration” files: five repeats at each of three durations in programmes 1, 2 and 4. The remaining 220 consist of 60 before, 80 during and 80 after acceleration. This reconciles the design counts; no row-level publication manifest is supplied.

All 215 files in programmes 1, 2 and 4 were available for calibration. Programme 3 supplied the complete 50-file held test, covering ramps of 5, 10 and 60 seconds, with five files per condition. Across the 265 files there are only 60 distinct full hydraulic records. Each of the four programmes has 15 hydraulic histories, shared across different injection stages of the same duration. No hydraulic history is identical across programmes. Held profiles are therefore 50 registered inputs on 15 hydraulic histories in one apparatus and one held programme. The programme 3 multi-peak headline and published aggregate routing comparisons were known beforehand. The archive README illustrates initial rows in programme 4 run 50 and steady run 23. No numerical programme 3 destination trace was projected until the forecast lock.

## Why the first volume-clock test stopped

The first frozen design required an invertible forward volume coordinate and positive Reynolds number over each whole record. All 115 files in programmes 3 and 4 contain a nonpositive measured discharge/Re sample, and 92 of the 265 files have decreasing published cumulative volume. In programme 3 run 1, at 160.63 s, the measured discharge was −0.00003359 m³/s and the cumulative volume fell from 0.0099756 to 0.0099745 m³. Two specific signed samples fell within the nominal one-second injection, in programme 3 run 37 and programme 4 run 41. A change to the run-ID parser had previously been required to recognize the workbook’s literal “Test0” label. Both original refusals are retained.

For any finite displacement record the smallest uniform change admitting a nondecreasing approximation equals half the largest backward excursion. The midpoint between its prior running maximum and future running minimum attains that value. Among programme 3 histories the largest such change was 3.316 mm; programme 4 reached 11.052 mm. These are mathematical corrections to the recorded series; the data do not establish whether local negative values represent meter variation or actual flow reversal. The original course stopped before a forecast escaped that admission check.

## Physical-time successor

The second protocol was frozen before any held destination concentrations were opened. Every candidate mode advances a scalar field in chronological time under signed measured velocity, scaled by its fitted slowness, and strictly positive diffusivity. The dispersion formula extends the paper’s steady turbulent correlation below its support by fixing the correlation factor at Reynolds number 3,000 while retaining the measured speed magnitude as a multiplier. An assumed molecular floor keeps diffusivity positive at zero speed. The source supplies no independent calibration for that extension.

The first gauge at 2.68 m predicts fast and slow contributions at the measured second boundary at 4.89 m. Their positive relative magnitudes, with a symmetric floor, split the actual second-gauge concentration. Each component then propagates to 7.08, 8.92 and 13.06 m. The 0.50 m sensor sometimes saturated; the authors flagged the 10.98 m sensor for noise or missing output. Neither entered a prediction or target. A separately optimized two-speed control uses the same available speed/dispersion grid and a constant equal split. The required one-speed control searches the full 0.80–1.35 slowness range with the same dispersion scales. Its selected slowness and dispersion multiplier were 1.08 and 1.0. Both two-speed arms selected 0.92/1.08 and a multiplier of 0.5.

The numerical step combines three shifted samples with nonnegative weights summing to one and linearly interpolates between spatial nodes. The boundary is measured concentration on the upstream side and tracer-free exterior beyond the far boundary, including inflow during reversal. Constant preservation on an unbounded grid and positivity for nonnegative inputs do not establish mass conservation in this open domain. Each of the three physical predictions at three stations on 50 held hydraulic inputs was recalculated at half grid spacing (0.025→0.0125 m) and double far-boundary margin (2→4 m). Median relative time-integrated discrepancy was **1.485%** and maximum **4.503%**, below the respective frozen limits of 10% and 30%. This joint mesh/margin comparison is a sensitivity test, not a certified truncation bound.

The two Gaussian volume routes reconstruct Hart Eq. 6 with its published dispersion relation. One uses the nearest monotone-displacement construction and the other fits positive plateau speeds under the published ramp schedule. The ordinary-time Gaussian follows Eq. 3. None use the original paper’s destination-optimized dispersion or transit time. The empirical two-input control uses complex ridge regression on donor spectra and flow features, with regularization selected by leaving one training programme out. The interpretation of effective modes and their split remains conditional on these boundary, diffusion and observation models.

## Largest error

The largest full-curve two-mode error was 0.69425 in programme 3 run 9, 13.06 m downstream, for injection at the start of a 5 s acceleration. The observed peak was 34.95 ppb at 216.33 s. The candidate peaked at 27.17 ppb at 215.80 s. At 216.23 s the recorded concentration was 32.655 ppb, the donor-dependent split predicted 7.664, the constant split 17.012 and the one-speed model 21.788. Their comparison isolates the impact of the frozen estimation procedures on this trace. The experiment provides no direct observation of radial component populations.

All 9,640,050 forecast samples, four decisions and the complete 8,701-sample worst trace were checked independently against the raw published CSV files. The largest difference in derived metrics was 5.69×10⁻¹⁴. The 23,071,902-byte native prediction bank was locked and verified before the scorer opened any destination. Its SHA-256 is `1f98db0d20b03db1965478204faadd47cc95fd249d1c324763c188a464fbd416`. The compressed score, parameters and complete worst trace accompany the source.

## Replay

Run `python replay.py` from this directory using Python 3.10+, NumPy 2.2.6 and a C++17 compiler named `g++`. It authenticates the public source files, rebuilds the three calibration programmes in temporary storage, reconstructs every held curve and checks all scores and worst-trace values. `--source-dir PATH` uses previously downloaded files named `unsteady.zip` and `index.xlsx`. `--frozen-bank PATH` verifies the original forecast SHA before recounting directly from that bank. The two protocol files and their corresponding entry points document the separate volume and physical-time experiments. The upstream and downstream numbers in the archive already include the publisher's calibration and preprocessing.

[Dataset and README](https://doi.org/10.15131/shef.data.14135591.v2) · [Unsteady-flow study](https://doi.org/10.1061/(ASCE)HY.1943-7900.0001918) · [Steady-flow methods](https://doi.org/10.1061/(ASCE)HY.1943-7900.0001146)
