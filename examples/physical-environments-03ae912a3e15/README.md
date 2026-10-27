# PASCO comparison across two declared conditions

Source: [Enze Xu and collaborators' Damped Pendulum Dataset](https://github.com/EnzeXu/Damped_Pendulum_Dataset), pinned to `cbf82673641ecd65e902ad5c38a048387649a2a0`. The complete author README and Apache 2.0 license are retained beside this file.

This recovery contributes to WORLDLAW [issue #29](https://github.com/Jacob-Met/worldlaw/issues/29), preserving the original `hamon-171b58b2f93b-20261023/mechanism` attribution. It compares the same nominal 0.330 m apparatus in air (condition 1) and with a small paper baffle (condition 2). It does not implement geometric scaling (#33).

## Source selection

Repetitions 1 and 2 in each condition train the fixed comparison. Repetition 3 is reserved until the fitting implementation, protocol, source hashes and full training ledger have been frozen. The original interval 5–15 s is retained inclusively: 1,001 samples and zero-based source data rows 500–1500 per recording.

Original timestamps and angles are unchanged. Initial angular velocity comes from the sensor's angular-velocity column at the first retained sample. No recentering, resampling, smoothing of exported observations, or time-origin shift is applied. Weak-regression local rate estimation is internal model preparation and is disclosed separately.

Every exported run retains its raw SHA-256, exact author URL and commit, recording identity, condition, repetition, interval and initial-rate provenance. The raw CSV bytes and author license remain unchanged. The JSON extraction is a WORLDLAW modification of those sources.

## Reproduction

`python3 examples/physical-environments-03ae912a3e15/build-bundle.py` reconstructs the training bundle from retained CSVs, fetching only absent pinned training CSVs. HTTPS certificate verification remains enabled.

The reserved source receipt requires `--receive-challenge --frozen-receipt docs/receipts/shared-environments-20261027/training-freeze.json`. The extractor checks every frozen implementation and training-source hash before opening the reserved CSVs.

The frozen weak comparison enumerates all 57 subsets of the declared six terms under each of three sharing assumptions. Source-only notebooks recompute fitted models when reopened; they do not trust serialized model answers.

## Limits

The three modes are complete pooling; shared spring, gravity and bias with condition-specific rate, Coulomb and quadratic-rate terms; and fully independent condition coefficients. Physical inertia and absolute torque remain unknown. A baffle may change inertia or measurement zero, so equal restoring coefficients are a hypothesis to test. These are additional recordings of observed conditions, not transfer to an unseen mechanism.

Training preferences, independent-recording prediction and integration-step sensitivity are separate results. The weak score uses overlapping normalized windows and is a comparison heuristic, not calibrated model probability. No result is required to favor shared restoration.
