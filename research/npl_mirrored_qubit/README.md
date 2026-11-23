# Mirrored pseudoidentities on one superconducting qubit

The minimal driven qubit–TLS generator in Agarwal et al. has an exact classical switching representation for all qubit-only measurements. In a separate depth-forecast test, the fitted switching model lost to a static two-frequency mixture with unequal weights. On 648 later circuits the models had mean predictive cross entropy **0.658634** and **0.658368** nats per shot, respectively. Switching improved on the equal-weight static mixture on 12 of 18 dates. The registered joint criterion failed.

## What the generator identifies

The paper explains how a slowly changing frequency gives a classical two-frequency interpretation. [EQUIVALENCE.md](EQUIVALENCE.md) derives the finite-damping result for the literal minimal generator. Conditional qubit states at TLS-X signs ± evolve under detunings ±ν and switch at rate κ/4 in each direction. The equivalence holds during arbitrary qubit drives and after any qubit-only selected measurement, including measurements on initially correlated states. It requires the specified coupling, TLS dynamics and measurement boundary. Adding a free TLS term proportional to Z makes the conditional pair depend on an additional operator. The hardware can have dynamics outside the model. The proof and its source-only checks preceded all access to measured counts. [Agarwal et al., Sections II.C and IV and Appendices D–E](https://arxiv.org/pdf/2306.13021)

A full joint generator and a separate classical two-sign implementation agreed exactly on 640 dyadic generator blocks and 160 instrument blocks. An independent joint 16-dimensional matrix exponential agreed with 192 idle analytic probabilities to 5.56 × 10⁻¹⁶ or better, including the zero-switching and critical-damping limits. These are implementation checks. The algebra in the proof gives the result for arbitrary allowed inputs.

## Physical observations and information

NPL released results for IBM single-batch experiments collected from 6 to 23 May 2022. Each day contributes 16 batch IDs. Every batch has P(0) counts for X, Y and Z after preparing |+⟩, for blocks of 0,10,…,150 mirrored pseudoidentities. The paper describes four short positive rotations and their four negative counterparts, with fixed execution duration as rotation amplitude changes. Its source models use constant Hamiltonians per gate and omit pulse-shape and SPAM errors. The CSV carries completion times, basis, total rotation, repetition depth and two-outcome counts from 1,024 shots per circuit. It supplies neither shot order, per-circuit execution time nor an independent SPAM calibration. [Dataset, version 1](https://zenodo.org/records/8363718)

The eligibility rule selected the one all-idle batch per date. Each of those 18 batches contained **two recorded rows per X/Y/Z basis**. The other 270 batches paired a driven angle with a zero-angle reference and were excluded. The full CSV bytes were authenticated and the CSV lexer passed over every string. Numerical counts from those 270 batches were never decoded. The all-idle rows supply distinct observed counts. None of the 54 row pairs matched throughout its ten prefix depths. Three of the 324 held paired counts coincided. File order supplies the two within-basis row labels. Timing and independent randomness of those rows are unverified, so each date contributes one comparison unit.

For each batch and model we fitted counts from depths 0–90 only and locked all six forecasts at depths 100–150 before reading the suffix counts. Both rows for a given date, basis and depth share the same probability. Across 11 roles this gives 3,564 probabilities and 7,128 scored model/circuit combinations from 648 physical circuits, totalling 663,552 reported shots. No full-course author-fit coefficients entered the predictions. The paper’s published qualitative observations and aggregate plots were previously exposed. This exercise evaluates new locked forecasts on a historical dataset.

## Models and scoring

The single-channel role uses one damped precession frequency. The equal-weight static mixture adds a symmetric frequency split. The switching model adds a nonnegative flip rate to that same split. The stronger competing static model allows unequal weights on its two fixed frequencies. Each physical model uses identical early data, qubit relaxation and dephasing limits. Observation-corrected roles fit independent false-zero and false-one probabilities per basis within [0,.15]. These terms can absorb several effects and do not calibrate an identifiable hardware readout error. We also retained the ideal-observation source equations, constant and last-depth forecasts, and recursive vector autoregressions of orders one and two.

We fitted observed count pairs with their binomial likelihood, using depth in units of ten pseudoidentities. No interpolated depths were counted. All 2,070 bounded multistart fits reported optimizer convergence, totalling 1,364,606 function evaluations. The 18 successful forecast jobs consumed 83.89 CPU seconds including startup, with largest peak RSS 94,195,712 bytes. These finite optimizations do not rule out additional local optima or frequency aliases. The authors’ reported interpolated full-course residual fits use different information and scoring.

| Role | Held nats/shot |
| --- | ---: |
| Single, ideal observation | 0.673059314 |
| Equal static, ideal | 0.658511455 |
| Switching, ideal | 0.658430248 |
| Single, corrected | 0.672137160 |
| Equal static, corrected | 0.658780646 |
| Switching, corrected (registered candidate) | 0.658633588 |
| Unequal static, corrected | 0.658368003 |
| Prefix mean | 0.686433678 |
| Final prefix depth | 0.702568219 |
| Vector autoregression, order 1 | 0.690844617 |
| Vector autoregression, order 2 | 0.667870759 |

The candidate beat the corrected single and equal-static models and both vector autoregressions. The unequal-static control scored better than the candidate on 11 of 18 dates and five of the six held depths. The corrected candidate’s full binomial negative log likelihood was 6,210.012775 versus 6,033.782910 for unequal static. Their difference of 176.229865 nats equals the per-shot cross-entropy difference multiplied by 663,552. No parameters or membership changed after scoring.

## Largest miss

At depth 110 on 10 May, the second reported Y row measured **693/1,024 = 0.676758**. The candidate forecast 0.412859, the corrected equal-static 0.412995, the unequal-static 0.427474, and the second-order vector autoregression 0.543477. The first Y row at the same depth recorded 662/1,024. Across depths 100 through 150, the two measured count sequences were [530,662,645,627,684,521] and [545,693,633,648,665,508]. The candidate probabilities were [0.4180,0.4129,0.4197,0.4305,0.4372,0.4371]. The complete score retains every row, all model values, individual date/depth comparisons and duplicate diagnostics. This was also the highest-loss date for the candidate. The single- and equal-static fits without observation correction both gave approximately 0.49816 at the worst row.

## Replay and provenance

Run `python3 generator_oracle.py` for the joint/telegraph generator check. With NumPy and SciPy available, `python3 analytic_fixture.py` independently exponentiates the full joint generator and checks prefix access with an invalid suffix. Run `python3 recount.py .` to replay the published forecasts and scores with the standard library. Add `--raw` to reauthenticate the full public CSV and compare each eligible count. `python3 forecast.py ORDINAL` fits one complete registered early batch on the original CSV. The 18 durable forecasts are the authoritative numerical predictions. `score.py` accepts their path, whole SHA-256 and output path.

Source protocol commit 215af0ab, implementation and proof 57e0e3cd, forecast lock 285a3f91, score and independent receiver a460d9ae. The CSV (832,470 bytes) has SHA-256 3917448673855c2e6a7276c078f8f53de5450e9ffb2bef90f2d129b5b72d31a7. The forecast lock (114,094 bytes) has SHA-256 53da3857baaa68d1a50b6f080bbdaac7dca5dc1eaa89af9e0a40244b2265d21a. Decompressed original score (991,178 bytes) has SHA-256 c72f7c220ec740a268afd1befb151fd08cfbf62188e7246cb53cc3373def7765.

The first design-only parser refused NumPy’s printed depth vector before reading counts. Seventeen no-deadline forecast members were explicitly refused admission. Their individual binding checks found no job and before-start cancellation found no row. One original in that batch completed. A distinct finite group admitted the seventeen missing ordinals. One exhausted public package-index DNS retries before Python execution and was recovered in a single separate portable job. The first score request was refused for an invalid retention limit before admission. Its separate valid request executed the unchanged scorer; the fully received original output has SHA-256 10f135eaae24558eef36d7fe5cd83b664ef7b9eae7be92d53dd52e62c18a90d9. No failed request is counted as scientific output.
