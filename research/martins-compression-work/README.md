# Finite-time optical compression and the shape of measured work

One of the 72 registered checks flagged a departure from the shape constraints for a fixed quadratic functional of centered Gaussian coordinates. It occurred in the optimized protocol at amplitude label 1 and duration label 0.145. The result depends on how the 10,000 observations are grouped. Five groups flagged no conditions, the registered ten groups flagged one, and twenty groups flagged two. The additional twenty-group flag occurred in optimized 10, 0.447 with an adjusted upper bound of −0.09939. These are approximate conditional screening results. The release provides no timestamps that establish independence of the groups.

## Measurement and information available

Martins et al. measured an optically trapped bead during finite-time compression. Their reported work sums one half of each recorded stiffness increment times the preceding squared bead position at 100 kHz. Finite actuator rise affects the implemented jumps. A measured photodiode signal enters both stiffness and position calibration. The authors report about a 20% change in the largest-amplitude work estimate when the final gain replaces the initial gain.

The public artifact contains 10,000 work values and five scalar calibration or timing fields for each of 18 linear and 18 optimized conditions. It supplies neither the original position and stiffness waveforms nor cycle timestamps, session IDs or per-cycle gain estimates. The paired protocols' reported initial and final stiffness scalars differ at all 18 matching nominal settings. Using each optimized endpoint as the denominator, the largest relative differences are 1.31% and 0.74%, respectively. We retain `tau_p` exactly as stored. Its numerical scale conflicts with interpreting it as the reported dimensionless duration multiplied by the paper's relaxation time in seconds. Duration labels identify conditions throughout.

The author's block calculation uses ten groups of 1,000 work values to estimate a variance error bar. The paper describes those groups as independent. Its nominal Ornstein–Uhlenbeck model predicts the position variance and mean work. Those moments alone leave higher-order work fluctuations undetermined. This course tests two necessary constraints across both protocols using only the released work. It estimates neither a per-cycle drive nor an optimal protocol.

[Paper and measurement protocol](https://doi.org/10.1103/2tp5-1qx4) · [Author release, including original notebook and data](https://zenodo.org/records/19705797)

## Frozen test

For a fixed quadratic form of a centered Gaussian vector, diagonalization gives a sum of signed multiples of independent squared standard-normal variables. A deterministic additive work offset changes only the first cumulant. Writing the weights as λ, the variance, third cumulant and fourth cumulant are 2∑λ², 8∑λ³ and 48∑λ⁴. Cauchy–Schwarz gives a nonnegative lower margin, excess kurtosis minus 1.5 times squared skewness. The sum-of-squares bound gives a nonnegative upper margin, 12 minus excess kurtosis. Both are unchanged by a common nonzero scale applied to the whole condition. Different cycle-specific gains, a noncentered position process or a mixture of waveforms can violate the premises.

The premeasurement commit `a9e0369b55fcb6089cba22031a5b2bbc480cf140` fixes all 36 conditions, both inequalities, and one family-level decision. Each raw moment factor in the polynomial estimator is assigned to a distinct stored block. Under independent blocks with a shared marginal law, that construction removes product bias from repeated use of the same observations. The margins are displayed on a positive common empirical variance scale, which preserves their signs. A delete-one-block jackknife and a one-sided Student critical value with Bonferroni correction for 72 comparisons give the approximate upper screening bounds. A flag requires an upper bound below zero. Ten contiguous stored groups define the primary analysis. Five and twenty define prespecified sensitivities. Student calibration is approximate even if the group assumptions hold. The optical dwell and relaxation times also permit carryover between cycles.

## Observed results

| Stored groups | Lower flags | Upper flags | Conditions flagged |
|---|---:|---:|---|
| 5 | 0 | 0 | None |
| 10, primary | 1 | 0 | Optimized 1, 0.145 |
| 20 | 2 | 0 | Optimized 1, 0.145 and optimized 10, 0.447 |

Across 360,000 released works, 39 were negative and all entered the analysis. The ordinary pooled point estimates crossed the lower bound in 10 conditions and the upper bound in 16. Most such crossings became inconclusive after the registered uncertainty calculation.

For optimized 1, 0.145, skewness was 2.64126 and excess kurtosis was 9.31919. The pooled lower margin was −1.14517. With ten groups, the cross-block margin was −1.12943, its standard error was 0.24460 and the critical value was 4.54851. The resulting upper bound was −0.01688. The corresponding bounds from five and twenty groups were +1.31129 and −0.26077. Nine of the ten individual blocks had negative pooled lower margins, spanning −1.76309 to +0.13522. Deleting each block in turn gave cross-block margins from −1.31500 to −1.03238. The released work ranged from −0.01967 to 5.03667 in units of kBT at 300 K. At the zero-based index 1007, the maximum had immediate stored neighbors 0.18018 and 0.38532. Every stored neighbor enters the calculation. These are neighbors in file order. The acquisition-time separation is unknown.

The lowest primary upper bound for the upper constraint was +3.71294, in linear 7, 0.145. Its excess kurtosis was 12.88945. The most extreme work was 32.78845 kBT at stored index 9283. This illustrates the difference between a raw point crossing and the registered uncertainty decision.

The two margins constrain population cumulants under the stated Gaussian model. The observed flag does not isolate a non-Gaussian bead response from a variable actuator drive, shared calibration error or sampling dependence.

## Reproduction

From a checkout containing the study history, enter this directory and recover the immutable first-opening archive with the command below. Use Python with NumPy and SciPy and the author's `data.npz`. The reader checks the full file SHA-256 before using a restricted decoder for its NumPy object container. The published `comparison.json` and the complete first-opening archive contain all 72 primary checks, per-condition moments, block and leave-one-out margins, the extremal rows and their stored neighbors. The receipt records the environment, exit status and complete captured output. The independent implementation reads inert pickle tokens, derives the cumulant polynomials recursively and counts distinct-block assignments by dynamic programming.

```sh
git show 45a12f592b5bf69160901cb0365a17e81750be8a:research/martins-compression-work/first-opening.zip > /tmp/martins-first-opening.zip
python controls.py
python source_roles.py /path/to/data.npz
python replay.py /path/to/data.npz
python independent.py /path/to/data.npz /tmp/martins-first-opening.zip
```

The six-field input projection qualified locally before the scientific opening. Its separate native read completed later and returned all 36 conditions without decoding any work values. An earlier five-field schema check had correctly refused the additional timing field.

The first native independent-receiver attempt exited before scoring when a byte check detected an extra trailing newline in its inline duplicate of the reader. The corrected receiver obtains the committed reader directly by Git blob identity.

The independent native recount matched all 216 flags across 108 condition/group combinations and all 3,168 numeric comparisons, with a maximum absolute difference of 9.48 × 10⁻¹³. It recovered the same sole primary flag and each stored extremal work index directly from the authenticated author file.

The original analysis ran once on one local CPU after ten native admissions were refused before dispatch. Its archive is 133,332 bytes, SHA-256 `d8a5d478408b7f91c106c9e5886814edb0be5b057670473017b809fd118a744b`. The author input SHA-256 is `65b4ab2c8e4883d6e23cef127727967c85036427864ec0b7474176b5a5fa5b8b`.
