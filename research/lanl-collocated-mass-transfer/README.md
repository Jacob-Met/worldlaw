# Added base mass under intermittent contact on the LANL three-story test rig

The acceleration transfer measured with added base mass alone gave the best forecast for the combined mass-and-bumper configuration. Its relative spectral RMSE was **0.273727**, versus **0.331224** for the locally fitted impedance update. The candidate lost on all ten recorded trials and all four measured floors. This is a test of one crossed configuration on one laboratory rig.

## Source and intervention

Figueiredo et al., *Structural Health Monitoring Algorithm Comparisons Using Standard Data Sets*, LA-14393, §§2–3 (2009), describe 17 configurations and ten tests per configuration. Each test simultaneously recorded one shaker force and four accelerations, giving 170 multichannel tests and 850 scalar histories. The reported five averages for each experimental frequency response used a Hann window. Only the last time history from that averaging sequence was saved. A subsequent paper describes 50 tests per state. We found no additional authenticated independent trial roster.

The archived SHMTools example data from the public Python port contain exactly two MATLAB variables, an 8192 × 5 × 170 single-precision array and 170 state labels. All ten traces of each state occupy consecutive file positions. The archive supplies neither a timestamp nor a physical trial ID per trace. Only the file indices are used here. The trusted extractor reads the MAT container before selecting the permitted input or response channels. No held acceleration was supplied to fitting, normalization or role selection.

The setup sampled at 320 Hz. A centerline shaker excited the base with band-limited 20–150 Hz random forcing at a fixed nominal 2.6 V RMS. A separate load cell at the stinger had nominal sensitivity 2.2 mV/N. The four accelerometers at the base and successive floors had nominal sensitivity 1000 mV/g. The paper plots N and m/s², whereas the example MAT carries no channel units, calibration certificates or sign metadata. The 170 recorded force traces have distinct SHA-256 values and file-unit RMS between 19.428 and 20.092. The largest absolute normalized circular correlation over every pair and all 8192 lags was 0.071309, between file indices 129 and 168. This excludes literal and circular-shift replay of the recorded force. It does not prove independent shaker seeds, randomized settings or separate rig reassemblies.

States 1, 2, 10 and 15 form a complete two-by-two table. State 1 is the no-contact baseline. State 2 added 1.2 kg at the base. State 10 set a 0.20 mm bumper gap without additional mass. State 15 combined these two changes. States 16 and 17 added mass on the first floor, a different mechanical port. Those response traces were excluded. Other gap settings and individual stiffness changes were recorded, but the source table has no crossed gap-by-stiffness setting.

## Model, numerical scale and forecast lock

For a linear time-invariant system with a truly collocated, translational point mass, the added mass applies feedback force −m times base acceleration. If A is complex accelerance measured from that same force port, the added-mass accelerance at output f is A_fb /(1 + m A_bb). This follows by substituting the effective applied force into the original linear response. It is a standard structural-modification relation. The published shear-building model assumes four lumped masses, linear inter-story stiffness and modal damping. Its illustrated comparison is for the original state. The report's original averaged frequency-response recordings are absent from this MAT. Our estimates below pool the ten available retained histories. Applying a linear formula to finite-amplitude responses with possible impacts is an approximation. Centerline floor accelerometers also do not identify torsional motion or impact occupancy.

On the no-contact 1→2 calibration, unchanged accelerance gave 0.985579 relative complex error. Coefficients +1.2, −1.2 and +1.2 × 9.80665 gave 0.940911, 1.029289 and 0.163471. A fitted real coefficient of 11.176425 gave 0.140881. These observations establish a numerical coefficient for transfer under this source convention. They do not authenticate the acceleration unit, reveal a different physical mass or calibrate the original instruments.

The candidate fitted a complex coefficient at each frequency using states 1 and 2 only. The five-bin least-squares estimate pools all four floors and shrinks toward the fitted scalar. It then applies that update to state 10. The corresponding local additive and per-floor/base ratio controls use the same frequency neighborhood. All models share the same three source configurations. No target reading was used to select bandwidth, the regularizer, the processing window or any held forecast.

