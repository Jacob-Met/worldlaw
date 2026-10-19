# Primary-source measured angular telemetry and an explicit unknown-torque-scale consumer

Date: 2026-10-19. Scope: finite-library autonomous scalar angular dynamics. This is a reproducible component/input research receipt, not a claim of arbitrary-law discovery, mechanism reconstruction, an adequate measured physical law, or transfer to unseen apparatus. The source search was deliberately bounded to a few promising primary datasets.

## Result

The author-maintained **Damped Pendulum Dataset** supplies legally reusable actual recorded angles, timestamps, sensor angular rates, and separate repetitions of a common apparatus. It does **not** establish absolute inertia in the inspected source. WORLDLAW therefore receives it through a separate angular-acceleration schema, with `inertia: null`, no physical torque commands, and no identified absolute torque scale. Three unchanged raw CSVs and their original license are included, along with an auditable extraction script and the resulting input bundle.

The original cumulative integral estimator fails the fixed measured challenge, with a large training mismatch and a typed runaway. A separate compact-window weak estimator removes the starting-rate nuisance from fitting. With settings frozen using analytic development and the two measured training recordings, it produces a finite 20-second prediction on the reserved third recording, but its 0.322968 rad RMSE and training mismatch remain substantial. The better numerical result is an estimator improvement on this receipt, not a validated explanatory law.

## Source qualification

