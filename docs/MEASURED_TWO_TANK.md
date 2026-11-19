# Measured hydraulic dynamics — first-party physical falsification

**Status:** preregistered experiment; scientific qualification requires independent original measured-run receipt. This is distinct from WORLDLAW's existing PASCO pendulum work. No synthetic result is labeled measured.

## Primary source and limits

Gómez-González et al., *Multi-scenario datasets for system identification and adaptive control of a nonlinear two tank system*, *Scientific Data* **13**, 1465 (2026), DOI [10.1038/s41597-026-07686-2](https://doi.org/10.1038/s41597-026-07686-2). The 25-run hardware recordings are the author's [Zenodo dataset v2](https://doi.org/10.5281/zenodo.23529910) (CC BY 4.0). Version 2 corrects logged controller Ki/Kd and valve metadata, per [author acquisition/validation code](https://github.com/pedropgg/TwoTank-Dataset-Code) (MIT). Version 1 is refused.

Source ZIP Dataset_v2.zip MD5 **3a70e0b3b9d14b4c0520110963c3d33e**, checked **before extraction**. Every CSV gets its independent SHA-256 in the result; no original raw samples are committed. Intake refuses unexpected file counts, missing v2 headers, invalid clocks, duplicate recording IDs, unsafe archive paths and checksum drift. No online adaptive controller coefficients, PID gains or setpoint/error data enter the learned model.

This is a closed-loop plant. Pump commands react to observed tank state. Predictions conditioned on subsequently logged commands **do not establish counterfactual intervention behavior**. Physical hydraulic parameter identifiability, external calibration, disturbances and actuation safety remain open.

## Prospective protocol

Preregistered before measured CSV observation in HAMON task t-mwn55jc2ouav, post 155623.

- Train: all Baseline and all sorted PassiveOutflow repetitions except every fourth (zero-based indices 3, 7, ...).
- Development: every fourth PassiveOutflow recording; only these tune ridge and, for sparse SINDy-style regression, active-set threshold.
- Sealed external test: all Disturbance files. Selection never accesses this group. Entire recordings, never rows, define roles.
- Inputs: present and previous level, past pump control and valve opening only. The author documents a two-sample input delay. A sensor dropout, missing point or nonconsecutive clock invalidates any row or forecast spanning it.
- Candidate structures: persistence, published-delay AR2, stronger lagged ARX, nonnegative signed square-root hydraulic discharge with pump inflow, and sparsified finite-dictionary SINDy-style model. Every registered selection attempt, including failures, is retained.
- Primary metric: macro per-recording **120-second open-loop RMSE** in tank-level percentage points; 30-second and one-step metrics also report. Rollouts start from two actual observations, then use predicted levels and supplied **logged future control trajectories**, not future observed levels.
- Negative controls: +97-second shifted pump/valve, zero valve, 37-second shuffled training labels, frozen weight digest through test. Control deterioration alone is not proof of causal identification.
- Mechanism promotion requires 10% or larger 120-second macro RMSE improvement over AR2 and no heldout recording worse than twice AR2. If not met, record an explicit failed mechanism.

No test input selects features, model type, hyperparameters or thresholds. A green synthetic test or pushed branch alone is **not** a measured physical result.

## Reproduction

Requirements: Node 22+, unzip and the author ZIP, no npm dependencies. Fetch pinned archive and verify checksum:

~~~sh
curl --fail --location --retry 5 \
  'https://zenodo.org/records/23529910/files/Dataset_v2.zip?download=1' \
  -o Dataset_v2.zip
printf '3a70e0b3b9d14b4c0520110963c3d33e  Dataset_v2.zip\n' | md5sum --check
mkdir -p .receipts
TMPDIR=/workspace/tmp node experiments/two-tank-measured.mjs \
  Dataset_v2.zip .receipts/two-tank-measured.json \
  > .receipts/two-tank-measured-summary.json
~~~

TMPDIR may be any available scratch volume; extracted files are removed on completion. The full report records original file hashes, split identities, all candidate development scores, frozen coefficients, per-recording heldout metrics, negative-control errors, elapsed wall time and the qualified/not-qualified physical verdict. The scientific GitHub Actions receiver at .github/workflows/two-tank-measured.yml executes on the original source, uploads the report and does not commit licensed source recordings.

Source-free mathematical and leakage controls:

~~~sh
node --test tests/two-tank-identification.test.mjs
npm run verify
~~~

The broader unknown-physics/active-intervention product remains open. True causal qualification would need independently randomized safe actuator interventions, calibrated sensors and independent apparatus validation.
