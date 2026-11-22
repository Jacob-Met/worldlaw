# Synchronizing repeated inputs in the Wiener–Hammerstein Process Noise benchmark

Column 1 and column 0 of the estimation sweep have exactly the same 64,161 commanded input values. Comparing their measured input voltages at the same stored sample gives an RMS difference of **0.910553 V**. Comparing column 0 at sample `t` with column 1 at `t+1` reduces it to **0.000239 V**. This is a 12.8 µs relative shift at the stored sampling rate of 78,125 Hz. It matters before subtracting nominally repeated records to estimate disturbance variance.

Across all 99 comparisons against column 0, the measured inputs select lag zero 50 times and lag +1 sample 49 times. Every choice recurs in each of four contiguous quarters. Column 48 has the largest residual after alignment, **0.000507 V**, compared with 0.910410 V at lag zero. The independently rounded CSV selects the same 99 lags. Its largest discrepancy from a MATLAB RMS value is 0.000004075 V. The sign convention describes the observed relative input alignment. Electrical input measurements alone do not establish each output channel's physical latency.

## Reproduce the alignment

Use Python 3.11 or newer and NumPy 1.23 or newer. The replay downloads the 423,134,764-byte organizer ZIP and verifies its SHA-256. Pass `--archive PATH` to use a local copy, or `--details` for every per-column lag and RMS in both file formats. The lag search uses offsets −2 through +2 with five samples removed from each edge, using the same interior samples at every lag.

```sh
OPENBLAS_NUM_THREADS=1 python research/wh-process-noise-input-alignment/replay.py
```

The replay authenticates eight estimation MAT members and one corresponding CSV member. It inflates the checked MAT structs as bytes, interprets numeric values only for the commanded input, measured input and sample rate, and converts only the first 200 CSV columns to numbers. The official test members remain unopened. In the eight MAT files, every struct has precisely the fields `r`, `u`, `y` and `fs`. The 28 cross-file pairs have no exact full command vector in common. This comparison does not test partial subsequences.

## Why the noise experiment stopped before output access

The proposed estimate uses pairs of independent noise-on realizations of the same command and initial-state convention, with an independently recorded campaign held out. The published dataset describes campaign windows without assigning an acquisition campaign or a noise realization to each released record. Its two repository versions list the same underlying measurement ZIP. For example, the fade-out MAT header records serialization in November 2015, while its ZIP member is dated December 2016. These are file-write dates. No file-specific acquisition or reseeding record accompanies them.

The triangular commands illustrate the distinction. The first triangle file contains 50 distinct commands, each with four exact repeats of a 16,384-sample period. The second contains 32 distinct commands, each with 32 exact repeats of a 2,048-sample period. A published experiment used the latter geometry and compared three physical wiring conditions, removing the first period as a transient. Geometry alone cannot identify the three intervention banks in this archive. The organizers recorded both official test files with injected process noise switched off. They test deterministic response and cannot supply the proposed noise-on campaign holdout.

For two equal-mean observations with common covariance K and cross-repeat covariance C, their difference divided by √2 has covariance K − (C + Cᵀ)/2. A common command therefore needs independent realizations or a justified cross-covariance correction. Different transients can also affect the uncentered second moment. Even a measured conditional covariance K(u) can be reproduced by an input-conditioned colored output disturbance K(u)¹ᐟ²w with white unit-covariance w. Physical disturbance placement requires additional assumptions or a documented intervention. The proposed campaign and intervention comparison did not qualify. No stochastic model was fitted or scored.

[Released measurements](https://doi.org/10.4121/12952124) · [Organizer protocol](https://www.nonlinearbenchmark.org/benchmarks/wiener-hammerstein-process-noise) · [Zhang, Schoukens and Schoukens, structure-detection experiment](https://doi.org/10.1109/TIM.2016.2647418)