Every complex frequency-response prediction was locked before state 15 was scored (task post 178603). The file contains 12 roles × 4 floors × 385 frequencies from 20 to 140 Hz. Scoring uses the measured force spectrum of each held window to predict its acceleration spectrum. Each 25.6-second trial supplies 15 mean-centered Hann windows of 1024 samples with hop 512. The relative RMSE is the square root of total complex squared acceleration error divided by total observed complex acceleration energy. This is an offline, force-conditioned spectral score. Overlapping windows and frequency bins are not additional experimental trials.

| Forecast | Relative spectral RMSE | Relative pooled H1 transfer error |
| --- | ---: | ---: |
| Mass only, state 2 | 0.273727 | 0.065879 |
| Local impedance candidate | 0.331224 | 0.267170 |
| Add the two measured changes | 0.338565 | 0.207394 |
| Fitted real coefficient | 0.354220 | 0.317296 |
| Local floor-specific ratio | 0.376295 | 0.326302 |
| Nominal coefficient 1.2 × 9.80665 | 0.384269 | 0.380218 |
| Local base ratio | 0.390217 | 0.348765 |
| Local additive change | 0.504089 | 0.493570 |
| Nominal coefficient 1.2 | 0.757125 | 0.903687 |
| Gap only, state 10 | 0.821812 | 0.954942 |
| Unmodified state 1 | 0.860004 | 0.973032 |
| Zero response | 1.000000 | 1.000000 |

The primary gate required a strictly lower pooled error than every comparator and wins in at least seven trials and three floors against the best pooled comparator. The local update improved on the fitted scalar but lost to state 2 on every trial and floor. The held state's four median force-response coherences were 0.9992, 0.9958, 0.9075 and 0.9291. These measures describe linear predictability at the tested excitation. They cannot establish whether, when or how often the bumper made contact.

## Largest error and conditioning

At file index 140, channel 3, window 6, 71.25 Hz, the observed complex acceleration coefficient was (−40.506, −9.022) and the candidate predicted (40.483, 61.981). The squared error was 11,600.701 in the unscaled FFT coefficient units. The mass-only prediction was also poor at this individual bin, (27.150, 64.558), despite its lower pooled error. The recorded force coefficient was (−299.471, 266.766).

The candidate's denominator was 0.746231 + 0.526265i, with magnitude 0.913135 and phase +35.19°. Its reciprocal amplified magnitude by only 1.095. The smallest magnitude anywhere in the candidate was 0.346650 at 53.4375 Hz. Thus a near-zero denominator does not explain this worst error. The gap-only response already predicted (−2.409, 67.557) at this bin, and rotating it by −35.19° left the prediction far from the measured phase. The diagnostic uses the locked coefficients and does not change any score.

## Reproduce

Obtain the pinned MAT and check its SHA-256, d738160e7d0a2c422a1189e3fe6c47c6e978be068247f55dc5a94ca381773e0f. Name it `official-port-data3SS.mat`. The original data are distributed by the cited repository. This study preserves its own forecasts and numerical receipts. Python, NumPy and SciPy are required for fitting. The independent recount needs only NumPy and the standard library.

To verify the published forecasts in place, run the independent receiver with the archived NPZ. Run any training replay in a separate working directory since it writes a new NPZ.

```sh
python3 recount.py official-port-data3SS.mat s15-locked-forecasts.npz held-state15.json
```

The archived forecast lock is the scoring authority; different numerical-library versions can change refit bytes. The independent implementation reads the MAT v5 records directly, loops over individual windows and checks all 24 aggregate scores, 168 trial/floor sums and the worst-record identity. It uses the archived forecast file. [Original LA-14393 report](https://doi.org/10.2172/961604) · [Pinned data file](https://github.com/ebpfly/shmtools/blob/747392d82d17e5ef8d1bbe31bbd696894151b0e5/examples/data/data_files/data3SS.mat) · [Classical frequency-response structural modification](https://doi.org/10.1016/0888-3270(90)90040-R)
