# KEMAR near-field binaural transfer

An ear-centered angular correction improved the released finite-element prediction on unseen directions and shorter source distances. A local calibration using the same measurements and finite-element predictions performed better. The ear-centered correction failed both registered development criteria. The 1,872 points reserved for the final comparison remained unopened.

## Measurements and comparison

Li and colleagues released two-ear impulse responses at 83,448 measured and 130,551 simulated positions. Their experiment used two outward source sweeps per direction. The published measurement is their average. Source positions along one sweep share motion and adaptive filter history. A single frontal reference microphone recording served every direction. Each KEMAR ear had its own gain and filter chain. The authors retained the first 256 samples of 512-tap adaptive estimates. See the [original acoustic data](https://doi.org/10.5281/zenodo.7626148) and [measurement paper](https://aes.org/publications/elibrary/elibrary-page/?id=22097).

The simulation used reciprocal adaptive-order finite elements. The paper describes CAD for the measured head and names the recorded manikin as GRAS 45BC. The simulation file identifies a GRAS 45BB with anthropometric pinnae. Both files give the conventional ear positions at lateral offsets of +0.09 and −0.09 m, forward +X, upward +Z, 48 kHz and zero additional delays. These coordinates define the comparison. The release provides no separate survey of these offsets or per-ear gain and timing calibration.

The two source geometries agree exactly at 25,272 coordinates spanning 936 directions and 27 radii from 0.30 to 1.08 m in steps of 0.03 m. Training used 468 directions and 12 outer radii from 0.75 to 1.08 m. Development used 234 different directions and seven radii from 0.54 to 0.72 m. The reserved final panel uses another 234 directions at eight radii from 0.30 to 0.51 m. These splits cover positive and negative elevations, where the authors used different support arrangements.

For each of 40 Fourier bins from 562.5 to 7,875 Hz, let y and p be the complex measured and predicted ear vectors. The error is the squared determinant magnitude divided by the product of squared norms. Zero means that the prediction matches the relative complex ear response up to a common scalar. An error of one means the normalized vectors are orthogonal. This observable retains interaural phase and level. It cannot establish absolute transfer or separate ear gain from the acoustics. Finite source directivity, dissimilar ear processing and windowing can alter it. The synthetic two-sample example in projective.py shows a common filter followed by truncation can produce error 1/6.

The registered candidate multiplies each FEM ear response by a complex degree-three angular correction, using the direction from the registered ear to the source. Its head-centered counterpart uses the identical basis and fitting procedure. A richer comparator adds inverse-radius interactions. The local residual comparator interpolates the two-ear measurement-to-FEM correction as a complex rank-one projector across eight neighboring training directions at the closest available training shell. All four parametric corrections selected ridge 0.01 on nested training directions and shells. The development forecasts were immutable before their target measurements were read.

| Frozen development method | Mean over 234 sweeps | Worst sweep |
| --- | ---: | ---: |
| Released finite elements | 0.015783 | 0.119010 |
| Global differential ear gain | 0.013760 | 0.126202 |
| Ear-centered correction | 0.012200 | 0.112810 |
| Head-centered correction | 0.012064 | 0.113237 |
| Head-centered with inverse radius | 0.012380 | 0.114447 |
| Neighboring measured responses | 0.069442 | 0.307478 |
| Neighboring measurement-to-FEM corrections | 0.006933 | 0.075675 |

The candidate had to improve both columns over all six comparators to open the final panel. Both gates failed. All 65,520 measured frequency-position pairs had a nonzero two-ear norm. Sweep averages describe the released averaged directions. They do not give independent trial counts, a confidence interval for clinical hearing outcomes or evidence that acoustic parallax is absent.

## Largest individual error

At 45° azimuth, −20° elevation, 0.54 m and 7,875 Hz, the observed left and right values were approximately (−0.000117 + 0.038198i, −0.077287 + 0.092653i). The candidate gave (0.127866 + 0.540735i, 0.039683 − 0.169503i). Its interaural level was +10.081 dB against −9.990 dB observed. Its left-minus-right phase was +2.67942 rad against −0.69215 rad observed. Their squared norms were 0.01601699 and 0.33905015, giving product 0.00543056 and squared coherence 0.00433180. Their relative amplitude and phase jointly give error 0.995668. The candidate’s largest **sweep average** occurred separately at 25° azimuth and −25° elevation.

An independent receiver downloaded the original measured SOFA, computed its checksum, evaluated the discrete Fourier sum directly, and used the complementary complex inner product. It agreed across all 458,640 arm-position-frequency losses within 2.70×10⁻¹⁴. Its first coordinate selector included measured-only 1 cm shells and stopped at the row-count check before reading impulse responses. The corrected reader uses the measured/simulated 3 cm intersection. The registered models, releases and gates remained fixed.

## Reproduce the development course

Install NumPy 2.2.6 and h5py 3.14.0 and place the two original SOFA files from the archive in one directory. The saved schema pins their SHA-256 checksums. Run from this directory with a new output path.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python replay.py --source /path/to/sofa --output /path/to/new-result
```

The command writes and hashes all seven forecasts before its scorer selects the development rows. It checks every sweep and raw worst case and runs the independent reader. It reports original byte identity separately from numerical reproduction. A common phase of a neighboring-projector eigenvector can depend on the linear algebra library. The replay compares its outer product in that case. The public replay opens zero final-panel measurements.

Source access, both source identifiers, the two recorded receiver paths, the first cardinality refusal and original artifact digests are recorded in course-receipt.json. The full frozen registration, all development sweep scores and independent vector witnesses are included here. The binary SOFA files remain available from the authors.
