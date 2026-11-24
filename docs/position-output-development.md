# Fitting the measured position trajectory

The registered continuous-actuator recording supplies commanded input, imposed initial velocity, and measured position. Velocity after the first sample is latent. Worldlaw #891 recovered a generator from complete position/velocity measurements on eighteen authored comparisons. Applying that estimator directly would require an additional sensor here.

The round-two weak model supplies the initial coefficients and the set of terms to fit. For each trial, the maintained physical rollout starts once from the first measured position and imposed velocity of each acquisition. It integrates forward through the recorded command sequence, then compares all 200 subsequent positions to the observations. Each acquisition has its own initial state. The objective sums squared position errors across the four acquisitions.

The refinement estimates the sensitivity of the predicted positions to each coefficient by centered finite differences. The perturbation is 1e−5 times the greater of one and the coefficient magnitude. A normalized QR solve uses ridge 1e−8 in normalized coordinates. Up to eight Gauss–Newton steps are allowed. Backtracking tests scales 1 through 1/128 and accepts a strict aggregate squared-error decrease. An unexcited sensitivity, numerical refusal or unsuccessful update preserves the previous model. The returned model has the same torque terms, together with per-acquisition free-running RMS and maximum errors.

## Recorded development result

Task receipt 194147 froze this procedure, the four acquisition names, the source artifact and the gate before fitting. The read path takes only source-0, source-1, round-1 and round-2 under the frozen active arm and the selected model in the round-two training receipt. It loads 4,824 measured positions and scores 4,800 after excluding each imposed initial sample. Errors are radians.

| World | Recorded weak RMS | Output-fit RMS | Reduction |
| --- | ---: | ---: | ---: |
| 1001 | 0.00243223 | 0.00200484 | 17.57% |
| 1002 | 0.00216246 | 0.00205621 | 4.91% |
| 1003 | 0.00331401 | 0.00193921 | 41.48% |
| 1004 | 0.00307353 | 0.00201735 | 34.36% |
| 1005 | 0.00312362 | 0.00200694 | 35.75% |
| 1006 | 0.00489862 | 0.00203710 | 58.41% |

All 24 individual training acquisitions improved. Five of six world-level RMS reductions exceed the registered 10% gate. World 1002 missed it. The original worst acquisition was round two on world 1006, where RMS fell from 0.00860596 to 0.00202428. The largest remaining acquisition error was 0.00220248 on the first source acquisition of world 1002. Independently replaying at maximum RK4 step 0.005 seconds preserves all 24 improvements. The largest per-acquisition RMS movement across meshes was 2.14e−9 before fitting and 8.15e−11 afterward.

The four-acquisition comparison measures in-sample trajectory reconstruction. Each world uses all four of its recordings for fitting and scoring. It preserves the 18 full-state outcomes of #891. Worldlaw already ranked position forecasts by independent world, as recorded in #892. Scalar-coordinate pooling was a deliberately incorrect comparison for its full-state acquisition adapter.

## Leaving out one development acquisition

Receipt 194243 registered a separate retrospective transfer test before fitting any fold. For each world and each of its four development acquisitions, the original weak discovery procedure reselected its terms and coefficients using only the other three. The position fit used the same three and kept the selected terms. Both models then forecast the omitted recording from its command sequence, first measured position and imposed initial velocity. The original protected forecast and calibration records stayed sealed. The four-acquisition weak discovery replay recovered each archived model to within 2.23e−16 in its coefficients.

| World | Weak omitted-acquisition RMS | Output-fit omitted-acquisition RMS |
| --- | ---: | ---: |
| 1001 | 0.00292474 | 0.00201481 |
| 1002 | 0.00331768 | 0.00209309 |
| 1003 | 0.01268399 | 0.00194923 |
| 1004 | 0.00392013 | 0.00202819 |
| 1005 | 0.00418334 | 0.00202036 |
| 1006 | 0.35360052 | 0.35419784 |

The position fit improved 23 of 24 omitted acquisitions and five of six world-level RMS values. The worst fold was world 1006, round one, where weak and output-fit RMS were 0.70691106 and 0.70838656 radians. Its three retained runs used only commands from {−1, 0, 1}. At every one of those inputs the linear and cubic actuator terms agree exactly. Swapping those terms at the same coefficient therefore preserves all noiseless training trajectories. The three-run weak fit selected the linear term. The omitted run used four other command levels, with maximum |u³−u| of 0.375. Refining coefficients on the retained runs cannot resolve that ambiguity. Both time meshes retain the failed forecast.

The full coefficients and per-acquisition measurements appear in the two JSON receipts under `docs/receipts/position-output-development/`. To repeat the comparisons, obtain Worldlaw Actions artifact 14865225011, named continuous-rival-development-45268239303, set WORLDLAW_POSITION_OUTPUT_ARCHIVE to its ZIP path, and run the following command. The reader checks the archive digest before opening the named development training members.

```sh
node --test tests/position-output-fit.test.mjs tests/position-output-course.test.mjs
```
