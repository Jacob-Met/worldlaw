# Physical sensor covariance: a measured falsification boundary

The MAGF-ID receiving course does **not** qualify a physically calibrated noise
model for the intervention planner. On four untouched recordings, a white-noise
plus Ornstein–Uhlenbeck (OU) model predicts inter-sensor contrast covariance
better than IID or single-OU comparators, but **every model fails the frozen
simultaneous covariance check**. An added shared colored error is invisible to
the contrasts. A lower prediction error is therefore insufficient evidence for
absolute sensor accuracy or a transferable physical reading budget.

This is a reproducible real-input research capability alongside the existing
[declared-covariance planner](CORRELATED_READING_DESIGN.md). The browser still
uses user-declared synthetic sensor parameters. Nothing in this course changes
those declarations into measured physical calibration.

## Source and prospective separation

The primary source is Yampolsky et al., *Multiple and Gyro-Free Inertial
Datasets*, Scientific Data (2024),
[doi:10.1038/s41597-024-03917-6](https://doi.org/10.1038/s41597-024-03917-6),
with the versioned [CC BY 4.0 Figshare dataset, version 1](https://doi.org/10.6084/m9.figshare.26927089.v1).
The publisher describes colocated DOT inertial sensors, synchronized acquisition
and a stationary/shake/stationary introduction before the trajectory. We use
gyroscope angular-rate channels from one mounting configuration; we do not
equate accelerations measured at different points on a rotating object.

Directory metadata selected all 17 `Car_Exp/Conf_1/DOTs/Bottom` recordings and
the same four sensors, 9, 10, 11 and 15: 68 CSV members and 240,273,968 raw bytes.
The source archive is Figshare file 48979765, `MAGF_ID_code_Data.zip`,
1,581,124,263 bytes. Its publisher MD5, `986d16f73c5d115496d1e8c2fa25d266`,
is retained as metadata; the full archive was not downloaded or MD5-verified.
The receiver checks exact HTTP byte ranges, ZIP member names and CRC32, member
lengths and SHA256 hashes. A second CPU worker independently received the same
68 members before executing the analysis.

The [frozen protocol](../research/magfid-covariance/physical-covariance-protocol.json)
was fixed before parsing measurements. For each recording, hash the compact,
sorted-key JSON mapping sensor ID to its uncompressed member SHA256. Sort the
17 recording hashes, then allocate the first nine to training, the next four to
validation and the final four to test. The complete
[split and member identities](../research/magfid-covariance/physical-covariance-split.json)
are tracked. No individual rows cross the recording partitions.

The four final recordings are `MP LM 1`, `Bloom to MP 1`, `MP to Bloom 1` and
`Bloom Double LM 2`. Their numerical values were first opened by the final
evaluation process on 2026-11-19 at 20:17:44 UTC, after the estimator, training
model, validation result and external-control plan had been frozen. No model,
clock mapping, alignment, threshold, feature or cohort was selected afterward.

## Measurement model and its identifiability limit

For a common angular-rate signal, write each calibrated channel as
`y_i(t) = s(t) + e_i(t)`. The pair difference removes `s(t)`. Under zero-mean,
stationary, mutually uncorrelated sensor errors at every measured lag,

```
E[(y_i(t)-y_j(t)) (y_i(t+h)-y_j(t+h))] = C_i(h) + C_j(h).
```

At each lag, a six-row/four-column incidence matrix maps the four conditional
sensor covariances to the six pair-difference covariances. The estimator uses
its unconstrained least-squares inverse, reports every three-sensor solution
and reports the six-pair reconstruction residual. Negative estimates remain
visible. This is a conditional extension of the three-cornered-hat calculation,
not an identification of arbitrary correlated errors or unknown sensor gains.
For the established assumptions and cross-error limitation, see Anthes and
Rieckh (2018), [doi:10.5194/amt-11-4239-2018](https://doi.org/10.5194/amt-11-4239-2018).

If every sensor also contains the same error `u(t)`, then
`(y_i+u)-(y_j+u) = y_i-y_j`. No number of these pair differences can identify
that shared component. An independently calibrated reference or an appropriate
additional intervention is needed to separate it from true motion. Adding more
copies of the same measurement cannot provide that information.

The implemented moments are centered on a **fixed training calibration mean**,
not a mean estimated inside each held-out block. If bias drifts, they are second
moments about that fixed mean, not unbiased estimates of centered stationary
covariance. Keeping this discrepancy is intentional: per-block demeaning could
hide precisely the low-frequency failure this course is intended to expose.

## Frozen estimation and comparison

Native microsecond clocks are unwrapped and joined on exact integer cells.
Training identifies a period of 8,333 microseconds, approximately 120.0048 Hz,
and zero integer offset for all four sensors. There is no interpolation or
held-out outcome alignment. A missing final-test sensor cell remains missing;
blocks require at least 95% valid lag products.

Training alone supplies constant bias from seconds 2–12. A separate secondary
representation fits rigid rotation and scale on seconds 10–25 of training
recordings. It is reported even though it performs worse. The primary
representation retains native sensor axes. The first 40 seconds and last 20
seconds of every recording are excluded from the covariance course.

The fixed 28 lags comprise native sample lags 0 through 24 and the nearest
native lags to 0.5, 1 and 2 seconds. Complete contiguous 20-second blocks are
averaged equally within each recording; recordings are averaged equally.
The four final recordings contribute 5, 10, 11 and 5 complete blocks.

The four comparators are IID, single exponential OU, white noise plus OU, and
a deliberately naive single-sensor motion-residual OU baseline that mistakes
unremoved physical motion for noise. The contrast OU and naive OU use the same
four-series, 257-point logarithmic time-constant grid and the same fitter after
moment extraction. This matches their fitting work; preprocessing differs.
IID and white-plus-OU are complexity controls, not FLOP-matched algorithms.
All coefficients fit on training alone. The OU grid spans half a native sample
period to 10 seconds; a boundary estimate is not evidence of identified memory.

The primary error is the mean squared covariance prediction error over fixed
lags and pairs, normalized by each recording/pair's squared observed lag-zero
variance. A zero-variance pair has **undefined** normalized error, not a large
finite value created by an arbitrary epsilon. Two thousand fixed-seed
hierarchical recording/block bootstrap draws yield 95% intervals and a
simultaneous covariance-residual band. These intervals condition on the fitted
training model; they do not resample its parameters. Four independent test
recordings support limited transfer evidence, not a population-wide guarantee.

Qualification requires positive training sensor variances, every aggregate
pair's lag-zero prediction/observation ratio within 0.75–1.25, and every
covariance residual within the simultaneous 95% band. Absolute calibration and
planner eligibility remain false regardless, because common error is not
identified and gyroscope degrees/second cannot be substituted for pendulum
position units.

## Untouched final-test findings

Lower normalized covariance MSE is better. All four models fail conditional
qualification and the simultaneous covariance-residual check.

| Native-axis model | Validation MSE | Final test MSE | Test bootstrap 95% interval | Lag-zero ratio gate |
|---|---:|---:|---|---|
| IID | 0.02463081 | 0.05252016 | [0.02729723, 0.08176012] | Pass |
| Single OU | 0.02089980 | 0.03021389 | [0.02135042, 0.04430893] | Fail |
| White noise + OU | 0.01265040 | 0.02068795 | [0.01163933, 0.03511867] | Pass |
| Naive motion-residual OU | 1.843419859e9 | 1.332396689e9 | [1.156965715e9, 1.559394108e9] | Fail |

White-plus-OU reduces test error by 60.61% relative to IID and 31.53% relative
to single OU. Its paired error difference from OU has bootstrap interval
[-0.01130095, -0.00755653]. These improvements describe the four frozen test
recordings; they do not rescue the failed covariance model. The naive result
shows that actual motion cannot simply be counted as independent sensor noise.

The training-only rigid/scale secondary representation has final test errors
0.86654184 (IID), 7.88359570 (OU), 7.88125915 (white-plus-OU) and
235,163,240.86 (naive OU), with negative conditional sensor variance estimates.
This falsifies that particular calibration transfer; it does not show that
every possible physical alignment procedure fails.

### Negative controls

| Transformation after fixed alignment | White-plus-OU test MSE | Observed boundary |
|---|---:|---|
| Unmodified | 0.02068795 | Simultaneous covariance check fails |
| Sensor 15 shifted by 0.1 seconds | 0.18984475 | Lag-zero ratios fail; negative conditional variance |
| Sensor 15 Z replaced by its X channel | 0.47787402 | Lag-zero ratios fail; negative conditional variance |
| Sensor 15 replaced with sensor 11 | Undefined | Exact duplicate detected; one contrast has zero variance |
| Identical colored error added to every Z channel | 0.02068795 | Shared disturbance is invisible to pair differences |

The last control injects a stationary OU error with standard deviation
0.18824028 degrees/second and memory 0.8 seconds. The largest change in any
aggregate contrast covariance is 1.73472348e-18 (degrees/second)^2, at numerical
roundoff. Unchanged contrast scores are a demonstrated identification failure,
not evidence that the injected error is harmless.

## Independent Nullgarden consumer

The [external-control plan](../research/magfid-covariance/nullgarden-control-plan.json)
was frozen before final test opening. The receiver imports the unchanged public
server and core from Nullgarden commit
`75527fb3934f65310b63d6ac9880394c5b98dc29`, verifies a clean exact checkout,
and sends real CSVs through `/api/dataset` and `/api/run`.

There are four matched recording batches, two branches per recording and two
identical technical rows per branch: **four recordings**, eight branch subjects
and sixteen rows. The one feature is the native-axis white-plus-OU error,
serialized to twelve significant digits as declared in advance. Technical
repeats stay together. No extra independent batches are invented.

The existing HTTP product fixes five folds and its own seed/budget; it cannot
identify the headline AUC or permutation comparison for this small design and
returns `unavailable`. That refusal is retained. The separately frozen
two-fold, three-repeat, k=1 statistic uses the same unchanged exported core and
enumerates all sixteen within-pair label assignments:

| Engineered comparison | Two-fold AUC | Exact conditional tail fraction |
|---|---:|---:|
| Original versus desynchronized | 1 | 0.125 |
| Original versus shared colored error | 0.33333333 | 1 |

The common-error AUC is the same for every admissible assignment; it is not
evidence of discrimination. Branches of the same recording can occupy
different subject folds, so this statistic does not measure transfer to a new
recording. Conditional label fractions require within-pair exchangeability;
these engineered transformations are not randomized physical interventions and
do not establish causal p-values. The algebraic common-error nullspace is the
stronger identification result.

## Reproduce from exact source

Use Python 3 with NumPy 1.26.4 and the application's Node runtime. Keep raw data
and receipts outside the source checkout. The receiver fetches about 240 MB of
selected uncompressed members; it never parses measurements during intake.

```sh
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
export MAGFID_DATA=/absolute/new/magfid-data
python3 experiments/magfid_intake.py --data "$MAGFID_DATA"
python3 experiments/magfid_covariance.py selftest
python3 experiments/magfid_covariance.py train --data "$MAGFID_DATA" \
  --output "$MAGFID_DATA/model.json"
python3 experiments/magfid_covariance.py evaluate --data "$MAGFID_DATA" \
  --model "$MAGFID_DATA/model.json" --partition validation \
  --output "$MAGFID_DATA/validation.json"
python3 experiments/magfid_covariance.py freeze \
  --model "$MAGFID_DATA/model.json" --validation "$MAGFID_DATA/validation.json" \
  --output "$MAGFID_DATA/test-freeze.json"
python3 experiments/magfid_covariance.py evaluate --data "$MAGFID_DATA" \
  --model "$MAGFID_DATA/model.json" --partition test \
  --freeze "$MAGFID_DATA/test-freeze.json" --output "$MAGFID_DATA/test.json"
NULLGARDEN_SOURCE=/absolute/clean/nullgarden-checkout \
  node experiments/magfid-nullgarden.mjs "$MAGFID_DATA/test.json" \
  "$MAGFID_DATA/nullgarden"
npm run verify
```

Output paths are immutable. A changed estimator, source member, model or split
is refused. Five analytic controls cover exact conditional covariance recovery,
the common-error nullspace, missing native clock cells, exact white-plus-OU
recovery and undefined zero-contrast normalization. The normal application
verification still launches both supported application smoke journeys.

Before the final test, the validation-only v1 receiver exposed epsilon-based
false precision for duplicate channels. Version 2 makes that normalized score
undefined. All nondegenerate v1/v2 validation scores were checked bit-identical;
no fitting, threshold or data selection changed. Both original source/result
histories are retained in the native receiving evidence. The estimator below
has not changed since final-test freezing.

| Exact receipt | SHA256 |
|---|---|
| Final estimator | `31fba3d40243bf7b47695a507e9bf807a194216f0518e440a23485615b480755` |
| Protocol | `97042f722cd3d8d044d23dda782b3c4bf227bbf4bde3d84f42c993ed0d14aa59` |
| Split | `47579b7ed9fd9664c940d77e2a094b49b7534266a51503d2c6dca1b0bf30844f` |
| Training model v2 | `71355a2464963d3911acb0749eea4e67492ec5493e1c8977f29b8f1a6cdb8b1f` |
| Validation v2 | `667da3864901983e9fc9088355cb8e8ec25f721edf3f32a5aeeec2ea7f699728` |
| Final-test freeze v2 | `9a08cb71757a36be9e36e65194cbc435578f35dc3b433ff8f5f0f80b757938cf` |
| Final test v2 | `d2062f79af7b168afc035217ac7ec3f69ed9767f23999535e470b6f3377913eb` |
| External-control plan | `1685ad99b804b41ceeabbb2a1d27e617dc0cc6c2d1dcb58e154b656e32091a85` |
| External-control receipt | `2db0ee8a07cfb64655604de1e3457e4ac5860fb9c55eda689141e48ac497e558` |

The source-independent native course ran on CPU builder 126 under bounded
resource allocations: training/intake command `fe3684-worldlaw-native-train07`,
final freeze `fe3684-worldlaw-final-freeze11`, untouched test
`fe3684-worldlaw-untouched-test12` and source/application receiving
`fe3684-worldlaw-source-receiving16`. Large raw data, generated results and logs
are retained as external evidence, not committed as source.

## Retained evidence and application receiving

The immutable result archive is 676,401 bytes, SHA256
`351324f2d85e7d82036b14b0434fd1245364e24aec15cee1339d8aa5261ae942`.
Its configured-object manifest is
`r2-estate:estate-archive/transfers/fr-disc-active-intervention-worldlaw/fe3684-magfid-v1/manifests/0410578d23c2b5da4aa79b117e060407a8ec4ca37ea7cfdfdbe462a7f7ae4add.json`
(manifest SHA256 `0410578d23c2b5da4aa79b117e060407a8ec4ca37ea7cfdfdbe462a7f7ae4add`,
373 bytes). The maintained retained-file publisher verified full readback in
`fe3684-worldlaw-evidence-publish20`. The archive contains source, complete
model/validation/test results, all external-control CSVs and receipts, and the
original pre-test v1 history. It does not contain raw publisher measurements.

Source receiving passed 2,323 application tests, with zero failures and one
existing skip, plus both launched Studio and Trajectory smoke journeys on
Node v22.23.4. The final maintained intake was separately run from an empty
directory in `fe3684-worldlaw-intake-cold21`: all 68 members and 240,273,968 raw
bytes matched the frozen CRC32/SHA256 identities. These checks establish the
reproduction and application paths, not successful physical calibration.