| Primary candidate | What was actually inspected | Reuse evidence | Qualification / reason not selected |
|---|---|---|---|
| [EnzeXu/Damped_Pendulum_Dataset](https://github.com/EnzeXu/Damped_Pendulum_Dataset), author repository | README, license, complete file tree, processing/column code read without execution, three original CSVs | README explicitly licenses the dataset Apache-2.0; original license copied | **Selected for angular-only mode.** Actual PASCO angle/rate recordings, explicit SI headers, separately named repetitions. Absolute inertia and independently verified actuator torque are absent. |
| [Gießler, Kinematic data of a pendulum serving as an angular acceleration reference](https://doi.org/10.6084/m9.figshare.28271405.v1) | Public Figshare API metadata, angle and angular-velocity CSVs, [primary article](https://www.nature.com/articles/s44172-025-00384-8) | Figshare metadata identifies CC BY 4.0 | 648 timestamps, 0–3.235 s, 0.005 s interval. Columns mix measured sensor methods and model predictions for a trajectory. These columns are not independent physical runs. Public files do not clearly establish two separately recorded train/challenge runs or an independently measured absolute inertia. Not converted. |
| [dynamicslab/MultiArm-Pendulum](https://github.com/dynamicslab/MultiArm-Pendulum), commit `e99a7e13fe2adc8fc647321a156b6cb59a48a698` | README, single-pendulum data explanation, parameter-estimation instructions/source, free-swing MAT, optimized-parameter MAT, MATLAB dataset structure | Repository MIT; [Zenodo supplement](https://zenodo.org/records/6633719) metadata CC BY 4.0 | Actual hardware data are valuable, but the reported inertia is an **optimized parameter**, not an independent calibration. Main free-swing MAT has cart velocity, not a clearly mapped angular starting rate. The parameter-estimation workflow divides one recording into six segments; these are not independent recordings. Moving-cart data also need a forcing model, not a fabricated torque-command conversion. Not converted. |
| [Khasawneh-Lab/simple_pendulum](https://github.com/Khasawneh-Lab/simple_pendulum) | Repository description and files | Repository MIT | Design/simulation material was located; a qualifying recorded scalar time series with the required field/recording contract was not located. No simulated fixture was relabeled as measured. |

The Figshare checks used its [primary public API](https://api.figshare.com/v2/articles/28271405). `angle.csv` SHA-256: `dde9ee9df4a5a0a1f58f36ad242e4f81b701fe7eafa753041131c6f33f39de16`; `angular_velocity.csv`: `508ea738c8f73ef60c5c0308885a54042f2eaad74124d375587069ff46003de7`. The inspected MultiArm free-swing `SingleDataFreeSwing_1_Dt_0_0001.mat` SHA-256 was `5e6272350a91fb9fb99b6949bc49e3e63e21af977cc1f777310f5d8e9b0fc7e7`. Those rejected-candidate files are not redistributed here.

## Selected source, rights and transformation audit

Source: [Damped Pendulum Dataset](https://github.com/EnzeXu/Damped_Pendulum_Dataset), exact revision [`cbf82673641ecd65e902ad5c38a048387649a2a0`](https://github.com/EnzeXu/Damped_Pendulum_Dataset/tree/cbf82673641ecd65e902ad5c38a048387649a2a0). Author citation: Enze Xu, Toon Tran, Hongjue Zhao, Yuchen Wang, Mengdi Huai, Huajie Shao, *Identifying Invariant Physical Dynamics Across Multiple Environments*, TMLR 2026, [primary paper record](https://openreview.net/forum?id=xvQYvYEGhj).

The README identifies experiments at William & Mary using a PASCO PS-3220 rotary motion sensor. Its collection spans five stated lengths, three damping conditions, and three repetitions per setting. This receiving uses only length group 1, air condition 1: a single common apparatus/condition, with recordings 1 and 2 for fitting and recording 3 reserved for challenge. The author length is 0.236 m. Length alone does not establish an absolute moment of inertia or a point-mass assumption.

The source README explicitly applies Apache License 2.0 to the dataset. `examples/physical-pasco-92be/LICENSE` is copied unchanged; the adjacent README attributes the authors and marks WORLDLAW additions. There was no NOTICE file in the inspected source tree. Raw CSVs are byte-identical to the pinned source. Their original headers, unused columns, precision, blank cells and UTF-8 byte-order marks are preserved. The extracted bundle is a changed selection with source, revision, original hash, exact rows, units, and transformations stated for each run.

| Original file | Bytes | SHA-256 |
|---|---:|---|
| `raw_data/len1_cond1_1.csv` | 329379 | `3d407510fd2c0fcbca7f7b3a223f34f0788821f3a21b6b94ccd24a087b6a19be` |
| `raw_data/len1_cond1_2.csv` | 325260 | `7004af991027cf58c2eb59b924e344a203277fb47c453ecbd026e06e8cf71824` |
| `raw_data/len1_cond1_3.csv` | 319138 | `f034b8900c7b78f0dbe46805c2d5faa41bb1e238558302156d4965cfc1b4603c` |
| `LICENSE` | 11357 | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |

The author processing script starts from raw time 5 s, ends before 65 s, subtracts 5 s, rounds selected values and adds peak flags. WORLDLAW **does not execute that script** and instead preserves raw source times and angles. `build-bundle.py` selects the fixed common interval **5–25 s inclusive**, raw zero-based rows 500–2500. That yields 2001 rows per recording, 6003 total, at the original 0.01 s interval. The shorter common window fits the interactive sample budget and was declared before fitting. There is no angle centering, unwrap, resampling, smoothing, or time shift.

Mappings are the original headers `Time (s) Run #1`, `Angle (rad) Run #1`, and `Angular Velocity (rad/s) Run #1`. The supplied starting rates are the actual sensor cells at the first selected row: **0.681, 0.000, and 0.785 rad/s**. The second value is a recorded zero. Blank starting cells at raw time zero are not converted to zero. Sensor rate may itself be computed within the device; this ingestion does not claim an independent calibrated velocity measurement. Angle CSV precision is 0.001 rad, which is not an uncertainty calibration. The sensor-zero convention and equilibrium-zero consistency across recordings are also not independently established.

### Evidence identity and the quantization counterexample

The three distinct author filenames/repetition labels supply recording provenance. A copied run is refused if its declared recording ID matches training, if a complete shorter run appears as a contiguous subwindow of the opposite role, or if a 32-sample position sequence with matching elapsed times appears across roles. Absolute time shifts are compared using representable clock precision. These are conservative screening rules, not a proof of independent evidence.

The old five-sample angle matching heuristic falsely rejected this real input: training recording 2 and challenge recording 3 naturally share **12 consecutive quantized positions**, at source-selected indices 1243–1254 and 1609–1620. Distinct smooth trajectories can share short quantized sequences. The angular validator retains a regression for this observed false positive and uses the longer partial-copy screen while still refusing complete copied challenge subsets as short as five samples. No screening threshold proves that arbitrary partial copying, transformed copies, shared experimental errors, or mislabeled provenance are absent.

The torque path had the same defect even for independently generated known-inertia fixtures. A spring start `(θ₀,ω₀)=(0.8,0.3)` and another `(0.801,−0.2)`, sampled at 0.01 s for 6 s with angles quantized to 0.001 rad, share eight consecutive position/zero-command values; using `(0.81,−0.2)` shares 28. The v2 integration owner adopted the same complete-subset/32-sample partial screen. Independent review now accepts both legitimate quantized examples while preserving rejection of whole copied five-, 25-, and eight-sample challenge subsets and a 32-sample copied section embedded among other values. A retained 31-sample embedded copy demonstrates that acceptance cannot authenticate independence. The frozen v1 source remains unchanged.

## Honest unknown-scale model contract

`src/trajectory/angular-discovery.mjs` exports:

- `normalizeAngularBundle(raw)`: validate `worldlaw.angular-bundle/v1`, preserve provenance and separate roles, return copied data.
- `normalizeAngularRuns(trainingRuns)`: the same evidence boundary for fitters, without fitting or any torque conversion.
- `discoverAngular(trainingRuns, options)`: cumulative integral estimator, returning `worldlaw.angular-discovery/v1` and executable `worldlaw.angular-model/v1` candidates.
- `rolloutAngular(model, run, options)`: free-running `worldlaw.angular-rollout/v1`, initialized once from the first angle and supplied starting rate. Subsequent observed angles contribute residuals only.

The bundle declares only time `s`, position `rad`, and initial rate `rad/s`. Runs contain `dynamics: 'unforced_scalar_rotation'`, `inertia: null`, and samples `{time, position}`. Physical torque/command fields are rejected. Model outputs carry `physicalInertia: null`, `absoluteTorqueIdentified: false`, and `scaleMeaning: 'angular_acceleration_only_absolute_torque_unknown'`.

If a source also supplies per-run units, they must match those angular SI declarations exactly. Independent session receiving found and fixed an import defect where a contradictory per-run degrees/milliseconds declaration was previously ignored. The boundary now refuses the contradiction instead of silently reinterpreting the values.

For constant but unknown physical inertia, the identifiable model is

\[
\alpha=\ddot\theta=\sum_j a_j f_j(\theta,\omega),\qquad a_j=c_j/I.
\]

Multiplying every physical coefficient and inertia by the same positive factor leaves this angular equation unchanged. Angle observations therefore do not identify absolute torque scale. A private reference factor of one reuses the existing numerical integrator and cumulative fitter; it is an implementation variable, never a reported physical measurement. All exposed evidence and coefficients retain angular units.

| Basis | Angular coefficient unit |
|---|---|
| `ω` | `1/s` |
| `sign(ω)` | `rad/s²` |
| `θ` | `1/s²` |
| `sin(θ)` | `rad/s²` |
| `ω|ω|` | `1/rad` |
| constant | `rad/s²` |

The source has no actuator channel. Declaring unforced scalar rotation is an explicit interpretation of the experimental setup, not a measured proof of zero external forcing. No coefficient-sign or passivity constraint is imposed. A term involving rate is not automatically a dissipative drag force. A gravity-shaped basis is only a mathematical sine feature at the original angle zero. Unsupported forcing, angle offset, multiple degrees of freedom, variable inertia or other omitted dynamics can invalidate the library.

## Retained cumulative-integral failure

The initial fixed receipt uses only the two training recordings, all six autonomous terms, at most four terms, and assumed `noiseSigma: 0.01` rad. The estimator selects:

\[
\alpha=2.52819\,\operatorname{sign}(\omega)+528.93785\theta-604.68050\sin\theta-0.14435.
\]

Its whitened integrated training displacement RMSE is **0.353936 rad**, 35.4 assumed noise units. It is flagged `residual_mismatch`. The selected model and five further training-ranked candidates exceed the integrator's bounded state magnitude during the 20-second reserved recording. The next two candidates are finite but inaccurate: 19.6812 and 5.73774 rad challenge RMSE. Challenge errors do not reselect the model.

This failure is consistent with the known sensitivity of a cumulative displacement target to its supplied initial rate: an error `δω₀` contributes a drift `δω₀ t`. The recorded rate is not exact truth. For example, the first training sensor value is 0.681 rad/s while the adjacent two-angle central slope is 0.650 rad/s. That comparison is only an inconsistency diagnostic; noisy finite differences do not establish the correct rate or prove the cause of all mismatch. Quadrature, omitted dynamics, coordinate calibration and sensor errors remain possible contributors.

An exploratory training-duration sweep, performed before the weak-method study, used 1/2/4/8/20 s training prefixes with the entire original challenge. Its short-prefix errors and longer-prefix runaways are exploratory observations, not a promoted training-window choice. The original 20-second input and cumulative failure are preserved in executable tests.

## Compact-window weak refinement

`src/trajectory/angular-weak.mjs` exports `discoverAngularWeak(trainingRuns, options)`. It returns the same angular discovery/model schemas, with method `compact_window_weak_angular_acceleration_regression`. It accepts no challenge evidence. `initialRate` remains required evidence for subsequent forward use but is **never used by the weak fit**, including the nonlinear feature's local rate estimator.

For a window of duration `T`, use normalized time `x=(t−t₀)/T` and `φ(x)=x²(1−x)²`. The test function and its first derivative vanish at both ends. Twice integrating by parts gives

\[
\int_0^1\phi''(x)\theta(x)\,dx
 =T^2\sum_j a_j\int_0^1\phi(x)f_j(x)\,dx.
\]

Boundary position and velocity terms vanish. The left side is computed exactly for piecewise-linear sampled positions. It never estimates a second derivative of data. Constant/linear endpoint components are eliminated in the discrete target operator. For the linear rate basis, integration by parts avoids estimating pointwise velocity. Only sign-rate and quadratic-rate features use a local cubic first derivative of **training** positions. Weighted feature quadrature is exact for piecewise-linear features; sampled nonlinear features and noisy rate estimates still introduce approximation bias.

Each target row has weights `q` on raw position observations. Dividing both target and regressors by `||q||₂` gives a residual in radians with target-only standard deviation equal to an assumed iid raw position error `σ`. This is **not joint whitening**: overlapping windows and noisy regressors are correlated. `metrics.rmse` therefore means a noise-normalized weak-equation residual, not a trajectory RMSE or calibrated likelihood. There is intentionally no `whitenedRmse` field. The ranking score retains the bounded-library complexity heuristic. The implementation uses scaled reorthogonalized QR, finite coefficient checks, explicit rank diagnostics, at least nine raw samples per window, at least eight total windows, and at most 2048 windows.

### Development and freeze

The window grid was 0.25, 0.5, 1 and 2 seconds, with half-window stride. Development used independent analytic/fine-step spring and gravity fixtures at two sampling intervals and three noise levels, plus measured **training-only** fit/forward behavior. Short windows underperformed on noisy analytic data; two-second windows improved those slow analytic cases but degraded measured training forward errors. The one-second setting produced measured training forward RMSEs 0.213666 and 0.408445 rad versus 0.731316/0.796748 at 0.25 s and 0.500140/0.621006 at 2 s.

The settings were then frozen: **windowDuration 1 s; windowStride 0.5 s; rateWindowSize 9; all six autonomous terms; maxTerms 4; measured noiseSigma 0.01 rad**. No measured challenge error was used to choose those settings or rank candidates. The measured noise value is a working assumption, not sensor calibration.

### Fresh synthetic checks and counterexamples

The frozen method was compared with cumulative fitting on 48 cases: spring/gravity × noise 0/0.0001/0.001/0.01 rad × sample interval 0.01/0.025 s × fresh seeds 101/307/911. Two training starts were fitted; a separately generated altered start was forward-predicted. The weak method selected the correct two-feature structure in all 48 cases and had lower challenge RMSE in **30/48**. It is not uniformly more accurate.

| Position noise | Median weak challenge RMSE, rad | Median cumulative challenge RMSE, rad |
|---:|---:|---:|
| 0 | 0.0000000715 | 0.000174110 |
| 0.0001 | 0.000092187 | 0.000184370 |
| 0.001 | 0.000920310 | 0.000665194 |
| 0.01 | 0.009105528 | 0.007886649 |

Changing a training initial rate by +0.25 rad/s leaves every weak coefficient, score and rank unchanged. In the retained analytic wrong-rate challenge, weak RMSE is `9.14e−8` rad versus cumulative 0.128283 rad. A fast spring sampled at 0.125 s gives 0.003197 rad weak error versus 0.465851 rad cumulative error. Coarser sampling that leaves fewer than nine samples per requested window is explicitly refused, not silently rescued.

A retained unsupported cubic-restoration system still shows `not_falsified_on_training` while producing **0.320317 rad** weak challenge error. The cumulative comparator gives 0.330615 rad. A finite-library fit can extrapolate badly even when its training residual passes the assumed noise check. Longer windows can also hide rapid dynamics; the tested fixture set does not establish a universally optimal duration.

### Frozen measured receipt

Only after the settings above were frozen was the weak estimator received against the complete reserved recording. It selected

\[
\alpha=-39.9074995\sin\theta-0.2918417\quad[\mathrm{rad/s^2}].
\]

There are 78 training windows. The noise-normalized weak residual is **0.0755235 rad**, 7.55 assumed noise units, so `residual_mismatch` remains. Reserved recording 3 predicts continuously for all 20 seconds without resetting to observed positions:

- position RMSE **0.322967992 rad**;
- maximum absolute position error **0.943687077 rad**;
- final absolute position error **0.314034564 rad**.

All first eight training-ranked models are finite in this receipt. The sixth-ranked candidate has lower challenge error (0.089345585 rad), but it is **not promoted** or substituted for the training-selected model. Reporting that discrepancy exposes the limits of the ranking heuristic.

This is a reused held-out benchmark: its earlier cumulative failure motivated the refinement research. Fitting and ranking remain computationally isolated from recording 3, and weak settings were frozen before weak evaluation, but this is not a fresh blinded external validation. New independent recordings are needed for confirmatory generalization. All recordings here use the same apparatus and condition.

## Executable receiving evidence

From the repository root:

```sh
python examples/physical-pasco-92be/build-bundle.py
node examples/physical-pasco-92be/receive.mjs
node experiments/angular-weak-92be.mjs development
node experiments/angular-weak-92be.mjs analytic
node experiments/angular-weak-92be.mjs measured
node tests/trajectory-angular-92be.test.mjs
node tests/trajectory-angular-weak-92be.test.mjs
node tests/trajectory-angular-session-review-92be.test.mjs
```

Initial component receiving: angular adapter tests **10/10**, weak estimator tests **12/12**. Tests include independent analytic coefficients/rollouts; supplied-rate invariance of weak fitting; target-noise normalization; nonlinear rate features; epoch shifts; immutable caller data; JSON execution; measured raw hashes; precise unknown-scale units; cross-role copies; invalid/sparse input and computational refusal. The measured cumulative failure and frozen weak receipt are retained explicitly. An independent peer received the first angular component 10/10 and checked coefficient units, private-proxy isolation, held-out behavior and failure semantics.

Independent weak-method review confirmed the target sign, duration factors, angular units, supplied-rate elimination, training-only ranking and uncertainty limitations. It found one concrete clock defect: endpoint/stride comparisons used a tolerance scaled by absolute epoch, allowing an exactly representable `2**39` time shift to change short-window sample membership. The repair compares local elapsed intervals with local tolerances. The retained 513-sample regression now gives the same 63 windows, source indices and candidate coefficients before and after the shift. All 48 analytic comparison rows, stress cases and the complete frozen measured receipt remain exactly unchanged after this repair.

Independent angular session receiving passes **7/7**: mode-specific settings, the actual cumulative failure and weak finite receipt, future-challenge isolation, fabricated-cache recomputation, alternative/tolerance persistence, original source semantics, contradictory unit rejection, unknown physical scale, and unavailable stored candidate refusal. The related torque session review passes **15/15**, including the v2 quantized-data screen counterexamples and its retained 31-sample partial-copy limitation.

## Missing-measurement contract for a physical-torque claim

A future absolute-torque consumer needs independently established inertia about the modeled axis in kg·m², with mass-distribution/axis identity and uncertainty. Pendulum length or fitted inverse inertia is insufficient. It also needs an explicit actuation contract: either synchronized calibrated torque in N·m with hold/interpolation convention, or a defensible documented unforced apparatus state plus treatment of unknown external disturbances. A cart displacement, motor voltage, or normalized control number is not automatically torque.

Angles need calibrated scale, unwrapped convention, sign, zero/orientation consistency, timestamp units and synchronization. Initial angular rate needs either a recorded calibrated estimate with uncertainty or a disclosed estimation procedure confined to the allowed initial evidence. Future challenge samples must not be used to tune their own starting velocity. Recordings need distinct immutable identities, setup/condition metadata and raw provenance; segments of one recording or multiple sensor/model columns do not supply independent experimental repetition.

Until those fields exist, the angular-only mode is the honest executable contract. Even with them, finite-library adequacy, future prediction and mechanism transfer still require independent experimental tests.
