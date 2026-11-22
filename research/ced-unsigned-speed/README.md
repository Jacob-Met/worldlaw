# Unsigned speed in the Coupled Electric Drives benchmark

The published dynoNet forecast beat an affine quadratic Gram model on both measured drive records. Both models had access to the same voltage history and consumed zero of the ten measured speed samples permitted for initialization. The result reversed the order on the earlier development slices.

| Official free-run RMSE (ticks/s) | Lower-amplitude record | Higher-amplitude record |
| --- | ---: | ---: |
| Gram model with preceding voltage | 0.115507 | 0.128473 |
| dynoNet with preceding voltage | 0.059882 | 0.047408 |
| Gram model from zero input history | 0.115623 | 0.151736 |
| dynoNet from zero input history | 0.079329 | 0.105102 |

The predeclared primary comparison required improvement on both records with their preceding voltage histories. The separate cold-start comparison and the published reference thresholds of 0.062 and 0.047 ticks/s also failed. Author-version and development-version dynoNet executions independently produced byte-identical final weights and predictions. The compact forecast file stores their common arrays once and records both original artifact identities.

## Reproduce

From a clean checkout, run the literal score recount. It downloads the 277,015-byte public organizer archive and verifies both the ZIP and MATLAB file hashes before reading the two records. Python's standard library suffices.

```sh
python research/ced-unsigned-speed/compare_speed.py
```

To use a previously downloaded organizer ZIP and reproduce all 400 warm and cold Gram forecasts from their 680 training targets, run the following command with NumPy and SciPy installed.

```sh
python research/ced-unsigned-speed/compare_speed.py --archive /path/to/FULLTEXT01.zip --refit
```

The official scoring original executed the organizer's unmodified CED loader and RMSE function. An independent MATLAB v4 reader on a second worker matched all 1,080 scored residuals, all 36 chronological block scores and all 12 worst-sample identities. Its greatest RMSE difference was 1.39 × 10⁻¹⁷ ticks/s. Each test comprises samples 400 through 499. Samples 410 through 499 are scored. Indices here start at zero.

## What the paired inputs reveal

The motors drive a spring-loaded pulley. A pulse counter discards the sign of pulley velocity, then analog filtering precedes the recorded speed. The two input voltages differ by 0.5 V throughout the 400 training samples, to within 2.22 × 10⁻¹⁶ V. They share one centered excitation waveform. The observed speed can be negative near zero. On the lower-voltage record, sample 27 reads −0.026862 ticks/s during a +2.06033 V plateau. The physical signed velocity, filter transfer function and disturbance sequence remain unobserved.

For an unfiltered rectifier with a constant signed velocity separation between runs, the separation magnitude lies between the absolute difference and sum of the true speed magnitudes. At sample 167 the observed difference is 1.597070 ticks/s. At sample 115 the observed sum is 0.156288. A uniform error allowance of at least 0.360195 ticks/s per reading is necessary to reconcile these two constraints. This bound applies to that settled constant-separation hypothesis.

We fitted a shared third-order driven model with independent starting states on each record. Its constrained signed offset transient had already reached 0.47968 ticks/s by sample 115. Adding a first-order 12 Hz filter after rectification reduced calibration RMSE from 0.2141 and 0.3228 to 0.2076 and 0.2983. At the high record's sample 167, the filtered model still produced 2.4279 against 3.7631 observed.

For the frozen unfiltered model, each of the 1,024 possible sign assignments to a ten-sample initial window defines a convex polytope of initial states. Vertex enumeration and linear programs agreed on all 4,096 feasibility questions for two regimes and two tolerances. An allowance of 0.004884 ticks/s per reading admitted zero assignments. At the empirical 95th-percentile model-residual allowances of 0.4223 and 0.5342 ticks/s, 21 and 139 assignments survived. Different states gave measurably different early unsigned forecasts. By the final sample their total forecast widths had shrunk below 0.000023 ticks/s. Even allowing a separate optimally chosen state on every later sample left development RMSE floors of 0.2736 and 0.2545. The numerical bounds concern that fitted plant and its specified tolerances.

## Why the Gram model advanced

For a linear latent response with a squared readout, a filter with nonnegative coefficients produces a sum of squares of linear input histories. This motivates a positive-semidefinite quadratic form. The sign of each latent factor can be changed without altering its forecast. The fitted representation includes an affine coordinate and standardization. Reversing the physical input voltage can therefore change the prediction. The unknown analog filter and physical tachometer need not follow the motivating squared-readout model.

Each feature vector contains a constant and twelve cubic-spline projections of the preceding 60 voltage samples. The complete model has a free scalar offset and a 13-by-13 positive-semidefinite coefficient matrix. On the two 140-row development fit sections, paired voltage-offset differences occupied 13 of 91 quadratic feature directions. The full centered design had numerical rank 90 of 91 at relative tolerance 10⁻¹⁰. The constant quadratic coefficient and free intercept are confounded. The largest unregularized development-pilot leverage exceeded 514,000 on both trajectories, versus less than 0.65 across the fit rows.

Training rows 60–199 on each record supplied the initial fit. Rows 210–299 selected a trace penalty of 0.01 by mean two-course RMSE among 0.00001, 0.001 and 0.01. On the consumed development pilot at 310–399, the selected Gram model scored 0.27735 and 0.16749. The actual author trainer scored 0.61554 and 0.47428 on the same warm input histories. The preregistered official Gram refit used rows 60–399 on both records, 680 targets out of the 800 available measurements. dynoNet received all 400 samples of each record, with its own first-20 training-loss exclusion and its original 10,001 Adam epochs, seed 42 and returned final model.

The warm Gram model's worst low-record miss was at sample 435, forecasting 0.310435 against 0.012210 observed. Its worst high-record miss at sample 414 was 0.499622 against 0.065934. At that same high-record sample dynoNet forecast 0.209345. All ninety errors from each course are recoverable with the command above.

## Source identities

The organizer archive has SHA-256 `4379a002295891865ebbf9da15fd1ce253c4ba6586954db525ed6d63d8bb223e`. The preregistered source capsule has SHA-256 `8ef2acf1c7d013a26e43365c440601f8b9e2c1c4a2885dabf65ce1440346d00e`. Stable board records 176205 and 176219 identify the source freeze and three blind forecast originals before evaluation. The complete official result has SHA-256 `4b6aee903074c929e3fb684c1757a13453148db191d8a05712bfcf59412932f1`. The independent raw-MAT result has SHA-256 `22df454f06c984e69629a27afddc71c54510801160b621809f0347c6f04b8d10`.

The author-version run used Python 3.11.9, CPU PyTorch 2.2.2, NumPy 1.26.4, Matplotlib 3.8.4, dynonet 0.1.1 and nonlinear_benchmarks 0.1.2. The second run used CPU PyTorch 2.5.1 and NumPy 2.5.5. Their respective training times were 23.25 and 22.61 seconds on the same physical worker.

[Organizer benchmark](https://www.nonlinearbenchmark.org/benchmarks/coupled-electric-drives) · [Wigren and Schoukens technical report](https://www.it.uu.se/research/publications/reports/2017-024/2017-024-nc.pdf) · [Pinned official loader](https://github.com/MaartenSchoukens/nonlinear_benchmarks/tree/f9fb3883086870a27b31917ccde1f78c95d53cb2) · [Piga and Forgione baseline](https://github.com/dariopi/dynonet_baseline/tree/4b4d609d65a2f9015828efedf6e9f7fce2c35cfe)
