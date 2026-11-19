# MAGF-ID Conf_2: untouched physical-reference test and independent control receiving

**Result: FAILED physical calibration / absolute identifiability. No Worldlaw sensor or
planner parameter is promoted.** This is a measured negative research result,
not a synthetic demonstration or an untested proposal.

The [prospective protocol](CONF2_PROSPECTIVE.md) and taskboard
`fr-disc-active-intervention-worldlaw` message **161657** were fixed before
any Conf_2 numerical measurement was opened. The original publisher
`Car_Exp/Conf_2` cohort is independent of the previously studied
`Car_Exp/Conf_1` recordings from [PR 644](../../docs/PHYSICAL_SENSOR_COVARIANCE.md).
The source is Yampolsky et al., *Scientific Data* (2024),
[doi:10.1038/s41597-024-03917-6](https://doi.org/10.1038/s41597-024-03917-6),
publisher Figshare v1. **85/85 original files**, consisting of 17 synchronized
configurations of four DOT gyro recordings and one MRU-P recording, passed
exact ZIP CRC32 and SHA256 receiving, **285,167,789 uncompressed bytes**.

## Source, freeze and first untouched receiving

- Independent GitHub Actions CPU receiving
  [original successful run 44616271658](https://github.com/Jacob-Met/worldlaw/actions/runs/44616271658),
  at source commit `578e40191a070583676bb400970716ada384b074`;
  the original untouched four test recordings were first opened *only after*
  training on nine recordings and validating on four. Earlier run 44615889132
  had successfully received raw data and written validation, but its stdout
  failed on a NumPy Boolean serialization after the immutable validation
  receipt was already saved; it did **not** open final-test rows. The correction
  was stdout conversion only, not science, thresholds, selection or fitting.
- [Immutable scientific evidence artifact](https://github.com/Jacob-Met/worldlaw/actions/runs/44616271658/artifacts/14575186173):
  ZIP digest `03412f5819f42f5cc18979aeeffd347f72bfc66688c39852efdf933f35bb7bea`.
  This includes each source-file SHA, frozen cohort, training and validation
  receipts, signed freeze, full four-recording final prediction and all
  original-negative-control decisions. No 285MB raw data is committed.
- Immutable source/test SHA256 receipts:
  `selection.json b200c0668069a7b0cd1bd64d459de567e2b758e63cb197aa9d2ff2acf5da25dc`;
  `train-model.json 5b080983ecdd4c3c357cb032c37b30ae55497264e3720bb3563f6198b9bf2842`;
  `validation.json 85d5e390c13663a96415a1b501658709fb1fdadb86b1b3031d03678386ceee94`;
  `test-freeze.json 0387231a37ec8fef179c93ee37c843de17473eaf32b4c8840718acfabc07dd3d`;
  **`test.json 8f1898f2e5d7395582f65d8be5e24ff5a6d46e1cb4d060c1d4e36e9dae2f17a2`**.
  Exact complete receipt manifest is inside the artifact.
- Original receiving: Python 3.12, NumPy 1.26.4, native DOT time period
  8,333 microseconds, no interpolated cells; separately read 100Hz MRU-P clock.
  The frozen 28 lags are 0–24 samples plus 0.5, 1 and 2 seconds, with
  nonoverlapping stationary anchor blocks. Four final original recordings:
  **MP Square 2, MP LM 1, Bloom Square 1, Bloom to MP 3**. Every named
  recording is source-SHA bound. GitHub Actions completed all stages.

## Held-out physical outcomes

Metric: mean squared *normalized covariance prediction residual* across
held-out original recordings and 28 lag samples; **lower is better**.
The comparison is on the same absolute DOT covariance observables.
It is not the earlier Conf_1 pair-difference metric.

| Frozen model | Four validation recordings | Four first untouched test recordings |
|---|---:|---:|
| Contrast-only white+OU baseline (no common-error identification) | **0.052362051** | 3.783292644 |
| IID independent noise | 0.087005367 | 3.783286882 |
| Single OU no shared component | 0.518170676 | 3.783182972 |
| New conditional shared white+OU candidate | **1.933949171** | **3.782850902** |

The candidate was **36.93× worse** than contrast-only on validation.
It reduces final-test error relative to the contrast model by only
**0.011676%** (relative gain `0.00011676128043469625`), versus the
precommitted **10%** requirement. The test does not reproduce the large
improvement observed in the separate synthetic analytic demonstration.
It would be false to present the shared candidate as validated.

Training mean shared lag-zero source covariance was approximately
**0.01420256 (degrees/second)²**, while the candidate's untouched-test
lag-zero prediction/observation ratios by DOT sensor were
**0.000549, 0.000560, 0.000532, 0.000502**. These predict roughly
**1/1,800–1/2,000** of the observed second moments and fail the frozen
[0.75, 1.25] calibration window by orders of magnitude. The six
test pair-contrast lag-zero ratios were 1.0405, 0.9189, **0.7240**,
1.2083, 0.9260 and 0.7835. Even one ratio outside the window is
fatal; the sensor errors here are much larger.

The predeclared 2,000-draw recording/block bootstrap simultaneous
test band was 2.16411 in normalized units and the candidate's
largest mean residual 0.99951 was inside that *very wide* band.
This does **not** imply fit: the lag-zero gate and prospective
held-out improvement decisively fail, and bootstrap intervals
condition on the frozen model with only four independent recordings.
MRU stationary residual RMS for the four tests was
0.05048, 0.05040, 0.05260 and 0.04362 degrees/second;
that diagnoses MRU's apparent stillness but is not a high-fidelity
absolute angular-rate truth reference for every DOT axis.

## Actual-source falsification controls

- Adding the same simulated colored disturbance to all four real DOT
  Z streams changed every pair-difference covariance only at
  numerical roundoff (max `3.41×10^-13` in the worst source
  recording), **while** stationary cross-DOT covariance changed
  by +0.8284, +0.8828, +0.9417 and +9.3740 (degrees/second)².
  Therefore four-sensor contrasts fundamentally cannot identify
  shared error, even when a model's numerical score appears good.
- Delaying one DOT by approximately 0.1 second was recognized by
  the unchanged native alignment diagnostic: source offset
  `0→−12` in all four final recordings. Z→X substitution,
  fake duplicate sensor, source SHA mutation and engineered
  shared motion on MRU were also rejected in all four.
- The naively chosen 14–25-second purported *shake* window exceeded
  a 0.5-degrees/second RMS threshold on **only two of four** real
  final recordings (0.6323 and 0.6802; the other two were 0.3320
  and 0.2083). Therefore the shake-as-standstill negative
  control **fails** 2/4; we do not adapt its timing or threshold
  on the seen final test to turn the gate green. Proper native
  source synchronization and reproducible independent stationary
  intervals remain an unsolved physical identification bottleneck.
- Gate state: four independent test records yes; nonnegative training
  conditional variances yes; MRU first/last static check yes;
  wide bootstrap simultaneous band yes; **lag-zero calibration no;
  10%-gain no; all original negative controls no**.
  Independent Nullgarden is informative but never overrides those.

## Independent Nullgarden negative receiver

A **separate CI runner and unmodified** Nullgarden source
`75527fb3934f65310b63d6ac9880394c5b98dc29` received precisely
the first untouched `test.json` hash above, not rerun values.
[GitHub Actions run 44617183946](https://github.com/Jacob-Met/worldlaw/actions/runs/44617183946)
completed both its original unchanged HTTP/core consumer and an exact
16-label within-recording conditional allocation enumeration.
[Preserved receipt artifact](https://github.com/Jacob-Met/worldlaw/actions/runs/44617183946/artifacts/14574164799)
has receipt SHA256 `6a732af33237aae07fbaaaaafe9d281300eac4e97b5744693e6112d91e46cde7`,
artifact ZIP SHA256
`3c101129374ec976812cc87d0bd07e60a4eab9892cfe37aa35ded79010682031`.

| Conditional matched comparison | Two-fold AUC | Exact within-recording label tail fraction |
|---|---:|---:|
| Conditional shared candidate vs frozen contrast-only | **0.25** | **0.875** |
| Same candidate vs identical candidate no-effect sham | 0.333333 | **1** |

The existing original Nullgarden HTTP product independently reports
**`unavailable`** because five-fold training loses a class
with the four-recording design. The custom two-fold conditional
statistic is only an engineered diagnostic on four paired original
recordings and 16 exact assignments; it is **not independent new
recording transfer**, a randomized physical intervention, or a
causal p-value. The sham's identical input was not distinguishable.
None upgrades a broken physical covariance model into a calibrated
sensor.

## Boundary and next rigorous intervention

The physical problem has two separate non-identifiabilities:
shared DOT error is invisible in all pair differences; the MRU
cannot itself distinguish global physical motion from error shared
by all five sensors without an independently justified uncertainty
model and source-controlled alignment. A valid next attempt requires
**truly independent external angular-rate/position ground truth**,
or controlled imposed known-rigid stillness plus independently
calibrated per-device clocks/orientations, with new unobserved
recordings or new physical acquisition. This frozen Conf_2 held-out
set cannot become a fresh final test by rerunning, changing thresholds
or selecting only favorable trajectories.

Reproduce the source-only controls with
`python3 experiments/magfid_reference.py selftest` and
`python3 experiments/magfid_reference_tests.py` after installing
NumPy 1.26.4; the full exact source/receipts use the
[one-time receiving workflow](../../.github/workflows/magfid-reference-physical-once.yml)
and the independent
[Nullgarden workflow](../../.github/workflows/magfid-reference-nullgarden-once.yml).
Running either again is a reproducibility check, **not** a new
blind held-out result. No browser calibration, physical confidence
or Worldlaw planner setting is changed by these experiments.
