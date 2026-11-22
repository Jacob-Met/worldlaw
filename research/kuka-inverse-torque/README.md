# Measuring motor torque on the KUKA industrial robot benchmark

A ridge model that estimates velocity and acceleration from four prepared position samples reduced mean normalized torque RMSE from **0.608600** for the published normalized linear model to **0.405507**. The same ridge dictionary using the released velocity and acceleration gave **0.459585**. Reconstructing the motion from the documented derivative filter gave **0.405742**. The direct-position edge over this preselected comparator was **0.000235**. All three registered comparisons passed on one external recording containing three different paths, each executed twice.

## Reproduce the result

Install NumPy and SciPy, then run this command from the repository root. The default downloads the organizers’ 12.7 MB prepared RAR, verifies the archive and its inverse-identification MAT member, and uses system libarchive to extract that member. Alternatively pass `--mat path/to/inverse_identification_without_raw_data.mat` or `--rar path/to/Robot_Identification_Benchmark_Without_Raw_Data.rar`. The default replays the two author controls and the three ridge models.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python research/kuka-inverse-torque/compare_torque.py --check
```

Add `--all-controls --details` to run the 256-centre global plus 256-centre per-axis Gaussian kernel model and seven neural controls, and report all six traversals. The neural refits used CPU PyTorch 2.2.2, deterministic seed 172903, 60 epochs and one compute thread. The command reports original and computed forecast identity separately from scores. With `--check`, pooled, axis and design NRMSE must agree with the original within 1e−7 and the three primary gates must reproduce. NumPy, BLAS and PyTorch versions can change floating-point bytes. The frozen registry lists all 13 original hashes. The output JSON gives means, axes, paired designs and worst raw samples. The accompanying comparison file records the independent scalar recount. No test output was decoded during fitting or forecast construction. The later scoring step reads the exact same MAT file by variable name.

## Held motor-torque measurements

Each axis contributes its RMSE divided by that axis’s sample standard deviation in the scored group. “Mean” averages the six axis values. “Worst axis” is their maximum on all 3,636 rows. Each design joins its two 606-row traversals, including every startup row. The training-only development comparison selected basis-position as primary and basis-filter as its closest comparator.

| Frozen arm | Mean | Worst axis | Design 1 | Design 2 | Design 3 |
|---|---:|---:|---:|---:|---:|
| basis-position | 0.405507 | 0.546750 | 0.377577 | 0.412590 | 0.432799 |
| basis-filter | 0.405742 | 0.546990 | 0.377717 | 0.412659 | 0.433275 |
| basis-released | 0.459585 | 0.621934 | 0.441441 | 0.459273 | 0.488263 |
| filter-structural | 0.464633 | 0.640960 | 0.497699 | 0.448856 | 0.458500 |
| position-structural | 0.464724 | 0.641692 | 0.497981 | 0.448830 | 0.458434 |
| history-differences | 0.476249 | 0.625561 | 0.542122 | 0.411425 | 0.486720 |
| nystrom | 0.492152 | 0.616230 | 0.491656 | 0.488776 | 0.508017 |
| history | 0.533955 | 0.701091 | 0.533988 | 0.517782 | 0.558406 |
| filter-mlp | 0.537754 | 0.602919 | 0.643734 | 0.495890 | 0.448629 |
| released-structural | 0.556335 | 0.832398 | 0.530473 | 0.469831 | 0.658468 |
| snapshot | 0.586925 | 0.813150 | 0.592226 | 0.481351 | 0.673853 |
| author-v2 | 0.608600 | 0.709724 | 0.620867 | 0.607337 | 0.615964 |
| author-v1-weights | 1.050469 | 1.963921 | 1.034691 | 1.093371 | 1.042894 |

The primary had to improve both pooled mean and worst axis over basis-filter, and all three design means over author-v2. The comparison against basis-released was registered separately. Direct position won the first two by 0.000235 and 0.000240. In the original authors’ normalized test table, the six axis values are 0.447, 0.681, 0.549, 0.705, 0.710 and 0.559. All six reproduce at the printed precision. The older distributed coefficient matrix fits a different uncentered equation and is retained as author-v1-weights.

The largest direct-position misses in each design were all on joint 2. Row indices are zero-based, joint and design numbers one-based.

| Design | Row | Recorded motor torque (Nm) | Predicted (Nm) | Predicted minus recorded (Nm) |
|---|---:|---:|---:|---:|
| 1 | 25 | -2.080862 | -9.312247 | -7.231386 |
| 2 | 3029 | -3.824239 | -9.243052 | -5.418812 |
| 3 | 3054 | -2.778713 | -9.186249 | -6.407536 |

The independent receiver read the original MAT and the 13 previously locked forecast arrays. A scalar implementation using compensated sums and sample variances recounted 283,608 forecast components, 3,640 metrics and 78 axis-wise worst rows. The maximum numerical difference between receivers was 1.465e-14.

## What information was available

Weigand and colleagues recorded a KUKA KR300 R2500 ultra SE. The output is motor torque calculated from measured winding current using a calibration constant. The released position signals come from secondary encoders on joints 1–3 and motor resolvers on joints 4–6. The prepared data uses zero-phase filtering, position shifted by one 4 ms native sample, model-filtered derivatives and 25:1 decimation to nominal 10 Hz. Both directions of the zero-phase filters use raw samples. Predictions are causal only with respect to the resulting prepared input stream. The released torque labels do not independently measure output joint load.

The organizers process 11 training recordings and the external test recording separately. We used the first nine training recordings to fit development models and the last two to select the primary. Final fits used all 39,988 training rows for the common affine fallback and 39,790 post-startup rows for dynamics. The test restarts its decimation grid at zero. The six nominal path starts are rows 0, 606, 1,212, 1,818, 2,424 and 3,030, within stationary home intervals. Each learned arm predicts the first three rows per nominal path with the same train-only affine fallback. Its dynamic features then use only the current and preceding three samples of that path. All 18 held startup forecasts were scored. The registered author controls keep their own equations.

Across all 12 recordings, corresponding position and velocity reference interiors matched at a 45,453-native-sample forward offset. This establishes same-rate repeats across the 36 compared pairs. It supplies no matched reversal or time-scaling experiment for separating inertial, gravity or odd-velocity effects. Raw references and measured-rate telemetry were used only in the structural audit. Training-only measured-rate comparisons favored the direct-position and filter-derived estimates over the released rate on all six axes. There is no independent acceleration target here.

Each ridge fit uses the same 97-column dictionary, train-only standardization and regularization `0.0005 × n`. Terms include trigonometric pose functions, pose-dependent acceleration, velocity products and bounded velocity functions. The dictionary represents hypotheses about useful covariates. It neither enforces a rigid-body mass matrix nor identifies physical parameters. The approximate filter inverse uses the documented first-order derivative filter before decimation and file-boundary effects. The flexible neural heads marked structural have an unconstrained six-by-six coefficient matrix and also observe the released acceleration in their offset network.

Development costs include 59.04 measured training seconds across seven initial neural fits and 183.94 seconds across seven trajectory-masked neural fits. The eleven timed final non-author arms took 239.85 seconds summed across workers, including 0.99 seconds for the primary. These are measured fit/prediction times under different native runtimes. Source intake, queueing and independent verification are additional. The native forecast registry and development records preserve individual timings, settings and source identities. A missing-SciPy qualification failure performed no fit.

The published normalized linear equation is the executable author reference qualified for this comparison. The paper’s physical model also describes mechanical and hydraulic terms whose calibrated parameters were unavailable in this release. Seven in-house neural controls and a kernel control broaden the measured comparison. Three novel paths on one machine and one recording limit inference about other machines, payloads and raw real-time control.

## Source

Jonas Weigand, Julian Götz, Jonas Ulmen and Martin Ruskowski, *Dataset and Baseline for an Industrial Robot Identification Benchmark*, version 2.0 (April 9, 2023). The public data are available at [DOI 10.26204/DATA/5](https://doi.org/10.26204/DATA/5). The current normalized estimator is specified in listing 3 of the [university-hosted benchmark description](https://kluedo.ub.rptu.de/frontdoor/deliver/index/docId/7284/file/Robot_Identification_Benchmark_Description.pdf). The test record is `recording_2021_12_15_22H_58M.mat`. Source archive, prepared MAT, coefficients, paper and every original forecast are pinned by SHA-256 in the accompanying evidence.
