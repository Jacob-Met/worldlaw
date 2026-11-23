# Predicting smaller added-mass configurations on the KU Leuven plate

The nested mass-update forecast failed its registered comparison. Across four whole configurations, its mean normalized complex error was **1.880453**, with a worst configuration of **2.335488**. The all-144-node minimum-norm control achieved **1.779730** and **2.024715**. Nine of fourteen pairwise gates passed. All 425,984 held responses enter these results.

| Configuration | Subset update | Healthy unchanged | All-144-node control | Known-subset spatial interpolation |
|---|---:|---:|---:|---:|
| 1 mass | 1.376439 | 1.517121 | 1.472163 | 1.399111 |
| 3 masses | 1.687908 | 1.787204 | 1.651730 | 1.771213 |
| 4 masses | 2.121979 | 2.270849 | 2.024715 | 2.326101 |
| 5 masses | 2.335488 | 2.268101 | 1.970312 | 2.335143 |

These are per-configuration RMS complex errors divided by the RMS measured response at the held port. The one-mass configuration favored the physical update over the full spatial control. In the five-mass configuration, the update also lost to the unchanged healthy response.

## Where the error occurred

All four largest absolute errors occurred at 1,553.900623 Hz when striking node 121 and sensing at node 115. The frozen healthy reciprocity screen returned 1.341372 against its 0.20 limit. Every method therefore carried the same healthy response of −288.182 − 92.107i into this frequency. The three-mass response was −0.488083 − 1.91438i, an absolute error of 301.500412 in the released FRF units.

Among bins that passed calibration, the five-mass self response at 1,102.282994 Hz was 3.84575 + 3.50655i. The subset formula forecast 51.068292 + 220.727634i, an absolute error of 222.294776. On that configuration’s admitted bins alone, the subset error was 2.045435 and the 144-node control achieved 0.924117. This diagnostic leaves every fallback in the primary score.

The worst healthy field conditioning occurred at 80.478574 Hz. Its largest and smallest singular values were 103.633811 and 0.002051946. The registered source screens admitted 4,979, 4,986, 5,001, and 5,001 of 8,192 bins across the four configurations. The independent worker rebuilt all 3,407,872 complex residuals from the four original NPZs, matched the 14 decisions, and reproduced the 32 per-state errors to 2.85×10⁻¹⁴. The small-denominator, gain, and reciprocity screens are all retained in prospective.json.

## Reproduction

The source and outcome locks are compressed archives of 50,758,282 and 27,371,152 bytes. Their full SHA-256 keys and all eight arms, four frequency quarters, component groups and source receipts are in comparison.json. The first native source run failed on publisher DNS before receiving its first input. A separate input transport verified the two official catalogue MD5s, persisted both originals and compared cold SHA-256 readbacks. The corrected source run used those very files, finished at 03:36:22 UTC, and preserved the original estimator. Its full forecast archive was verified before the held outcome job began at 03:42:03 UTC. Both were on November 23, 2026.

```sh
python3 replay.py /path/to/forecast-lock.zip /path/to/outcome-lock.zip
python3 subset_gain_control.py
python3 synthetic_nested.py
```

The archive receiver requires NumPy. The full 315 g elongated-body response remained unopened.

## Mechanism and acquisition

The measured question is whether a transfer learned on one six-mass configuration predicts the frequency response after removing specified masses. The healthy plate had 144 hammer positions and seven accelerometers. The fixed held position, node 121, contributed neither a drive nor a response to fitting the six-mass change. The four smaller configurations contributed no calibration data.

Let G be the healthy reciprocal dynamic receptance and U be the six attached point locations. In a fixed frequency bin, the point-update formula factors the response change through the healthy fields B and an internal scattering matrix T. Removing a set of perturbations J, leaving A, gives

    T_new = T_AA - T_AJ inv(T_JJ) T_JA.

This is the inverse of the A principal submatrix of the original internal dynamic stiffness. It requires the removed masses to be independent local perturbations and the retained attachments and healthy plate to stay reproducible. The measured frequencies, glue, suspension, and repeated impact averaging can violate that assumption. The identity cannot predict an unmeasured change from healthy fields alone, because the release contains no direct healthy transfer measurements between the six mass locations.

Measured healthy transfer is H_ij = l_i G_ij r_j. The healthy reciprocal sensor-port graph supplies the relative gain w_i = r_i/l_i. Dividing each drive column by its w_i gives symmetric coordinates up to a common factor. The measured healthy source fields are B = diag(l) G_SU diag(r_U). Fitting the calibrated change gives an internal core diagonally congruent to the physical one, up to a common multiplier. The Schur complement commutes with that diagonal congruence. Restoring the drive-column gain returns predictions to the released units. This calculation does not estimate an absolute hidden receptance in physical units.

Without a cross-configuration restriction, composed two-sided pseudoinverse interpolation and unregularized full-core fitting can agree exactly. The smaller-configuration receiver never refits a core. Its mandatory projection comparator applies that interpolation to the same six-mass change using just each target's known subset columns. Other controls include the unchanged healthy response, a count-scaled six-site response, count-scaled all-144-node composition of the authors' minimum-norm spatial estimator, and three diagonal approximations. The authors' code targets damage localization. Their 144-node least-squares operation is adapted here to the different held-response endpoint.

The five repeated hammer impacts were averaged. All reported configurations share one plate. Each smaller acquisition has 13 distinct measured coordinates touching the held port: six off-diagonal entries on each side and its self response. All 8,192 frequencies count, including those whose source calibration failed. The single elongated 315 g mass covers three different nodes and is outside the subset intervention.

The preregistered calibration cutoffs are numerical screens. Neither their pass nor failure calibrates measurement noise or proves an intrinsic violation of structural reciprocity.


Original data and methods: [KU Leuven RDR](https://doi.org/10.48804/GDE9TW), [Zenodo version 11033677](https://doi.org/10.5281/zenodo.11033677), [author data article](https://pmc.ncbi.nlm.nih.gov/articles/PMC11875794/). The authentic example_lsqminnorm.py has SHA-256 0ba3ddf8cd66190055b8667c65ebbf252751a717bacca77df9a8a9497b1f5a88.
