# MAGF-ID Conf_2: prospective multi-sensor stationary reference identification

**Status: frozen BEFORE any Conf_2 numeric gyroscope rows were opened by this
experiment.** This study is separate from the original Conf_1 contrast-only
9/4/4 held-out result, which failed simultaneous transfer qualification.
The immutable preregistration is also taskboard message `161657`
(`fr-disc-active-intervention-worldlaw`).

## Source, physical constraints and selection

Source: Yampolsky et al., *Scientific Data* 11, 1080 (2024),
DOI `10.1038/s41597-024-03917-6`, source dataset
`10.6084/m9.figshare.26927089.v1`, Figshare ZIP file 48979765.
The existing versioned 1,400-entry central-directory manifest is
`research/magfid-covariance/magfid-v1-zip-manifest.json` (SHA256
`dc16b7253a151c88b3dd18a4b8ed2b72bbbc3989443ac0c6db691f94c3708a00`).
Publisher full-ZIP MD5 is metadata only; do not claim it was verified.

Select *all 17* source filenames under `Data/Car_Exp/Conf_2` for which
`DOTs/Bottom/DOT {9,10,11,15} <trajectory>.csv` and
`MRU/MRU measurs <trajectory>.csv` coexist. Each of the 17 verified
pairs has exactly five files, all with ZIP deflate and nonzero CRC/bytes.
For each trajectory, compute SHA256 of compact sorted-key JSON with the
five entries' full source names, offsets, uncompressed sizes, compressed
sizes and ZIP CRC32; sort by (SHA256, trajectory filename). **9 train,
4 validation and 4 held-out final test**, with immutable input manifests,
recording digests, and no late replacement. Reuse the original source
directory bytes and CRC but never use prior Conf_1 labels or outcomes for
Conf_2 hyperparameter selection.

MRU-P gyroscope is at 100Hz with `Gyro_{X,Y,Z} [dps]`; DOT clocks are
about 120Hz with `Gyr_{X,Y,Z} [dps]`. They are not directly on a common
timestamp axis. The published protocol starts the instruments manually,
stands still ~15s, shakes for synchronization, stands still ~15s, moves
and finally stands still ~15s. **Never pretend different sensor clocks
are already aligned.** The primary stationary protocol measures
clock-internal autocovariances and cross-covariances among DOTs on their
source-native shared grid; MRU supplies independent stationary-motion
and bias diagnostics on its own clock. Neither held-out signal, held-out
labels nor source timestamps may be used to retune offsets, rotations,
thresholds, window selection or coefficients. Dynamic inter-platform
alignment is ineligible until an independent calibrated transform is
available; no estimated physical Worldlaw pendulum sensor settings.

## Identifiability

Under the conditional idealization `DOT_i(t)=s(t)+u(t)+e_i(t)`, and
independent `e_i`, four-DOT pair differences remove both the true rate
`s` and the shared sensor error `u`. This makes a contrast-only
absolute calibration **mathematically impossible**. On a genuinely
stationary rigid rig `s(t)=0`, off-diagonal covariance of distinct
DOT channels estimates `Cov(u)`. Negative or inconsistent conditional
estimates must remain visible and cannot be clipped to success.
The independent MRU (separate error `e_R`) is used to challenge the
assumed zero-motion protocol, **not** as a perfect angular-rate oracle;
its unknown error also prevents unconditional physical calibration.
This is a conditional identifiability claim, never a clinical or safety
claim and never a transfer of gyro degrees/sec to pendulum radians.

Use a locked first 12 s and last 12 s of original recordings as putative
standstill, with first and last 1 s excluded from each span. All finite
source timestamps must be monotonic. No interpolation across a missing
DOT native-clock cell. Fit biases and conditional noise curves on train;
derive lag-zero and 0..24 native lags plus nearest native lags
0.5, 1, 2 seconds, de-duplicated (28 lags total). Use 2-second
non-overlapping stationary blocks; center on the *fixed training bias*
rather than independently recentering every held-out block. No
optimization on held-out validation/test labels. Training-only
hyperparameters, stationarity thresholds, lag family, and static
window boundaries stay frozen. If recording properties violate the
protocol, report a refusal rather than substituting nearby windows.

## Adversarial controls and frozen gates

- Actual source report, held-out validation and untouched test are
  separate immutable files, hash-linked to the published ZIP metadata,
  source script and exact data SHA256.
- Compare (i) observed per-DOT noise and shared component,
  (ii) existing contrast-only white+OU method, (iii) IID and
  (iv) single OU memory. Scores are paired on identical timestamps
  and the same held-out 2-second stationary blocks.
- Analyze each axis separately; primary axis Z. Report every
  per-pair lag-zero calibration ratio and the paired normalized 28-lag
  covariance error. Refuse zero-variance denominators.
- The predeclared gate requires ≥3 successful distinct final-test
  recordings, nonnegative identifiable conditional variances,
  every lag-zero ratio within [0.75,1.25], all 28-lag residuals
  within a 95% simultaneous recording/block-bootstrap band
  (2,000 draws, seed 20261119), ≥10% held-out error improvement over
  contrast-only on *the same common observable*, and zero false
  identification decisions in all negative controls. If any fails,
  no promotion, planner setting or physical-confidence claim.
- Negative controls: inject common OU into four DOTs only (contrast
  unchanged; stationary off-diagonal must detect it); inject the
  identical process into MRU as well (common real motion becomes
  fundamentally confounded and must not be called known sensor error);
  shift a DOT by 0.1 s, replace sensor Z with X, duplicate a DOT
  under a fictitious identity, and include an actual shake as a fake
  standstill (reject). Unit-level algebraic controls include source
  selection mutation, suffix mutation, false independence, and held-out
  read-order mutation. Any gate failure stays in immutable receipts.
- External Nullgarden controls keep each recording as an independent
  group, 64 conditional label assignments only if valid matched groups
  exist. An insufficient real cohort must produce a *refusal* rather
  than manufacture pseudo-independent readings. No p-value is inferred
  from deliberately engineered transformations.

No positive numerical outcome was inspected at time of freezing.
This protocol is prospective, and failure to obtain or parse eligible
samples is a negative implementation/data boundary, not evidence of
calibration. Re-run of a failed untouched test never becomes a new
held-out proof.
